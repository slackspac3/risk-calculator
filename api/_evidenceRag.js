'use strict';

const crypto = require('crypto');
const { getCompassProviderConfig } = require('./_aiRuntime');

const DEFAULT_COLLECTION = 'risk_calculator_evidence';
const DEFAULT_EMBEDDINGS_MODEL = 'text-embedding-3-large';
const DEFAULT_WORKSPACE_ID = 'risk-calculator';
const DEFAULT_PROJECT_ID = 'risk-intelligence-platform';
const DEFAULT_CHUNK_CHARS = 1400;
const DEFAULT_CHUNK_OVERLAP_CHARS = 160;
const DEFAULT_MAX_CHUNKS = 96;
const DEFAULT_TOP_K = 8;

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripTrailingSlash(value = '') {
  return cleanText(value).replace(/\/+$/, '');
}

function configuredText(value = '') {
  const text = cleanText(value);
  return /^(undefined|null)$/i.test(text) ? '' : text;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getEvidenceRagConfig() {
  const compass = getCompassProviderConfig();
  const embeddingsUrl = configuredText(process.env.RISK_RAG_EMBEDDINGS_URL || process.env.COMPASS_EMBEDDINGS_URL)
    || deriveEmbeddingsUrl(compass.apiUrl);
  const embeddingsApiKey = configuredText(process.env.RISK_RAG_EMBEDDINGS_API_KEY || process.env.COMPASS_EMBEDDINGS_API_KEY || compass.apiKey);
  const qdrantUrl = stripTrailingSlash(
    process.env.RISK_RAG_QDRANT_URL
    || process.env.QDRANT_URL
    || process.env.P42_VECTOR_DB_URL
    || ''
  );
  return {
    qdrantUrl,
    qdrantApiKey: configuredText(process.env.RISK_RAG_QDRANT_API_KEY || process.env.QDRANT_API_KEY || process.env.P42_VECTOR_DB_API_KEY || ''),
    collection: configuredText(process.env.RISK_RAG_QDRANT_COLLECTION || process.env.QDRANT_COLLECTION || process.env.P42_VECTOR_DB_COLLECTION || DEFAULT_COLLECTION) || DEFAULT_COLLECTION,
    embeddingsUrl,
    embeddingsApiKey,
    embeddingsModel: configuredText(process.env.RISK_RAG_EMBEDDINGS_MODEL || process.env.EMBEDDINGS_MODEL || DEFAULT_EMBEDDINGS_MODEL) || DEFAULT_EMBEDDINGS_MODEL,
    workspaceId: configuredText(process.env.RISK_RAG_WORKSPACE_ID || DEFAULT_WORKSPACE_ID) || DEFAULT_WORKSPACE_ID,
    projectId: configuredText(process.env.RISK_RAG_PROJECT_ID || DEFAULT_PROJECT_ID) || DEFAULT_PROJECT_ID,
    chunkChars: parsePositiveInt(process.env.RISK_RAG_CHUNK_CHARS, DEFAULT_CHUNK_CHARS),
    chunkOverlapChars: parsePositiveInt(process.env.RISK_RAG_CHUNK_OVERLAP_CHARS, DEFAULT_CHUNK_OVERLAP_CHARS),
    maxChunks: parsePositiveInt(process.env.RISK_RAG_MAX_CHUNKS, DEFAULT_MAX_CHUNKS)
  };
}

function deriveEmbeddingsUrl(apiUrl = '') {
  const url = configuredText(apiUrl);
  if (!url) return 'https://api.core42.ai/v1/embeddings';
  if (/\/chat\/completions\/?$/i.test(url)) return url.replace(/\/chat\/completions\/?$/i, '/embeddings');
  if (/\/responses\/?$/i.test(url)) return url.replace(/\/responses\/?$/i, '/embeddings');
  return `${stripTrailingSlash(url)}/embeddings`;
}

function evidenceRagHealth() {
  const config = getEvidenceRagConfig();
  return {
    provider: 'qdrant_droplet',
    configured: Boolean(config.qdrantUrl && config.embeddingsUrl && config.embeddingsApiKey),
    qdrantConfigured: Boolean(config.qdrantUrl),
    embeddingsConfigured: Boolean(config.embeddingsUrl && config.embeddingsApiKey),
    collection: config.collection,
    embeddingsModel: config.embeddingsModel,
    browserEmbeddingsRetained: false,
    actorScoped: true
  };
}

function assertConfigured(config = getEvidenceRagConfig()) {
  if (!config.qdrantUrl) {
    const error = new Error('Server-side evidence RAG is not configured. Set RISK_RAG_QDRANT_URL to the droplet Qdrant endpoint.');
    error.statusCode = 503;
    error.code = 'RAG_QDRANT_UNCONFIGURED';
    throw error;
  }
  if (!config.embeddingsUrl || !config.embeddingsApiKey) {
    const error = new Error('Server-side evidence RAG embeddings are not configured. Set COMPASS_API_KEY or RISK_RAG_EMBEDDINGS_API_KEY.');
    error.statusCode = 503;
    error.code = 'RAG_EMBEDDINGS_UNCONFIGURED';
    throw error;
  }
}

function sessionScope(session = {}, config = getEvidenceRagConfig()) {
  const actorId = cleanText(session.username || session.id || session.sub || 'anonymous').toLowerCase();
  const actorHash = crypto.createHash('sha256').update(actorId || 'anonymous').digest('hex').slice(0, 20);
  return {
    workspaceId: `${config.workspaceId}:actor:${actorHash}`,
    projectId: config.projectId,
    actorScoped: true
  };
}

function stableUuid(value = '') {
  const hex = crypto.createHash('sha256').update(cleanText(value) || crypto.randomUUID()).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function normalizeDocuments(payload = {}) {
  const source = Array.isArray(payload.documents) && payload.documents.length
    ? payload.documents
    : payload.text || payload.summary || payload.excerpt
      ? [{
        evidenceId: payload.evidenceId,
        title: payload.title,
        fileName: payload.fileName,
        text: payload.text || payload.summary || payload.excerpt,
        sourceType: payload.sourceType,
        extractionStatus: payload.extractionStatus
      }]
      : [];

  return source
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, 24)
    .map((item, index) => {
      const evidenceId = cleanText(item.evidenceId || item.documentId || `DOC-${String(index + 1).padStart(2, '0')}`);
      return {
        evidenceId,
        documentId: cleanText(item.documentId || evidenceId),
        title: cleanText(item.title || item.fileName || evidenceId),
        fileName: cleanText(item.fileName || ''),
        text: cleanText(item.text || item.content || item.summary || item.excerpt || ''),
        sourceType: cleanText(item.sourceType || item.source || 'uploaded_evidence'),
        extractionStatus: cleanText(item.extractionStatus || (item.text || item.content ? 'parsed_text' : 'submitted_text')),
        documentType: cleanText(item.documentType || ''),
        tags: Array.isArray(item.tags) ? item.tags.map(cleanText).filter(Boolean).slice(0, 16) : [],
        domains: Array.isArray(item.domains) ? item.domains.map(cleanText).filter(Boolean).slice(0, 16) : []
      };
    })
    .filter(item => item.text);
}

function chunkDocument(document = {}, config = getEvidenceRagConfig()) {
  const text = cleanText(document.text);
  if (!text) return [];
  const chunkChars = Math.max(400, Number(config.chunkChars || DEFAULT_CHUNK_CHARS));
  const overlap = Math.min(Math.max(0, Number(config.chunkOverlapChars || DEFAULT_CHUNK_OVERLAP_CHARS)), Math.floor(chunkChars / 2));
  const step = Math.max(1, chunkChars - overlap);
  const chunks = [];
  for (let start = 0; start < text.length; start += step) {
    const chunkText = cleanText(text.slice(start, start + chunkChars));
    if (!chunkText) continue;
    const chunkIndex = chunks.length;
    chunks.push({
      ...document,
      chunkIndex,
      chunkId: `${document.evidenceId}_CHUNK_${String(chunkIndex + 1).padStart(3, '0')}`,
      text: chunkText,
      snippet: chunkText.slice(0, 700)
    });
    if (start + chunkChars >= text.length) break;
  }
  return chunks;
}

function buildEvidenceChunks(payload = {}, config = getEvidenceRagConfig()) {
  const chunks = normalizeDocuments(payload).flatMap(document => chunkDocument(document, config));
  return chunks.slice(0, Math.max(1, Number(config.maxChunks || DEFAULT_MAX_CHUNKS)));
}

function extractEmbeddingVector(body = {}) {
  if (Array.isArray(body.embedding)) return body.embedding;
  if (Array.isArray(body.vector)) return body.vector;
  if (Array.isArray(body.data?.[0]?.embedding)) return body.data[0].embedding;
  if (Array.isArray(body.embeddings?.[0])) return body.embeddings[0];
  if (Array.isArray(body.embeddings?.[0]?.embedding)) return body.embeddings[0].embedding;
  if (Array.isArray(body.result?.embedding)) return body.result.embedding;
  return [];
}

function normalizeEmbeddingRows(body = {}, expectedCount = 1) {
  if (Array.isArray(body.data)) {
    return body.data.map(item => Array.isArray(item.embedding) ? item.embedding : []).slice(0, expectedCount);
  }
  if (Array.isArray(body.embeddings)) {
    return body.embeddings.map(item => Array.isArray(item) ? item : item?.embedding || []).slice(0, expectedCount);
  }
  return [extractEmbeddingVector(body)].slice(0, expectedCount);
}

async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    if (!response.ok) {
      const error = new Error(body.status?.error || body.error?.message || body.error || body.detail || `Request failed with HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function embedTexts(texts = [], config = getEvidenceRagConfig()) {
  const input = Array.isArray(texts) ? texts : [texts];
  if (!input.length) return { model: config.embeddingsModel, vectors: [] };
  const body = await fetchJson(config.embeddingsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.embeddingsApiKey}`
    },
    body: JSON.stringify({
      model: config.embeddingsModel,
      input
    })
  }, 30000);
  return {
    model: body.model || config.embeddingsModel,
    vectors: normalizeEmbeddingRows(body, input.length)
  };
}

async function qdrantFetch(pathname, options = {}, config = getEvidenceRagConfig()) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (config.qdrantApiKey) headers['api-key'] = config.qdrantApiKey;
  return fetchJson(`${config.qdrantUrl}${pathname}`, {
    ...options,
    headers
  }, 30000);
}

async function ensureQdrantCollection(vectorSize, config = getEvidenceRagConfig()) {
  try {
    await qdrantFetch(`/collections/${encodeURIComponent(config.collection)}`, { method: 'GET' }, config);
  } catch (error) {
    if (error.status && error.status !== 404) throw error;
    await qdrantFetch(`/collections/${encodeURIComponent(config.collection)}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        }
      })
    }, config);
  }
}

function chunkPayloadForQdrant(chunk = {}, context = {}) {
  const now = context.now || new Date().toISOString();
  return {
    type: 'risk_evidence_chunk',
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    caseId: context.caseId,
    evidenceId: chunk.evidenceId,
    documentId: chunk.documentId || chunk.evidenceId,
    chunkId: chunk.chunkId,
    chunkIndex: Number(chunk.chunkIndex || 0),
    title: chunk.title || chunk.evidenceId,
    fileName: chunk.fileName || '',
    sourceType: chunk.sourceType || 'uploaded_evidence',
    extractionStatus: chunk.extractionStatus || 'parsed_text',
    documentType: chunk.documentType || '',
    tags: Array.isArray(chunk.tags) ? chunk.tags.slice(0, 16) : [],
    domains: Array.isArray(chunk.domains) ? chunk.domains.slice(0, 16) : [],
    snippet: cleanText(chunk.snippet || chunk.text || '').slice(0, 700),
    text: cleanText(chunk.text || ''),
    createdAt: now,
    updatedAt: now,
    model: context.model
  };
}

function safeChunkForClient(chunk = {}) {
  return {
    chunkId: cleanText(chunk.chunkId || ''),
    evidenceId: cleanText(chunk.evidenceId || ''),
    documentId: cleanText(chunk.documentId || chunk.evidenceId || ''),
    title: cleanText(chunk.title || ''),
    fileName: cleanText(chunk.fileName || ''),
    chunkIndex: Number.isFinite(Number(chunk.chunkIndex)) ? Number(chunk.chunkIndex) : undefined,
    snippet: cleanText(chunk.snippet || chunk.text || '').slice(0, 520),
    textLength: cleanText(chunk.text || '').length,
    metadata: {
      sourceType: cleanText(chunk.sourceType || chunk.metadata?.sourceType || ''),
      extractionStatus: cleanText(chunk.extractionStatus || chunk.metadata?.extractionStatus || ''),
      documentType: cleanText(chunk.documentType || chunk.metadata?.documentType || ''),
      fileName: cleanText(chunk.fileName || chunk.metadata?.fileName || '')
    }
  };
}

function safeMatchForClient(match = {}) {
  const payload = match.payload || match;
  const snippet = cleanText(payload.snippet || payload.text || match.snippet || match.text || '').slice(0, 700);
  return {
    chunkId: cleanText(payload.chunkId || match.chunkId || ''),
    evidenceId: cleanText(payload.evidenceId || match.evidenceId || ''),
    documentId: cleanText(payload.documentId || match.documentId || payload.evidenceId || ''),
    title: cleanText(payload.title || match.title || ''),
    fileName: cleanText(payload.fileName || match.fileName || ''),
    chunkIndex: Number.isFinite(Number(payload.chunkIndex ?? match.chunkIndex)) ? Number(payload.chunkIndex ?? match.chunkIndex) : undefined,
    score: Number(match.score || payload.score || 0),
    snippet,
    text: snippet,
    citation: {
      evidenceId: cleanText(payload.evidenceId || match.evidenceId || ''),
      chunkId: cleanText(payload.chunkId || match.chunkId || ''),
      title: cleanText(payload.title || match.title || '')
    },
    metadata: {
      sourceType: cleanText(payload.sourceType || ''),
      extractionStatus: cleanText(payload.extractionStatus || ''),
      documentType: cleanText(payload.documentType || ''),
      fileName: cleanText(payload.fileName || ''),
      tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 12) : [],
      domains: Array.isArray(payload.domains) ? payload.domains.slice(0, 12) : []
    }
  };
}

async function indexEvidenceServerSide(payload = {}, options = {}) {
  const config = getEvidenceRagConfig();
  assertConfigured(config);
  const caseId = cleanText(payload.caseId);
  if (!caseId) {
    const error = new Error('caseId is required for server-side evidence indexing.');
    error.statusCode = 400;
    error.code = 'RAG_CASE_ID_REQUIRED';
    throw error;
  }
  const chunks = buildEvidenceChunks(payload, config);
  if (!chunks.length) {
    const error = new Error('At least one document with extracted text is required for server-side evidence indexing.');
    error.statusCode = 400;
    error.code = 'RAG_DOCUMENT_TEXT_REQUIRED';
    throw error;
  }
  const scope = sessionScope(options.session || options.actor || {}, config);
  const embedded = await embedTexts(chunks.map(chunk => chunk.text), config);
  const vectors = embedded.vectors || [];
  const vectorSize = vectors.find(vector => Array.isArray(vector) && vector.length)?.length || 0;
  if (!vectorSize) {
    const error = new Error('Embedding provider did not return vectors for evidence indexing.');
    error.statusCode = 502;
    error.code = 'RAG_EMBEDDING_RESPONSE_INVALID';
    throw error;
  }
  await ensureQdrantCollection(vectorSize, config);
  const now = new Date().toISOString();
  const points = chunks
    .map((chunk, index) => ({ chunk, vector: vectors[index] }))
    .filter(item => Array.isArray(item.vector) && item.vector.length)
    .map(({ chunk, vector }) => ({
      id: stableUuid(`${scope.workspaceId}:${scope.projectId}:${caseId}:${chunk.chunkId}`),
      vector,
      payload: chunkPayloadForQdrant(chunk, {
        ...scope,
        caseId,
        now,
        model: embedded.model || config.embeddingsModel
      })
    }));
  await qdrantFetch(`/collections/${encodeURIComponent(config.collection)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points })
  }, config);

  return {
    ok: true,
    model: embedded.model || config.embeddingsModel,
    context: {
      caseId,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      purpose: cleanText(payload.purpose || 'risk_evidence_index')
    },
    chunking: {
      documentCount: normalizeDocuments(payload).length,
      chunkCount: points.length,
      maxChunks: config.maxChunks
    },
    index: {
      caseId,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      provider: 'qdrant_droplet',
      storage: 'server_side_qdrant_vector_db',
      collection: config.collection,
      chunkCount: points.length,
      evidenceIds: Array.from(new Set(points.map(point => point.payload.evidenceId).filter(Boolean))),
      chunkIds: points.map(point => point.payload.chunkId).filter(Boolean).slice(0, 50),
      updatedAt: now,
      browserEmbeddingsRetained: false,
      actorScoped: scope.actorScoped
    },
    chunks: points.map(point => safeChunkForClient(point.payload))
  };
}

function qdrantSearchFilter({ caseId, workspaceId, projectId }) {
  return {
    must: [
      { key: 'type', match: { value: 'risk_evidence_chunk' } },
      { key: 'workspaceId', match: { value: workspaceId } },
      { key: 'projectId', match: { value: projectId } },
      { key: 'caseId', match: { value: caseId } }
    ]
  };
}

async function searchEvidenceServerSide(payload = {}, options = {}) {
  const config = getEvidenceRagConfig();
  assertConfigured(config);
  const caseId = cleanText(payload.caseId);
  const query = cleanText(payload.query);
  if (!caseId) {
    const error = new Error('caseId is required for server-side evidence search.');
    error.statusCode = 400;
    error.code = 'RAG_CASE_ID_REQUIRED';
    throw error;
  }
  if (!query) {
    const error = new Error('query is required for server-side evidence search.');
    error.statusCode = 400;
    error.code = 'RAG_QUERY_REQUIRED';
    throw error;
  }
  const scope = sessionScope(options.session || options.actor || {}, config);
  const embedded = await embedTexts([query], config);
  const vector = embedded.vectors?.[0] || [];
  if (!Array.isArray(vector) || !vector.length) {
    const error = new Error('Embedding provider did not return a vector for evidence search.');
    error.statusCode = 502;
    error.code = 'RAG_EMBEDDING_RESPONSE_INVALID';
    throw error;
  }
  const topK = Math.max(1, Math.min(20, Number(payload.topK || payload.limit || DEFAULT_TOP_K)));
  const body = await qdrantFetch(`/collections/${encodeURIComponent(config.collection)}/points/search`, {
    method: 'POST',
    body: JSON.stringify({
      vector,
      limit: topK,
      with_payload: true,
      with_vector: false,
      filter: qdrantSearchFilter({
        caseId,
        workspaceId: scope.workspaceId,
        projectId: scope.projectId
      })
    })
  }, config);
  const matches = (Array.isArray(body.result) ? body.result : []).map(safeMatchForClient);
  return {
    ok: true,
    model: embedded.model || config.embeddingsModel,
    context: {
      caseId,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      purpose: cleanText(payload.purpose || 'risk_evidence_search')
    },
    index: {
      caseId,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      provider: 'qdrant_droplet',
      storage: 'server_side_qdrant_vector_db',
      collection: config.collection,
      matchCount: matches.length,
      evidenceIds: Array.from(new Set(matches.map(match => match.evidenceId).filter(Boolean))),
      browserEmbeddingsRetained: false,
      actorScoped: scope.actorScoped
    },
    matches
  };
}

module.exports = {
  buildEvidenceChunks,
  deriveEmbeddingsUrl,
  evidenceRagHealth,
  getEvidenceRagConfig,
  indexEvidenceServerSide,
  normalizeDocuments,
  safeMatchForClient,
  searchEvidenceServerSide,
  sessionScope,
  __unsafeInternals: {
    chunkDocument,
    qdrantSearchFilter,
    stableUuid
  }
};
