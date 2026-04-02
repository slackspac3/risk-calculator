const crypto = require('crypto');
const { appendAuditEvent, verifySessionToken } = require('./_audit');
const { isRequestSecretValid, sendApiError, requireSession, sendConflictError } = require('./_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { get: kvGet, getKvConfig, set: kvSet } = require('./_kvStore');

const SETTINGS_KEY = process.env.SETTINGS_STORE_KEY || 'risk_calculator_settings';
const DEFAULT_TYPICAL_DEPARTMENTS = [
  'Information Security',
  'Technology',
  'Operations',
  'Finance',
  'Procurement',
  'Legal',
  'Risk & Compliance',
  'Human Resources',
  'Internal Audit',
  'Data & AI',
  'Commercial',
  'Shared Services'
];
const DEFAULT_AI_FEEDBACK_TUNING = Object.freeze({
  alignmentPriority: 'strict',
  draftStyle: 'executive-brief',
  shortlistDiscipline: 'strict',
  learningSensitivity: 'balanced'
});
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';

function hasWritableKv() {
  try {
    return !!getKvConfig();
  } catch (error) {
    console.error('api/settings.hasWritableKv failed to resolve KV config:', error);
    return false;
  }
}

function getDefaultSettings() {
  return {
    geography: 'United Arab Emirates',
    companyWebsiteUrl: '',
    companyContextProfile: '',
    companyContextSections: null,
    companyStructure: [],
    entityContextLayers: [],
    buOverrides: [],
    docOverrides: [],
    riskAppetiteStatement: 'Moderate. Escalate risks that threaten regulated operations, cross-border data movement, or strategic platforms.',
    applicableRegulations: ['UAE PDPL', 'BIS Export Controls', 'OFAC Sanctions', 'UAE Cybersecurity Council Guidance', 'NIST SP 800-53', 'NIST RMF', 'ISO 27001', 'ISO 27002', 'ISO 27005', 'ISO 27017', 'ISO 27018', 'ISO 27701', 'ISO 22301', 'ISO 22313', 'ISO 27036', 'ISO 28000', 'ISO 31000'],
    aiInstructions: 'Prioritise operational, regulatory, and strategic impact. Use British English.',
    benchmarkStrategy: 'Prefer GCC and UAE benchmark references where relevant. Where GCC data is thin, use the best available global benchmark and explain the fallback clearly.',
    defaultLinkMode: true,
    toleranceThresholdUsd: 5000000,
    warningThresholdUsd: 3000000,
    annualReviewThresholdUsd: 12000000,
    adminContextSummary: 'Use this workspace to maintain geography, regulations, thresholds, and AI guidance for the platform.',
    escalationGuidance: 'Escalate to leadership when the scenario is above tolerance, close to tolerance, or materially affects regulated services.',
    typicalDepartments: [...DEFAULT_TYPICAL_DEPARTMENTS],
    aiFeedbackTuning: { ...DEFAULT_AI_FEEDBACK_TUNING },
    _meta: {
      revision: 0,
      updatedAt: 0
    }
  };
}

function normaliseAiFeedbackTuning(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const pick = (input, allowed, fallback) => {
    const safe = String(input || '').trim().toLowerCase();
    return allowed.includes(safe) ? safe : fallback;
  };
  return {
    alignmentPriority: pick(source.alignmentPriority, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.alignmentPriority),
    draftStyle: pick(source.draftStyle, ['executive-brief', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.draftStyle),
    shortlistDiscipline: pick(source.shortlistDiscipline, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.shortlistDiscipline),
    learningSensitivity: pick(source.learningSensitivity, ['conservative', 'balanced', 'accelerated'], DEFAULT_AI_FEEDBACK_TUNING.learningSensitivity)
  };
}

function normaliseSettings(settings = {}) {
  const defaults = getDefaultSettings();
  const mergedRegulations = Array.from(new Set([
    ...defaults.applicableRegulations,
    ...(Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [])
  ].map(value => String(value || '').trim()).filter(Boolean)));
  return {
    ...defaults,
    ...settings,
    applicableRegulations: mergedRegulations,
    companyContextSections: settings.companyContextSections && typeof settings.companyContextSections === 'object' ? settings.companyContextSections : null,
    companyStructure: Array.isArray(settings.companyStructure) ? settings.companyStructure : [],
    entityContextLayers: Array.isArray(settings.entityContextLayers) ? settings.entityContextLayers : [],
    buOverrides: Array.isArray(settings.buOverrides) ? settings.buOverrides : [],
    docOverrides: Array.isArray(settings.docOverrides) ? settings.docOverrides : [],
    aiFeedbackTuning: normaliseAiFeedbackTuning(settings.aiFeedbackTuning),
    typicalDepartments: Array.isArray(settings.typicalDepartments) && settings.typicalDepartments.length
      ? settings.typicalDepartments.map(name => String(name || '').trim()).filter(Boolean)
      : [...defaults.typicalDepartments],
    _meta: {
      revision: Number(settings._meta?.revision || 0),
      updatedAt: Number(settings._meta?.updatedAt || 0)
    }
  };
}

async function readSettings() {
  const raw = await kvGet(SETTINGS_KEY);
  if (!raw) return getDefaultSettings();
  try {
    return normaliseSettings(JSON.parse(raw));
  } catch (error) {
    console.error('api/settings.readSettings failed to parse stored settings payload:', error);
    return getDefaultSettings();
  }
}

function buildConflictDetails(currentSettings) {
  return {
    latestSettings: currentSettings,
    latestMeta: currentSettings?._meta || { revision: 0, updatedAt: 0 }
  };
}

function isStaleWrite(currentSettings, expectedMeta = {}) {
  const currentRevision = Number(currentSettings?._meta?.revision || 0);
  const expectedRevision = Number(expectedMeta?.revision || 0);
  return currentRevision !== expectedRevision;
}

async function writeSettings(settings, expectedMeta = {}) {
  if (!hasWritableKv()) {
    throw new Error('Shared settings store is not writable.');
  }
  const current = await readSettings();
  if (isStaleWrite(current, expectedMeta)) {
    return {
      ok: false,
      conflict: true,
      settings: current
    };
  }
  const next = normaliseSettings({
    ...settings,
    _meta: {
      revision: Number(current._meta?.revision || 0) + 1,
      updatedAt: Date.now()
    }
  });
  await kvSet(SETTINGS_KEY, JSON.stringify(next));
  return {
    ok: true,
    conflict: false,
    settings: next
  };
}

function isAdminSecretValid(req) {
  return isRequestSecretValid(req, 'x-admin-secret', ADMIN_API_SECRET);
}

function stableSortById(items = []) {
  return [...items].sort((left, right) => String(left?.id || '').localeCompare(String(right?.id || '')));
}

function normaliseStructureNode(node = {}) {
  return {
    id: String(node.id || ''),
    parentId: String(node.parentId || ''),
    type: String(node.type || ''),
    name: String(node.name || ''),
    websiteUrl: String(node.websiteUrl || ''),
    profile: String(node.profile || ''),
    departmentHint: String(node.departmentHint || ''),
    departmentRelationshipType: String(node.departmentRelationshipType || ''),
    ownerUsername: String(node.ownerUsername || ''),
    contextSections: node.contextSections && typeof node.contextSections === 'object' ? node.contextSections : null
  };
}

function normaliseLayer(layer = {}) {
  return {
    entityId: String(layer.entityId || ''),
    entityName: String(layer.entityName || ''),
    geography: String(layer.geography || ''),
    riskAppetiteStatement: String(layer.riskAppetiteStatement || ''),
    applicableRegulations: Array.isArray(layer.applicableRegulations) ? [...layer.applicableRegulations].sort() : [],
    aiInstructions: String(layer.aiInstructions || ''),
    benchmarkStrategy: String(layer.benchmarkStrategy || ''),
    contextSummary: String(layer.contextSummary || '')
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canBuAdminWriteSettings(currentSettings, proposedSettings, session) {
  const ownedBusinessUnitId = String(session?.businessUnitEntityId || '').trim();
  if (!ownedBusinessUnitId) return false;

  const guardedGlobalKeys = [
    'geography',
    'companyWebsiteUrl',
    'companyContextProfile',
    'companyContextSections',
    'buOverrides',
    'docOverrides',
    'riskAppetiteStatement',
    'applicableRegulations',
    'aiInstructions',
    'benchmarkStrategy',
    'defaultLinkMode',
    'toleranceThresholdUsd',
    'warningThresholdUsd',
    'annualReviewThresholdUsd',
    'adminContextSummary',
    'escalationGuidance',
    'aiFeedbackTuning',
    'typicalDepartments'
  ];

  for (const key of guardedGlobalKeys) {
    if (!sameValue(currentSettings[key], proposedSettings[key])) {
      return false;
    }
  }

  const currentStructure = Array.isArray(currentSettings.companyStructure) ? currentSettings.companyStructure : [];
  const proposedStructure = Array.isArray(proposedSettings.companyStructure) ? proposedSettings.companyStructure : [];
  const isDepartment = node => String(node.type || '').toLowerCase() === 'department / function';

  const currentCompanyNodes = stableSortById(currentStructure.filter(node => !isDepartment(node)).map(normaliseStructureNode));
  const proposedCompanyNodes = stableSortById(proposedStructure.filter(node => !isDepartment(node)).map(normaliseStructureNode));
  if (!sameValue(currentCompanyNodes, proposedCompanyNodes)) {
    return false;
  }

  const currentOutsideDepartments = stableSortById(
    currentStructure.filter(node => isDepartment(node) && String(node.parentId || '') !== ownedBusinessUnitId).map(normaliseStructureNode)
  );
  const proposedOutsideDepartments = stableSortById(
    proposedStructure.filter(node => isDepartment(node) && String(node.parentId || '') !== ownedBusinessUnitId).map(normaliseStructureNode)
  );
  if (!sameValue(currentOutsideDepartments, proposedOutsideDepartments)) {
    return false;
  }

  const proposedInsideDepartments = proposedStructure.filter(node => isDepartment(node) && String(node.parentId || '') === ownedBusinessUnitId);
  const allowedLayerEntityIds = new Set([
    ownedBusinessUnitId,
    ...currentStructure
      .filter(node => isDepartment(node) && String(node.parentId || '') === ownedBusinessUnitId)
      .map(node => String(node.id || '')),
    ...proposedInsideDepartments.map(node => String(node.id || ''))
  ]);

  const currentOutsideLayers = stableSortById(
    (Array.isArray(currentSettings.entityContextLayers) ? currentSettings.entityContextLayers : [])
      .filter(layer => !allowedLayerEntityIds.has(String(layer.entityId || '')))
      .map(normaliseLayer)
  );
  const proposedOutsideLayers = stableSortById(
    (Array.isArray(proposedSettings.entityContextLayers) ? proposedSettings.entityContextLayers : [])
      .filter(layer => !allowedLayerEntityIds.has(String(layer.entityId || '')))
      .map(normaliseLayer)
  );
  return sameValue(currentOutsideLayers, proposedOutsideLayers);
}

module.exports = async function handler(req, res) {
  const body = parseRequestBody(req);
  applyCorsHeaders(req, res, {
    methods: 'GET,PUT,OPTIONS',
    headers: 'content-type,x-admin-secret,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  if (req.method === 'PUT' && !req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    return;
  }

  if (req.method === 'PUT' && !isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }

  try {
    if (req.method === 'GET') {
      const settings = await readSettings();
      const response = { settings };
      if (isAdminSecretValid(req) || verifySessionToken(req.headers['x-session-token'])?.role === 'admin') {
        response.storage = {
          writable: hasWritableKv(),
          mode: hasWritableKv() ? 'shared-kv' : 'fallback-defaults'
        };
      }
      res.status(200).json(response);
      return;
    }

    if (req.method === 'PUT') {
      if (getUnexpectedFields(body, ['audit', 'expectedMeta', 'settings']).length) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the settings request.');
        return;
      }
      const bodyStr = JSON.stringify(body || {});
      if (bodyStr.length > 500000) {
        sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
        return;
      }
      if (!isPlainObject(body.settings || {})) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'settings payload is required.');
        return;
      }
      const session = isAdminSecretValid(req) ? { username: 'admin', role: 'admin' } : requireSession(req, res);
      if (!session) return;
      const currentSettings = await readSettings();
      const nextSettings = normaliseSettings(body.settings || {});
      const isAdminActor = isAdminSecretValid(req) || session?.role === 'admin';
      const isScopedBuAdmin = session?.role === 'bu_admin' && canBuAdminWriteSettings(currentSettings, nextSettings, session);
      if (!isAdminActor && !isScopedBuAdmin) {
        sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to modify these shared settings.');
        return;
      }
      const writeResult = await writeSettings(nextSettings, body.expectedMeta || body.settings?._meta || {});
      if (writeResult.conflict) {
        sendConflictError(
          res,
          'These platform settings changed in another session. Reload the latest version and try again.',
          buildConflictDetails(writeResult.settings)
        );
        return;
      }
      const settings = writeResult.settings;
      await appendAuditEvent({ category: body.audit?.category || 'settings', eventType: body.audit?.eventType || 'settings_updated', actorUsername: session?.username || 'admin', actorRole: session?.role || 'admin', target: body.audit?.target || 'global_settings', status: 'success', source: 'server', details: body.audit?.details || {} });
      res.status(200).json({ settings });
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    console.error('Settings API request failed.', error);
    sendApiError(res, 500, 'SETTINGS_REQUEST_FAILED', 'The settings request could not be completed.');
  }
};

module.exports.normaliseSettings = normaliseSettings;
module.exports.writeSettings = writeSettings;
