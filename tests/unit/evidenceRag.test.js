'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalFetch = global.fetch;
const originalEnv = {
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  RISK_RAG_EMBEDDINGS_API_KEY: process.env.RISK_RAG_EMBEDDINGS_API_KEY,
  RISK_RAG_EMBEDDINGS_MODEL: process.env.RISK_RAG_EMBEDDINGS_MODEL,
  RISK_RAG_EMBEDDINGS_URL: process.env.RISK_RAG_EMBEDDINGS_URL,
  RISK_RAG_MAX_CHUNKS: process.env.RISK_RAG_MAX_CHUNKS,
  RISK_RAG_PROJECT_ID: process.env.RISK_RAG_PROJECT_ID,
  RISK_RAG_QDRANT_API_KEY: process.env.RISK_RAG_QDRANT_API_KEY,
  RISK_RAG_QDRANT_COLLECTION: process.env.RISK_RAG_QDRANT_COLLECTION,
  RISK_RAG_QDRANT_URL: process.env.RISK_RAG_QDRANT_URL,
  RISK_RAG_WORKSPACE_ID: process.env.RISK_RAG_WORKSPACE_ID
};

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
}

function withEnv(overrides, fn) {
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  return Promise.resolve()
    .then(fn)
    .finally(restoreEnv);
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('deriveEmbeddingsUrl maps chat completions endpoint to embeddings endpoint', () => {
  const { deriveEmbeddingsUrl } = require('../../api/_evidenceRag');

  assert.equal(
    deriveEmbeddingsUrl('https://api.core42.ai/v1/chat/completions'),
    'https://api.core42.ai/v1/embeddings'
  );
  assert.equal(
    deriveEmbeddingsUrl('https://gateway.example/api'),
    'https://gateway.example/api/embeddings'
  );
});

test('server-side evidence index writes vectors to droplet Qdrant without returning them to the browser', async () => {
  const { indexEvidenceServerSide } = require('../../api/_evidenceRag');
  const calls = [];

  await withEnv({
    COMPASS_API_KEY: 'compass-secret',
    COMPASS_API_URL: 'https://compass.example/v1/chat/completions',
    RISK_RAG_QDRANT_URL: 'https://droplet.example/qdrant',
    RISK_RAG_QDRANT_API_KEY: 'qdrant-secret',
    RISK_RAG_QDRANT_COLLECTION: 'risk_test',
    RISK_RAG_MAX_CHUNKS: '4'
  }, async () => {
    global.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body });
      if (String(url) === 'https://compass.example/v1/embeddings') {
        assert.equal(options.headers.Authorization, 'Bearer compass-secret');
        assert.equal(body.model, 'text-embedding-3-large');
        assert.equal(body.input.length, 1);
        return jsonResponse({
          model: 'text-embedding-3-large',
          data: [{ embedding: [0.1, 0.2, 0.3] }]
        });
      }
      if (String(url) === 'https://droplet.example/qdrant/collections/risk_test') {
        assert.equal(options.headers['api-key'], 'qdrant-secret');
        return jsonResponse({ result: { status: 'green' } });
      }
      if (String(url) === 'https://droplet.example/qdrant/collections/risk_test/points?wait=true') {
        assert.equal(body.points.length, 1);
        assert.deepEqual(body.points[0].vector, [0.1, 0.2, 0.3]);
        assert.equal(body.points[0].payload.caseId, 'case-123');
        assert.equal(body.points[0].payload.evidenceId, 'DOC-1');
        assert.equal(body.points[0].payload.type, 'risk_evidence_chunk');
        assert.match(body.points[0].payload.workspaceId, /^risk-calculator:actor:/);
        return jsonResponse({ result: { operation_id: 1, status: 'completed' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await indexEvidenceServerSide({
      caseId: 'case-123',
      documents: [{
        evidenceId: 'DOC-1',
        title: 'Supplier DPA',
        text: 'The supplier DPA confirms subprocessors, retention, deletion, and cross-border transfer controls.'
      }]
    }, {
      session: { username: 'alex@example.com', role: 'user' }
    });

    assert.equal(result.ok, true);
    assert.equal(result.index.provider, 'qdrant_droplet');
    assert.equal(result.index.browserEmbeddingsRetained, false);
    assert.equal(result.index.actorScoped, true);
    assert.equal(result.chunks.length, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(result.chunks[0], 'embedding'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.chunks[0], 'text'), false);
    assert.equal(calls.filter(call => call.url.includes('/points?wait=true')).length, 1);
  });
});

test('server-side evidence search uses actor-scoped Qdrant filters and returns sanitized citations', async () => {
  const { searchEvidenceServerSide } = require('../../api/_evidenceRag');
  const calls = [];
  const longText = 'Continuity plan and exit assistance evidence. '.repeat(40);

  await withEnv({
    COMPASS_API_KEY: 'compass-secret',
    COMPASS_API_URL: 'https://compass.example/v1/chat/completions',
    RISK_RAG_QDRANT_URL: 'https://droplet.example/qdrant',
    RISK_RAG_QDRANT_COLLECTION: 'risk_test'
  }, async () => {
    global.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url: String(url), method: options.method || 'GET', body });
      if (String(url) === 'https://compass.example/v1/embeddings') {
        assert.deepEqual(body.input, ['continuity evidence']);
        return jsonResponse({
          model: 'text-embedding-3-large',
          data: [{ embedding: [0.4, 0.5, 0.6] }]
        });
      }
      if (String(url) === 'https://droplet.example/qdrant/collections/risk_test/points/search') {
        assert.deepEqual(body.vector, [0.4, 0.5, 0.6]);
        assert.equal(body.limit, 3);
        assert.deepEqual(body.filter.must.map(item => item.key), ['type', 'workspaceId', 'projectId', 'caseId']);
        assert.equal(body.filter.must.find(item => item.key === 'caseId').match.value, 'case-456');
        assert.match(body.filter.must.find(item => item.key === 'workspaceId').match.value, /^risk-calculator:actor:/);
        return jsonResponse({
          result: [{
            score: 0.93,
            payload: {
              type: 'risk_evidence_chunk',
              caseId: 'case-456',
              evidenceId: 'DOC-2',
              documentId: 'DOC-2',
              chunkId: 'DOC-2_CHUNK_001',
              title: 'Continuity evidence',
              text: longText,
              sourceType: 'uploaded_evidence',
              extractionStatus: 'parsed_text',
              tags: ['continuity']
            }
          }]
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await searchEvidenceServerSide({
      caseId: 'case-456',
      query: 'continuity evidence',
      topK: 3
    }, {
      session: { username: 'alex@example.com', role: 'user' }
    });

    assert.equal(result.ok, true);
    assert.equal(result.index.browserEmbeddingsRetained, false);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].evidenceId, 'DOC-2');
    assert.equal(result.matches[0].score, 0.93);
    assert.ok(result.matches[0].text.length <= 700);
    assert.equal(Object.prototype.hasOwnProperty.call(result.matches[0], 'vector'), false);
    assert.equal(calls.filter(call => call.url.endsWith('/points/search')).length, 1);
  });
});

test('evidence RAG health reports missing droplet config without exposing secrets', async () => {
  const { evidenceRagHealth } = require('../../api/_evidenceRag');

  await withEnv({
    COMPASS_API_KEY: '',
    RISK_RAG_QDRANT_URL: '',
    RISK_RAG_QDRANT_API_KEY: ''
  }, async () => {
    const health = evidenceRagHealth();

    assert.equal(health.configured, false);
    assert.equal(health.qdrantConfigured, false);
    assert.equal(health.browserEmbeddingsRetained, false);
    assert.equal(Object.prototype.hasOwnProperty.call(health, 'qdrantApiKey'), false);
  });
});
