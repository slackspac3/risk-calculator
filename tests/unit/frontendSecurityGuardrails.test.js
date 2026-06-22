'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('organisation and BU render templates escape persisted structure values', () => {
  const appJs = read('assets/app.js');
  const userOnboardingJs = read('assets/settings/userOnboarding.js');

  assert.doesNotMatch(appJs, /value="\$\{defaultName\}"/);
  assert.doesNotMatch(appJs, /value="\$\{defaultWebsite\}"/);
  assert.doesNotMatch(appJs, />\$\{defaultProfile\}<\/textarea>/);
  assert.doesNotMatch(appJs, /<option value="\$\{option\.id\}".*>\$\{option\.name\}/);
  assert.doesNotMatch(appJs, /<option value="\$\{entity\.id\}".*>\$\{entity\.name\}/);
  assert.doesNotMatch(appJs, /<option value="\$\{node\.id\}".*>\$\{node\.name\}/);
  assert.doesNotMatch(appJs, /<strong>\$\{entity\.name\}<\/strong>/);

  assert.match(appJs, /value="\$\{escapeHtml\(defaultName\)\}"/);
  assert.match(appJs, /value="\$\{escapeHtml\(defaultWebsite\)\}"/);
  assert.match(appJs, /parentOptions\.map\(option => `<option value="\$\{escapeHtml\(String\(option\.id \|\| ''\)\)\}"/);
  assert.match(appJs, /getCompanyEntities\(companyStructure\)\.map\(node => `<option value="\$\{escapeHtml\(String\(node\.id \|\| ''\)\)\}"/);
  assert.match(appJs, /`<strong>\$\{escapeHtml\(String\(entity\.name \|\| 'Unnamed entity'\)\)\}<\/strong>`/);

  assert.doesNotMatch(userOnboardingJs, /<option value="\$\{entity\.id\}".*>\$\{entity\.name\}/);
  assert.match(userOnboardingJs, /<option value="\$\{escapeHtml\(String\(entity\.id \|\| ''\)\)\}"/);
});

test('frontend no longer exposes browser admin-secret controls or request headers', () => {
  const authServiceJs = read('assets/services/authService.js');
  const appJs = read('assets/app.js');
  const sharedStateClientJs = read('assets/services/sharedStateClient.js');
  const userAccountsSectionJs = read('assets/admin/userAccountsSection.js');

  for (const [label, source] of [
    ['authService', authServiceJs],
    ['app', appJs],
    ['sharedStateClient', sharedStateClientJs]
  ]) {
    assert.doesNotMatch(source, /headers\[['"]x-admin-secret['"]\]/, `${label} must not attach browser admin secrets`);
  }

  assert.match(authServiceJs, /function getAdminApiSecret\(\) \{\s*clearLegacyAdminSecretStorage\(\);\s*return '';\s*\}/);
  assert.match(authServiceJs, /function setAdminApiSecret\(secret\) \{\s*clearLegacyAdminSecretStorage\(\);\s*return '';\s*\}/);

  assert.doesNotMatch(userAccountsSectionJs, /id="admin-api-secret"/);
  assert.doesNotMatch(userAccountsSectionJs, /Save Admin Secret|Clear Admin Secret|Admin action secret/);
  assert.match(userAccountsSectionJs, /Browser-stored admin secrets are no longer accepted by the frontend\./);
});
