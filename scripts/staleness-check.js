#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function expect(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(message);
}

function extractFunctionBody(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  let parenDepth = 0;
  let openBrace = -1;
  const firstParen = source.indexOf('(', start);
  if (firstParen < 0) return '';
  for (let index = firstParen; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      openBrace = source.indexOf('{', index);
      break;
    }
  }
  if (openBrace < 0) return '';
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }
  return '';
}

const step1Js = read('assets/wizard/step1.js');
const assessmentStateJs = read('assets/state/assessmentState.js');
const e2eSmokeSpecJs = read('tests/e2e/smoke.spec.js');

expect(
  !/Object\.keys\(\s*(sessionStorage|localStorage)\s*\)/.test(e2eSmokeSpecJs),
  'E2E tests must not enumerate Web Storage with Object.keys(sessionStorage/localStorage); use Storage.length + Storage.key(index).'
);
expect(
  !/Object\.keys\(\s*store\s*\)/.test(e2eSmokeSpecJs),
  'E2E tests must not enumerate a Web Storage handle with Object.keys(store); use Storage.length + Storage.key(index).'
);

expect(
  e2eSmokeSpecJs.includes('wizard assessment type router stores selection before intake')
    && e2eSmokeSpecJs.includes('page.waitForFunction')
    && e2eSmokeSpecJs.includes('store.key(index)')
    && e2eSmokeSpecJs.includes("key.startsWith('rq_draft__')")
    && e2eSmokeSpecJs.includes("draft?.assessmentType === 'project_buyer'"),
  'Assessment type router e2e coverage must wait for the persisted draft using deterministic Web Storage enumeration.'
);

const selectAssessmentTypeBody = extractFunctionBody(step1Js, 'selectStep1AssessmentType');
expect(
  selectAssessmentTypeBody.includes('saveDraft();') && selectAssessmentTypeBody.indexOf('saveDraft();') < selectAssessmentTypeBody.indexOf('Router.navigate(nextRoute)'),
  'selectStep1AssessmentType must save the draft before routing to the next wizard screen.'
);
expect(
  selectAssessmentTypeBody.includes('applyAssessmentTypeSelectionToDraft(AppState.draft, targetType)')
    && selectAssessmentTypeBody.includes('projectRole'),
  'selectStep1AssessmentType must update assessment type and project role before persistence.'
);

const saveDraftBody = extractFunctionBody(assessmentStateJs, 'saveDraft');
expect(
  saveDraftBody.includes('sessionStorage.setItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX)')
    && saveDraftBody.includes('buildSessionDraftPayload(AppState.draft, savedAt)'),
  'saveDraft must persist the current draft to the scoped session storage payload.'
);
expect(
  saveDraftBody.includes("window.dispatchEvent(new CustomEvent('rq:draft-saved'")
    && saveDraftBody.indexOf('sessionStorage.setItem') < saveDraftBody.indexOf("window.dispatchEvent(new CustomEvent('rq:draft-saved'"),
  'saveDraft must emit rq:draft-saved only after the browser storage write is attempted.'
);

if (failures.length) {
  console.error('Staleness guardrails failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Staleness guardrails passed. ${passed} checks passed.`);
