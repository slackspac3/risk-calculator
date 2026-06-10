#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const evalReportPath = 'test-results/eval/qa-release-report.json';

const APP_INTEGRITY_STEPS = [
  {
    label: 'Syntax checks',
    command: npmCommand,
    args: ['run', 'check:syntax']
  },
  {
    label: 'Taxonomy projection consistency',
    command: npmCommand,
    args: ['run', 'check:taxonomy-projection']
  },
  {
    label: 'Static smoke guardrails',
    command: npmCommand,
    args: ['run', 'check:smoke']
  },
  {
    label: 'State staleness guardrails',
    command: npmCommand,
    args: ['run', 'check:staleness']
  },
  {
    label: 'Unit tests',
    command: npmCommand,
    args: ['run', 'test:unit']
  },
  {
    label: 'Eval fixture contract',
    command: npmCommand,
    args: ['run', 'test:eval:fixture']
  },
  {
    label: 'Documentation consistency scan',
    command: process.execPath,
    args: ['scripts/readme-scan.js']
  },
  {
    label: 'Full Playwright suite',
    command: npmCommand,
    args: ['run', 'test:e2e']
  }
];

const AI_QUALITY_STEPS = [
  {
    label: 'Deterministic local AI/RAG eval',
    command: npmCommand,
    args: ['run', 'eval:local', '--', '--output', evalReportPath]
  },
  {
    label: 'AI/RAG release thresholds',
    command: process.execPath,
    args: ['scripts/check-eval-thresholds.js', '--report', evalReportPath]
  }
];

function runStep(step) {
  process.stdout.write(`\n==> ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.signal) {
    process.exit(1);
  }
}

function runSteps(steps, successMessage = '') {
  steps.forEach(runStep);
  if (successMessage) {
    process.stdout.write(`\n${successMessage}\n`);
  }
}

module.exports = {
  AI_QUALITY_STEPS,
  APP_INTEGRITY_STEPS,
  evalReportPath,
  runSteps
};
