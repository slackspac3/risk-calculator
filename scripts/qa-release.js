#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const evalReportPath = 'test-results/eval/qa-release-report.json';

const steps = [
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
  },
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

for (const step of steps) {
  runStep(step);
}

process.stdout.write('\nQA release gate passed.\n');
