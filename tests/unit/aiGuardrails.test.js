'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeText, labelSuggested, buildPromptPayload, buildEnvelope, buildSourceBasis } = require('../../assets/services/aiGuardrails');

test('sanitizeText strips markup-like content and clamps size', () => {
  const value = sanitizeText('<script>alert(1)</script><b>Hello</b>\n\nworld', { maxChars: 20 });
  assert.equal(value.includes('<script>'), false);
  assert.equal(/Hello/.test(value), true);
  assert.equal(value.length <= 20, true);
});

test('labelSuggested adds the suggested draft prefix once', () => {
  assert.equal(labelSuggested('Example output'), 'Suggested draft: Example output');
  assert.equal(labelSuggested('Suggested draft: Example output'), 'Suggested draft: Example output');
});

test('buildPromptPayload truncates oversized prompts safely', () => {
  const payload = buildPromptPayload('system '.repeat(1200), 'user '.repeat(4000), { maxChars: 5000 });
  assert.equal(payload.systemPrompt.length <= 5000, true);
  assert.equal(payload.userPrompt.length <= 5000, true);
  assert.equal(payload.truncated, true);
});

test('buildSourceBasis includes evidence summary, citations, and fallback marker', () => {
  const basis = buildSourceBasis({
    evidenceSummary: 'Evidence used: uploaded notes and 2 official sources.',
    citations: [{ title: 'Incident Postmortem' }],
    uploadedDocumentName: 'notes.md',
    fallbackUsed: true
  });
  assert.deepEqual(basis, [
    'Evidence used: uploaded notes and 2 official sources.',
    'Source reviewed: Incident Postmortem',
    'Uploaded material reviewed: notes.md',
    'Fallback output was used because the live AI response was unavailable or incomplete.'
  ]);
});

test('buildEnvelope returns the standard pilot-safe AI envelope', () => {
  const envelope = buildEnvelope({
    content: { summary: 'Suggested draft: Example summary' },
    confidence: { label: 'Moderate confidence', evidenceQuality: 'Useful evidence base', summary: 'Evidence used: internal notes.' },
    assumptions: ['Control coverage is incomplete.'],
    missingInformation: ['Need validated incident counts.'],
    sourceBasis: ['Evidence used: internal notes.'],
    fallbackUsed: true
  });
  assert.deepEqual(envelope, {
    label: 'Suggested draft',
    content: { summary: 'Suggested draft: Example summary' },
    confidence: {
      label: 'Moderate confidence',
      evidenceQuality: 'Useful evidence base',
      summary: 'Evidence used: internal notes.'
    },
    assumptions: ['Control coverage is incomplete.'],
    missingInformation: ['Need validated incident counts.'],
    sourceBasis: ['Evidence used: internal notes.'],
    fallbackUsed: true
  });
});
