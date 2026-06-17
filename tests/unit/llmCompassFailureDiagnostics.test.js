'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function configureLocalDirectCompass(service) {
  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });
}

test('failed Compass transport requests are captured in the admin diagnostics log', async () => {
  let fetchCount = 0;
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async () => {
      fetchCount += 1;
      return {
        ok: false,
        status: 502,
        text: async () => `upstream gateway dropped chunk ${fetchCount}`
      };
    }
  });

  configureLocalDirectCompass(service);

  await assert.rejects(
    () => service.testCompassConnection(),
    /LLM API error 502/i
  );

  const entries = service.readAdminCompassFailureLog();
  assert.equal(entries.length, 1);
  assert.equal(fetchCount, 2);
  assert.equal(entries[0].callType, 'direct_compass');
  assert.equal(entries[0].stage, 'http');
  assert.equal(entries[0].statusCode, 502);
  assert.equal(entries[0].attemptCount, 2);
  assert.equal(entries[0].model, 'gpt-local-test');
  assert.equal(entries[0].promptTruncated, false);
  assert.match(String(entries[0].responsePreview || ''), /upstream gateway dropped chunk/i);
  assert.match(String(entries[0].promptSummary || ''), /connectivity check/i);
  assert.equal(entries[0].systemPromptChars > 0, true);
  assert.equal(entries[0].userPromptChars > 0, true);

  service.clearAdminCompassFailureLog();
  assert.equal(service.readAdminCompassFailureLog().length, 0);
});

test('structured-response failures are captured with raw preview and repair diagnostics', async () => {
  let fetchCount = 0;
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"workingContext":"Role context","preferredOutputs":"Board-ready outputs"'
                }
              }
            ]
          })
        };
      }
      return {
        ok: false,
        status: 502,
        text: async () => 'repair attempt lost the upstream response body'
      };
    }
  });

  configureLocalDirectCompass(service);

  await assert.rejects(
    () => service.buildUserPreferenceAssist({
      userProfile: {
        jobTitle: 'Risk Manager',
        businessUnit: 'Operations',
        department: 'Resilience'
      },
      organisationContext: {
        geography: 'UAE'
      },
      currentSettings: {
        applicableRegulations: ['ISO 22301']
      }
    }),
    (error) => {
      assert.equal(error?.code, 'LLM_UNAVAILABLE');
      return true;
    }
  );

  const entries = service.readAdminCompassFailureLog();
  const parseEntry = entries.find((entry) => entry.taskName === 'buildUserPreferenceAssist' && entry.stage === 'structured_parse');
  assert.ok(parseEntry, 'expected a structured_parse diagnostics entry');
  assert.match(String(parseEntry.responsePreview || ''), /workingContext/i);
  assert.match(String(parseEntry.diagnostic || ''), /Repair attempt failed/i);
  assert.match(String(parseEntry.requestPreview || ''), /Risk Manager/i);
  assert.equal(typeof parseEntry.promptTruncated, 'boolean');

  const repairTransportEntry = entries.find((entry) => entry.stage === 'http' && entry.statusCode === 502);
  assert.ok(repairTransportEntry, 'expected the repair transport failure to be logged');
});

test('entity context refinement accepts structured function-call arguments', async () => {
  const payload = {
    geography: 'UAE',
    contextSummary: 'Healthcare operations covering clinics, hospitals, diagnostics, genomics, digital health, and Diaverum in the UAE.',
    riskAppetiteStatement: 'Maintain low appetite for patient safety, regulated health data, continuity, and ADHICS compliance failures.',
    applicableRegulations: ['ADHICS'],
    aiInstructions: 'Ground future assessments in UAE healthcare operations, regulated health data, and ADHICS obligations.',
    benchmarkStrategy: 'Use healthcare continuity, privacy, diagnostics, and regulated clinical operations as benchmark anchors.',
    responseMessage: 'Added the UAE healthcare mix, Diaverum ownership, and ADHICS obligation to the retained context.'
  };
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              function_call: {
                name: 'refine_entity_context',
                arguments: JSON.stringify(payload)
              }
            }
          }
        ]
      })
    })
  });

  configureLocalDirectCompass(service);

  const result = await service.refineEntityContext({
    entity: { name: 'M42 UAE', type: 'Business Unit' },
    currentContext: {
      geography: 'UAE',
      contextSummary: 'Healthcare business.',
      applicableRegulations: []
    },
    userPrompt: 'It has frontline clinics, hospitals, diagnostics labs, genomics, digital health, Diaverum, and is subject to ADHICS.'
  });

  assert.equal(result.geography, 'UAE');
  assert.match(result.contextSummary, /Diaverum/i);
  assert.deepEqual(result.applicableRegulations, ['ADHICS']);
  assert.match(result.aiInstructions, /ADHICS/i);
  assert.equal(result.aiUnavailable, undefined);
});

test('entity context refinement requests JSON mode with enough completion budget', async () => {
  const requests = [];
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (...args) => {
      requests.push(JSON.parse(args[1].body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  geography: 'UAE',
                  contextSummary: 'Healthcare operations in the UAE, including hospitals, clinics, diagnostics, genomics, digital health, and Diaverum.',
                  riskAppetiteStatement: 'Low appetite for ADHICS, patient-safety, regulated data, and continuity failures.',
                  applicableRegulations: ['ADHICS'],
                  aiInstructions: 'Use ADHICS and UAE healthcare operations as grounding context.',
                  benchmarkStrategy: 'Benchmark against healthcare continuity, privacy, and regulated clinical operations.',
                  responseMessage: 'Updated the context with UAE healthcare operations and ADHICS obligations.'
                })
              }
            }
          ]
        })
      };
    }
  });

  configureLocalDirectCompass(service);

  await service.refineEntityContext({
    entity: { name: 'M42 UAE', type: 'Business Unit' },
    currentContext: { geography: 'UAE', contextSummary: 'Healthcare business.' },
    userPrompt: 'It has frontline clinics, hospitals, diagnostics labs, genomics, digital health, Diaverum, and is subject to ADHICS.'
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].response_format, { type: 'json_object' });
  assert.equal(requests[0].temperature, 0);
  assert.equal(requests[0].max_completion_tokens >= 1400, true);
});

test('failed AI audit rows capture truncation status and raised prompt limit', async () => {
  const auditEvents = [];
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      text: async () => 'upstream gateway dropped entity context request'
    }),
    extraContext: {
      logAuditEvent: async (event) => {
        auditEvents.push(event);
      }
    }
  });

  configureLocalDirectCompass(service);

  await assert.rejects(
    () => service.buildEntityContext({
      entity: { name: 'ESG', type: 'Department / Function' },
      parentEntity: {
        name: 'Corporate Services',
        profile: 'Sustainability governance context. '.repeat(1600)
      },
      parentLayer: {
        contextSummary: 'Parent context summary. '.repeat(800),
        applicableRegulations: ['IFRS S1', 'IFRS S2']
      },
      uploadedText: 'Uploaded evidence. '.repeat(1600),
      adminSettings: {
        geography: 'UAE',
        applicableRegulations: ['IFRS S1', 'IFRS S2'],
        aiInstructions: 'Refine context carefully.'
      }
    }),
    /LLM API error 502/i
  );

  const failedEvent = auditEvents.find((event) => event?.eventType === 'ai_request_failed');
  const fallbackEvent = auditEvents.find((event) => event?.eventType === 'ai_fallback_used');

  assert.ok(failedEvent, 'expected ai_request_failed audit event');
  assert.ok(fallbackEvent, 'expected ai_fallback_used audit event');
  assert.equal(failedEvent.details.taskName, 'buildEntityContext');
  assert.equal(failedEvent.details.promptTruncated, true);
  assert.equal(failedEvent.details.promptLimit, 28000);
  assert.equal(failedEvent.details.failureStage, 'http');
  assert.equal(fallbackEvent.details.promptTruncated, true);
  assert.equal(fallbackEvent.details.promptLimit, 28000);
});
