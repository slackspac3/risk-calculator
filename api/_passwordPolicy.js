const PASSWORD_POLICY = {
  minLength: 12
};

function validatePasswordPolicy(password = '') {
  const value = String(password || '');
  const issues = [];
  if (value.length < PASSWORD_POLICY.minLength) issues.push(`Use at least ${PASSWORD_POLICY.minLength} characters.`);
  if (!/[a-z]/.test(value)) issues.push('Include a lowercase letter.');
  if (!/[A-Z]/.test(value)) issues.push('Include an uppercase letter.');
  if (!/[0-9]/.test(value)) issues.push('Include a number.');
  if (!/[^A-Za-z0-9]/.test(value)) issues.push('Include a special character.');
  if (/\s/.test(value)) issues.push('Do not use spaces.');
  return {
    valid: issues.length === 0,
    issues
  };
}

function generateStrongPassword() {
  const randomBlock = Math.floor(100000 + Math.random() * 900000);
  return `PilotRisk!${randomBlock}Aa`;
}

module.exports = {
  PASSWORD_POLICY,
  validatePasswordPolicy,
  generateStrongPassword
};
