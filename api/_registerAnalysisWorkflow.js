'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, normaliseAiError, parseOrRepairStructuredJson, runStructuredQualityGate, sanitizeAiText } = require('./_aiOrchestrator');
const { buildDeterministicFallbackResult, buildFallbackFromError, buildManualModeResult, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const { buildFeedbackLearningPromptBlock, resolveHierarchicalFeedbackProfile, rerankRiskCardsWithFeedback } = require('./_learningAuthority');
const { workflowUtils } = require('./_scenarioDraftWorkflow');

const {
  buildContextPromptBlock,
  buildEvidenceMeta,
  cleanUserFacingText,
  compactInputValue,
  normaliseAdminSettingsInput,
  normaliseBlockInputText,
  normaliseBusinessUnitInput,
  normaliseCitationInputs,
  normaliseGuidance,
  normaliseInlineInputText,
  normalisePriorMessagesInput,
  normaliseRiskCards,
  normaliseStringListInput,
  truncateText,
  withEvidenceMeta
} = workflowUtils;

function normaliseBenchmarkBasis(value = '') {
  return cleanUserFacingText(value, { maxSentences: 3 });
}

function classifyRegisterFallbackReason(error = null) {
  const message = String(error?.message || error || '').trim();
  const safeMessage = sanitizeAiText(message, { maxChars: 220 });
  const withDetail = (base, detail) => ({
    ...base,
    detail: String(detail || '').trim()
  });
  if (!safeMessage) {
    return withDetail({
      code: 'no_ai_response',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The server did not receive a usable AI response, so it used deterministic register extraction instead.'
    }, 'No response content was returned.');
  }
  if (/Hosted AI proxy is not configured|Missing COMPASS_API_KEY secret/i.test(safeMessage)) {
    return withDetail({
      code: 'proxy_missing_secret',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The hosted AI proxy is not configured, so the server used deterministic register extraction instead.'
    }, 'The proxy is missing its Compass configuration.');
  }
  if (/timed out|could not be reached|NetworkError|Failed to fetch|rate limited/i.test(safeMessage)) {
    return withDetail({
      code: 'proxy_unreachable',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The hosted AI service could not be reached, so the server used deterministic register extraction instead.'
    }, safeMessage);
  }
  if (/rejected the request|401|403/i.test(safeMessage)) {
    return withDetail({
      code: 'ai_access_rejected',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The AI service rejected the request, so the server used deterministic register extraction instead.'
    }, safeMessage);
  }
  if (/Unexpected token|JSON|schema|parse|response shape was not usable|unusable structured response/i.test(safeMessage)) {
    return withDetail({
      code: 'invalid_ai_output',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The AI service returned an unusable structured response, so the server used deterministic register extraction instead.'
    }, safeMessage);
  }
  return withDetail({
    code: 'ai_runtime_error',
    title: 'Deterministic fallback register analysis loaded',
    message: 'The AI register-analysis step failed at runtime, so the server used deterministic register extraction instead.'
  }, safeMessage);
}

const MAX_REGISTER_ANALYSIS_PROMPT_ROWS = 80;
const MAX_REGISTER_ANALYSIS_NORMALISED_ROWS = 120;
const MAX_REGISTER_ANALYSIS_PROMPT_CHARS = 5000;
const MAX_REGISTER_ANALYSIS_INPUT_CHARS = 12000;
const MAX_REGISTER_ANALYSIS_FALLBACK_LINES = 20;

const REGISTER_HEADER_VALUE_PATTERN = /^(risk register|risk|risk id|risk title|risk name|title|description|details?|summary|owner|risk owner|control owner|action owner|status|impact|likelihood|inherent risk|residual risk|mitigation|control|controls|due date|review date|target date|notes?|comments?|category|type|domain|asset|cause|driver|threat|event|scenario|regulations?|obligations?|reference|ref|id)$/i;
const REGISTER_USEFUL_KEY_PATTERN = /^(risk|risk title|risk name|title|description|risk description|details?|summary|category|type|domain|asset|system|application|service|process|vendor|third party|supplier|cause|driver|threat|event|scenario|impact|consequence|effect|controls?|mitigations?|treatments?|actions?|response|regulations?|obligations?|compliance|likelihood|inherent risk|residual risk|severity|score|rating|notes?)$/i;
const REGISTER_NOISY_KEY_PATTERN = /^(owner|risk owner|control owner|action owner|status|due date|review date|target date|last updated|updated by|created by|reference|ref|id|row|row number)$/i;
const REGISTER_PLACEHOLDER_PATTERN = /^(?:n\/a|na|none|blank|tbd|unknown|null|enter(?:\s|$)|select(?:\s|$)|choose(?:\s|$)|example(?:\s|$)|sample(?:\s|$)|guidance|instruction|instructions|template)$/i;
const REGISTER_GENERIC_COLUMN_PATTERN = /^column[_ ]\d+$/i;

function normaliseRegisterLineText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateRegisterBlockText(value = '', maxChars = MAX_REGISTER_ANALYSIS_INPUT_CHARS) {
  const text = normaliseBlockInputText(value || '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function stripRegisterRowPrefix(value = '') {
  return normaliseRegisterLineText(value).replace(/^\d+\.\s*/, '').trim();
}

function splitRegisterDelimitedCells(value = '') {
  const source = stripRegisterRowPrefix(value);
  if (!source) return [];
  if (source.includes('|')) {
    return source.split(/\s*\|\s*/).map(normaliseRegisterLineText).filter(Boolean);
  }
  if (source.includes('\t')) {
    return source.split(/\s*\t\s*/).map(normaliseRegisterLineText).filter(Boolean);
  }
  const commaParts = source.split(/\s*,\s*/).map(normaliseRegisterLineText).filter(Boolean);
  if (commaParts.length >= 3 && commaParts.every((part) => part.length <= 80)) {
    return commaParts;
  }
  return [];
}

function normaliseRegisterToken(value = '') {
  return normaliseRegisterLineText(value).toLowerCase().replace(/[_-]+/g, ' ');
}

function isRegisterHeaderValue(value = '') {
  const token = normaliseRegisterToken(value);
  if (!token) return true;
  return REGISTER_HEADER_VALUE_PATTERN.test(token) || REGISTER_GENERIC_COLUMN_PATTERN.test(token);
}

function isRegisterPlaceholderValue(value = '') {
  const token = normaliseRegisterToken(value);
  return !token || REGISTER_PLACEHOLDER_PATTERN.test(token);
}

function isRegisterUsefulKey(value = '') {
  const token = normaliseRegisterToken(value);
  if (!token) return false;
  if (REGISTER_NOISY_KEY_PATTERN.test(token)) return false;
  return REGISTER_USEFUL_KEY_PATTERN.test(token);
}

function parseRegisterFields(line = '') {
  return splitRegisterDelimitedCells(line)
    .map((cell) => {
      const match = cell.match(/^([^:]{1,80}):\s*(.*)$/);
      if (!match) {
        return {
          key: '',
          value: normaliseRegisterLineText(cell)
        };
      }
      return {
        key: normaliseRegisterLineText(match[1]),
        value: normaliseRegisterLineText(match[2])
      };
    })
    .filter((field) => field.key || field.value);
}

function isHeaderOnlyRegisterLine(line = '') {
  const body = stripRegisterRowPrefix(line);
  if (!body) return true;
  if (/^rows?:$/i.test(body)) return true;
  if (/^columns:/i.test(body)) return false;
  if (/^sheet:/i.test(body)) return false;
  if (isRegisterHeaderValue(body)) return true;
  const fields = parseRegisterFields(body);
  return fields.length >= 2 && fields.every((field) => isRegisterHeaderValue(field.value || field.key));
}

function renderRegisterColumnsLine(line = '') {
  const rawColumns = String(line || '').replace(/^columns:\s*/i, '');
  const columns = rawColumns
    .split(/\s*,\s*/)
    .map(normaliseRegisterLineText)
    .filter(Boolean)
    .filter((column) => !REGISTER_GENERIC_COLUMN_PATTERN.test(normaliseRegisterToken(column)));
  const usefulColumns = columns.filter((column) => isRegisterUsefulKey(column));
  const keptColumns = (usefulColumns.length ? usefulColumns : columns.filter((column) => !REGISTER_NOISY_KEY_PATTERN.test(normaliseRegisterToken(column))))
    .slice(0, 6);
  return keptColumns.length ? `Columns: ${keptColumns.join(', ')}` : '';
}

function renderRegisterDataLine(line = '') {
  const body = stripRegisterRowPrefix(line);
  if (!body || isHeaderOnlyRegisterLine(body)) return '';
  const fields = parseRegisterFields(body);
  if (!fields.length) {
    return body.length > 10 ? body : '';
  }
  const keyedFields = fields.some((field) => field.key);
  const usefulFields = fields.filter((field) => {
    if (!field.value || isRegisterPlaceholderValue(field.value) || isRegisterHeaderValue(field.value)) return false;
    if (!field.key) return true;
    return isRegisterUsefulKey(field.key);
  });
  if (!usefulFields.length && keyedFields) return '';
  const renderedFields = (usefulFields.length ? usefulFields : fields.filter((field) => field.value && !isRegisterPlaceholderValue(field.value)))
    .slice(0, 4)
    .map((field) => (field.key ? `${field.key}: ${field.value}` : field.value))
    .filter(Boolean);
  const rendered = renderedFields.join(' | ');
  return rendered.length > 10 ? rendered : '';
}

function buildRegisterAnalysisText(registerText = '', {
  maxRows = MAX_REGISTER_ANALYSIS_NORMALISED_ROWS,
  maxChars = MAX_REGISTER_ANALYSIS_INPUT_CHARS
} = {}) {
  const renderedLines = [];
  const riskLines = [];
  const seenSectionLines = new Set();
  const sourceLines = normaliseBlockInputText(registerText || '').split('\n');
  for (const sourceLine of sourceLines) {
    const line = normaliseRegisterLineText(sourceLine);
    if (!line) continue;
    if (/^rows?:$/i.test(line)) continue;
    if (/^sheet:/i.test(line)) {
      const sectionLine = `Sheet: ${normaliseRegisterLineText(String(line).replace(/^sheet:\s*/i, ''))}`;
      const sectionKey = `sheet:${sectionLine.toLowerCase()}`;
      if (!seenSectionLines.has(sectionKey)) {
        renderedLines.push(sectionLine);
        seenSectionLines.add(sectionKey);
      }
      continue;
    }
    if (/^columns:/i.test(line)) {
      const columnsLine = renderRegisterColumnsLine(line);
      if (columnsLine) {
        const sectionKey = `columns:${columnsLine.toLowerCase()}`;
        if (!seenSectionLines.has(sectionKey)) {
          renderedLines.push(columnsLine);
          seenSectionLines.add(sectionKey);
        }
      }
      continue;
    }
    if (riskLines.length >= maxRows) continue;
    const renderedLine = renderRegisterDataLine(line);
    if (!renderedLine) continue;
    renderedLines.push(renderedLine);
    riskLines.push(renderedLine);
  }
  return {
    text: truncateRegisterBlockText(renderedLines.join('\n'), maxChars),
    riskLines
  };
}

function deriveRegisterRiskLineTitle(line = '') {
  const fields = parseRegisterFields(line);
  if (fields.length) {
    const titledField = fields.find((field) => /^(risk|risk title|risk name|title)$/i.test(normaliseRegisterToken(field.key)));
    if (titledField?.value) return titledField.value;
    const descriptiveField = fields.find((field) => /^(description|risk description|details?|summary|scenario|event)$/i.test(normaliseRegisterToken(field.key)));
    if (descriptiveField?.value) return descriptiveField.value;
  }
  return stripRegisterRowPrefix(line).replace(/^[-*]\s*/, '').trim();
}

function extractRegisterLines(registerText = '') {
  return buildRegisterAnalysisText(registerText, {
    maxRows: MAX_REGISTER_ANALYSIS_NORMALISED_ROWS,
    maxChars: MAX_REGISTER_ANALYSIS_INPUT_CHARS
  }).riskLines
    .map((line) => deriveRegisterRiskLineTitle(line))
    .filter(Boolean)
    .slice(0, MAX_REGISTER_ANALYSIS_FALLBACK_LINES);
}

function normaliseRegisterAnalysisCandidate(parsed = {}, input = {}) {
  const risks = normaliseRiskCards((Array.isArray(parsed.risks) ? parsed.risks : []).map((risk) => ({
    ...risk,
    regulations: Array.from(new Set([
      ...(Array.isArray(risk?.regulations) ? risk.regulations : []),
      ...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : [])
    ].map(String).filter(Boolean)))
  }))).map((risk, index) => ({
    id: risk.id || `register-risk-${index + 1}`,
    title: risk.title,
    category: risk.category || 'Register',
    description: risk.description || 'Imported from the uploaded register for review.',
    confidence: risk.confidence || 'medium',
    source: risk.source || 'register',
    regulations: risk.regulations || []
  }));
  return {
    summary: cleanUserFacingText(parsed.summary || '', { maxSentences: 3 }),
    linkAnalysis: cleanUserFacingText(parsed.linkAnalysis || '', { maxSentences: 3 }),
    workflowGuidance: normaliseGuidance(parsed.workflowGuidance),
    benchmarkBasis: normaliseBenchmarkBasis(parsed.benchmarkBasis || ''),
    risks
  };
}

function toRegisterAnalysisQualityCandidate(candidate = {}) {
  return {
    summary: candidate.summary || '',
    linkAnalysis: candidate.linkAnalysis || '',
    workflowGuidance: Array.isArray(candidate.workflowGuidance) ? candidate.workflowGuidance : [],
    benchmarkBasis: candidate.benchmarkBasis || '',
    risks: Array.isArray(candidate.risks) ? candidate.risks.map((risk) => ({
      title: risk.title || '',
      category: risk.category || '',
      description: risk.description || '',
      confidence: risk.confidence || 'medium',
      regulations: Array.isArray(risk.regulations) ? risk.regulations : []
    })) : []
  };
}

function buildFallbackRegisterResult(input = {}, { aiUnavailable = false, fallbackReason = null, feedbackProfile = null, traceLabel = 'Step 2 register analysis' } = {}) {
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    uploadedText: input.registerText,
    registerText: input.registerText,
    userProfile: input.adminSettings?.userProfileSummary,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings
  });
  const lines = extractRegisterLines(input.registerText || '');
  const extractedRisks = lines.slice(0, 15).map((line, index) => ({
    id: `register-risk-${index + 1}`,
    title: line.replace(/^[-*]\s*/, ''),
    category: 'Register',
    description: 'Imported from the uploaded risk register.',
    confidence: 'medium',
    source: 'register',
    regulations: (Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).slice(0, 3)
  }));
  const risks = rerankRiskCardsWithFeedback(extractedRisks, feedbackProfile);
  return buildDeterministicFallbackResult({
    baseResult: {
      summary: `Analysed ${lines.length} register entr${lines.length === 1 ? 'y' : 'ies'} and extracted ${risks.length} candidate risks.`,
      linkAnalysis: 'The shortlist comes directly from the uploaded register rows and still needs review for duplication, relevance, and any event-linking between the selected risks.',
      workflowGuidance: [
        'Keep the risks that materially change loss, disruption, regulation, or third-party exposure.',
        'Use linked mode when the selected risks could arise from the same underlying event or control failure.',
        'Challenge template noise or duplicate rows before using the shortlist in later steps.'
      ],
      benchmarkBasis: 'This register analysis used deterministic server fallback. Treat the extracted shortlist as a working draft until live AI is available again.',
      risks,
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    fallbackReason: fallbackReason || {
      code: 'server_register_fallback',
      title: 'Deterministic fallback register analysis loaded',
      message: 'The server used deterministic register extraction instead of live AI analysis for this upload.',
      detail: ''
    },
    aiUnavailable,
    traceLabel,
    promptSummary: 'Server deterministic fallback used for Step 2 register analysis.',
    response: risks.map((risk) => risk.title).join('\n'),
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta
  });
}

function hasMeaningfulRegisterContent(input = {}) {
  return extractRegisterLines(input.registerText || '').length > 0;
}

function normaliseRegisterMetaInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    scenarioLensKey: normaliseInlineInputText(value.scenarioLensKey || ''),
    type: normaliseInlineInputText(value.type || '').toLowerCase(),
    extension: normaliseInlineInputText(value.extension || '').toLowerCase(),
    sheetSelectionMode: normaliseInlineInputText(value.sheetSelectionMode || '').toLowerCase()
  });
}

function normaliseRegisterAnalysisInput(input = {}) {
  const normalisedRegisterText = buildRegisterAnalysisText(input.registerText || '', {
    maxRows: MAX_REGISTER_ANALYSIS_NORMALISED_ROWS,
    maxChars: MAX_REGISTER_ANALYSIS_INPUT_CHARS
  }).text;
  return compactInputValue({
    session: input.session,
    registerText: normalisedRegisterText,
    registerMeta: normaliseRegisterMetaInput(input.registerMeta),
    businessUnit: normaliseBusinessUnitInput(input.businessUnit),
    geography: normaliseInlineInputText(input.geography || ''),
    applicableRegulations: normaliseStringListInput(input.applicableRegulations, { maxItems: 12 }),
    adminSettings: normaliseAdminSettingsInput(input.adminSettings),
    priorMessages: normalisePriorMessagesInput(input.priorMessages),
    traceLabel: normaliseInlineInputText(input.traceLabel || ''),
    citations: normaliseCitationInputs(input.citations)
  }) || { session: input.session };
}

const REGISTER_ANALYSIS_TIMEOUTS = buildWorkflowTimeoutProfile({
  liveMs: 30000,
  repairMs: 12000,
  qualityMs: 14000,
  qualityRepairMs: 10000
});

function buildManualRegisterAnalysisResult(input = {}, { traceLabel = 'Step 2 register analysis' } = {}) {
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    uploadedText: input.registerText,
    registerText: input.registerText,
    userProfile: input.adminSettings?.userProfileSummary,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings
  });
  return buildManualModeResult({
    baseResult: {
      summary: 'The uploaded content does not contain enough usable risk rows for server register analysis.',
      linkAnalysis: 'Remove header-only or template text and upload cleaner risk rows before trying register analysis again.',
      workflowGuidance: [
        'Keep the register rows or pasted risks only.',
        'Remove headers, instructions, and template notes.',
        'Then run register analysis again.'
      ],
      benchmarkBasis: 'This step stayed in manual mode because the upload did not contain enough usable risk rows to analyse.',
      risks: [],
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    manualReason: {
      code: 'incomplete_register_input',
      title: 'Manual register review only',
      message: 'Add usable risk rows or paste cleaner TXT or CSV content before asking the server to analyse the register.'
    },
    traceLabel,
    promptSummary: 'Server manual mode used for Step 2 register analysis because the upload did not contain usable risk rows.',
    response: 'The register-analysis step stayed in manual mode because the uploaded content was incomplete.',
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta
  });
}

async function buildRegisterAnalysisWorkflow(input = {}) {
  input = normaliseRegisterAnalysisInput(input);
  const traceLabel = sanitizeAiText(input.traceLabel || 'Step 2 register analysis', { maxChars: 120 }) || 'Step 2 register analysis';
  if (!hasMeaningfulRegisterContent(input)) {
    return buildManualRegisterAnalysisResult(input, { traceLabel });
  }
  const feedbackProfile = await resolveHierarchicalFeedbackProfile({
    username: input.session?.username || '',
    buId: input.businessUnit?.id || input.businessUnit?.buId || '',
    functionKey: input.businessUnit?.selectedDepartmentKey || input.businessUnit?.functionKey || '',
    scenarioLensKey: input.businessUnit?.scenarioLensHint || input.registerMeta?.scenarioLensKey || ''
  });
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    return buildFallbackRegisterResult(input, {
      aiUnavailable: true,
      fallbackReason: classifyRegisterFallbackReason(new Error('Hosted AI proxy is not configured.')),
      feedbackProfile,
      traceLabel
    });
  }

  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    uploadedText: input.registerText,
    registerText: input.registerText,
    userProfile: input.adminSettings?.userProfileSummary,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings
  });
  const compactRegisterText = buildRegisterAnalysisText(input.registerText || '', {
    maxRows: MAX_REGISTER_ANALYSIS_PROMPT_ROWS,
    maxChars: MAX_REGISTER_ANALYSIS_PROMPT_CHARS
  }).text;
  const compactContextSummary = truncateText(input.businessUnit?.contextSummary || input.businessUnit?.notes || '(none)', 320);
  const compactAdminSummary = truncateText(input.adminSettings?.adminContextSummary || '', 220);
  const compactUserProfile = truncateText(input.adminSettings?.userProfileSummary || '(none)', 220);
  const compactOrgContext = truncateText(input.adminSettings?.companyStructureContext || '(none)', 320);
  const compactLiveContext = truncateText(buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null), 320);
  const outputSchema = `{
  "summary": "string",
  "linkAnalysis": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "risks": [
    { "title": "string", "category": "string", "description": "string", "confidence": "high|medium|low", "regulations": ["string"] }
  ]
}`;
  const systemPrompt = `You are a senior enterprise risk analyst extracting a candidate shortlist from an uploaded risk register.

Return JSON only with this schema:
${outputSchema}

Rules:
- keep the shortlist grounded in the uploaded register rows, sheet names, and column headers
- ignore generic template or instructional text
- deduplicate overlapping risks
- keep risk titles concise and selection-card friendly
- do not invent risks that are not supported by the uploaded material`;
  const userPrompt = `Business unit: ${input.businessUnit?.name || 'Unknown'}
Geography: ${input.geography || 'Unknown'}
BU context summary: ${compactContextSummary}
BU-specific AI guidance: ${input.businessUnit?.aiGuidance || '(none)'}
Applicable regulations: ${(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).slice(0, 8).join(', ') || '(none)'}
Register metadata: ${input.registerMeta ? JSON.stringify({
    type: input.registerMeta.type,
    extension: input.registerMeta.extension,
    sheetSelectionMode: input.registerMeta.sheetSelectionMode,
    sheets: input.registerMeta.sheets
  }) : '(none)'}
Benchmark strategy: ${truncateText(input.adminSettings?.benchmarkStrategy || 'Prefer GCC and UAE references where possible, then use best global data with clear explanation.', 180)}
Admin context summary: ${compactAdminSummary || '(none)'}
User profile context:
${compactUserProfile}
Organisation structure context:
${compactOrgContext}
Live scoped context:
${compactLiveContext}

Risk register content:
${compactRegisterText || '(none)'}

Instructions:
- focus on risk rows, sheet names, and column headers; ignore generic instructional template text
- deduplicate overlapping risks
- produce concise risk titles suitable for selection cards
- preserve important contextual detail in the descriptions
- extract up to 8 material risks if the register supports them
- for each risk, include a confidence field of high, medium, or low
- include workflow guidance that tells a non-risk practitioner what to do after extraction

Evidence quality context:
${truncateText(evidenceMeta.promptBlock || '', 240)}

${buildFeedbackLearningPromptBlock(feedbackProfile)}`;

  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'analyseRiskRegister',
      temperature: 0.3,
      maxCompletionTokens: 2800,
      maxPromptChars: 9000,
      timeoutMs: REGISTER_ANALYSIS_TIMEOUTS.liveMs,
      priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, outputSchema, {
      taskName: 'repairAnalyseRiskRegister',
      timeoutMs: REGISTER_ANALYSIS_TIMEOUTS.repairMs
    });
    let candidate = normaliseRegisterAnalysisCandidate(parsed?.parsed || {}, input);
    try {
      const qualityChecked = await runStructuredQualityGate({
        taskName: 'analyseRiskRegisterQualityGate',
        schemaHint: outputSchema,
        originalContext: [
          `Business unit: ${input.businessUnit?.name || 'Unknown'}`,
          `Geography: ${input.geography || 'Unknown'}`,
          `Register metadata: ${input.registerMeta ? JSON.stringify({
            type: input.registerMeta.type,
            extension: input.registerMeta.extension,
            sheetSelectionMode: input.registerMeta.sheetSelectionMode,
            sheets: input.registerMeta.sheets
          }) : '(none)'}`,
          `Register text: ${compactRegisterText || '(none)'}`
        ].join('\n'),
        checklist: [
          'Keep the shortlist grounded in the uploaded register rows, sheet names, and column headers.',
          'Do not invent risks that are not supported by the uploaded material.',
          'Remove template or instructional noise.',
          'Keep risk titles concise and selection-card friendly.',
          'Keep the summary and workflow guidance coherent with the extracted shortlist.'
        ],
        candidatePayload: toRegisterAnalysisQualityCandidate(candidate),
        timeoutMs: REGISTER_ANALYSIS_TIMEOUTS.qualityMs,
        repairTimeoutMs: REGISTER_ANALYSIS_TIMEOUTS.qualityRepairMs
      });
      if (qualityChecked?.parsed) {
        candidate = normaliseRegisterAnalysisCandidate(qualityChecked.parsed, input);
      }
    } catch (qualityGateError) {
      console.warn('register analysis quality gate fallback:', qualityGateError.message);
    }

    candidate = {
      ...candidate,
      risks: rerankRiskCardsWithFeedback(candidate.risks, feedbackProfile)
    };

    return withEvidenceMeta({
      mode: 'live',
      ...candidate,
      citations: Array.isArray(input.citations) ? input.citations : [],
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: [
          candidate.summary,
          candidate.linkAnalysis,
          ...(Array.isArray(candidate.risks) ? candidate.risks.map((risk) => risk.title) : [])
        ].filter(Boolean).join('\n'),
        sources: input.citations || []
      })
    }, evidenceMeta);
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyRegisterFallbackReason,
      buildFallbackResult: ({ aiUnavailable, fallbackReason, normalisedError }) => {
        console.warn('buildRegisterAnalysisWorkflow server fallback:', normalisedError.message);
        return buildFallbackRegisterResult(input, {
          aiUnavailable,
          fallbackReason,
          feedbackProfile,
          traceLabel
        });
      }
    });
  }
}

module.exports = {
  buildRegisterAnalysisWorkflow,
  normaliseRegisterAnalysisInput
};
