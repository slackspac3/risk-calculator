'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('context follow-up handlers surface no-op AI results without save-ready copy', () => {
  const app = fs.readFileSync('assets/app.js', 'utf8');
  const userSettings = fs.readFileSync('assets/settings/userPreferences.js', 'utf8');
  const adminCompany = fs.readFileSync('assets/admin/adminCompanyContextController.js', 'utf8');

  [app, userSettings, adminCompany].forEach((source) => {
    assert.match(source, /noVisibleChanges/);
    assert.match(source, /No visible changes were produced/);
    assert.match(source, /Retry live AI or edit manually/);
  });
});
