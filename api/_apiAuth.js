const { parseSessionToken } = require('./_audit');

function buildErrorPayload(code, message, extra = {}) {
  return {
    error: {
      code: String(code || 'REQUEST_FAILED'),
      message: String(message || 'The request could not be completed.')
    },
    ...extra
  };
}

function sendApiError(res, status, code, message, extra = {}) {
  res.status(Number(status || 500)).json(buildErrorPayload(code, message, extra));
}

function validateSessionFromRequest(req) {
  const token = String(req.headers['x-session-token'] || '').trim();
  if (!token) {
    return {
      session: null,
      error: { status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in and try again.' }
    };
  }
  const parsed = parseSessionToken(token);
  if (parsed.valid) {
    return { session: parsed.payload, error: null };
  }
  if (parsed.reason === 'expired') {
    return {
      session: null,
      error: { status: 401, code: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' }
    };
  }
  return {
    session: null,
    error: { status: 401, code: 'INVALID_SESSION', message: 'Please sign in and try again.' }
  };
}

function requireSession(req, res, options = {}) {
  const validation = validateSessionFromRequest(req);
  if (validation.error) {
    sendApiError(res, validation.error.status, validation.error.code, validation.error.message);
    return null;
  }
  const allowedRoles = Array.isArray(options.roles) ? options.roles.filter(Boolean) : [];
  if (allowedRoles.length && !allowedRoles.includes(validation.session.role)) {
    sendApiError(res, 403, 'FORBIDDEN', options.forbiddenMessage || 'You are not allowed to perform this action.');
    return null;
  }
  return validation.session;
}

function resolveAdminActor(req, res, { isAdminSecretValid, allowRoles = ['admin'], forbiddenMessage = 'You are not allowed to perform this action.' } = {}) {
  if (typeof isAdminSecretValid === 'function' && isAdminSecretValid(req)) {
    return {
      username: 'admin',
      role: 'admin',
      authType: 'admin_secret'
    };
  }
  return requireSession(req, res, {
    roles: allowRoles,
    forbiddenMessage
  });
}

module.exports = {
  buildErrorPayload,
  sendApiError,
  validateSessionFromRequest,
  requireSession,
  resolveAdminActor
};
