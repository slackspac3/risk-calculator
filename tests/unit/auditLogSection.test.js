'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAuditLogSection() {
  const filePath = path.resolve(__dirname, '../../assets/admin/auditLogSection.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const context = {
    escapeHtml(value = '') {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    formatOperationalDateTime(value, { fallback = 'Unknown time' } = {}) {
      return String(value || '').trim() || fallback;
    },
    formatRelativePilotTime() {
      return 'just now';
    },
    renderLiveTimestampValue() {
      return '<strong>just now</strong>';
    },
    renderSettingsSection({ title = '', body = '' } = {}) {
      return `<section><h2>${title}</h2>${body}</section>`;
    },
    formatAuditDetails(details = {}) {
      return Object.keys(details || {}).join(', ');
    },
    UI: {
      adminTableCard({ title = '', table = '', description = '' } = {}) {
        return `<div class="table-card"><h3>${title}</h3><p>${description}</p>${table}</div>`;
      },
      toast() {}
    },
    AppState: {
      clientRuntimeErrors: [],
      auditLogCache: { loaded: true, loading: false, entries: [], summary: {}, error: '', lastLoadedAt: 0 }
    },
    loadAuditLog: async () => ({ entries: [], summary: {} })
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__auditSection = AdminAuditLogSection;`, context, { filename: 'auditLogSection.js' });
  return context.__auditSection;
}

test('audit log section tolerates malformed live entries without throwing', () => {
  const section = loadAuditLogSection();
  const markup = section.renderSection({
    auditCache: {
      loaded: true,
      loading: false,
      entries: [
        null,
        'legacy-string-row',
        { id: 'evt-1', eventType: 'settings_update', actorRole: 'admin', actorUsername: 'admin.user', details: ['bad-shape'] },
        { id: 'evt-2', ts: '2026-04-14T10:00:00.000Z', eventType: 'login_success', actorRole: 'admin', actorUsername: 'admin.user', details: { reason: 'ok' } }
      ],
      summary: null,
      error: '',
      lastLoadedAt: 0
    }
  });

  assert.match(markup, /Activity Log/);
  assert.match(markup, /settings_update/);
  assert.match(markup, /login_success/);
});
