const test = require('node:test');
const assert = require('node:assert/strict');

const { summariseAuditLog } = require('../../api/_audit');

test('summariseAuditLog keeps auth counters separate from action counters', () => {
  const summary = summariseAuditLog([
    { eventType: 'login_success', actorRole: 'admin' },
    { eventType: 'login_failure', actorRole: 'bu_admin' },
    { eventType: 'logout', actorRole: 'user' },
    { eventType: 'settings_update', actorRole: 'admin' },
    { eventType: 'review_escalated', actorRole: 'bu_admin' },
    { eventType: 'assessment_saved', actorRole: 'user' }
  ]);

  assert.equal(summary.loginSuccessCount, 1);
  assert.equal(summary.loginFailureCount, 1);
  assert.equal(summary.logoutCount, 1);
  assert.equal(summary.adminActionCount, 1);
  assert.equal(summary.buAdminActionCount, 1);
  assert.equal(summary.userActionCount, 1);
});
