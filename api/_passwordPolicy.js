const crypto = require('crypto');

const PASSWORD_POLICY = {
  minLength: 12
};
const PASSWORD_CHARSETS = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  digits: '23456789',
  special: '!@#$%*-_=+?'
};
const PASSWORD_ALL_CHARS = `${PASSWORD_CHARSETS.lower}${PASSWORD_CHARSETS.upper}${PASSWORD_CHARSETS.digits}${PASSWORD_CHARSETS.special}`;

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

function pickRandomCharacter(pool = '') {
  const source = String(pool || '');
  if (!source) return '';
  return source.charAt(crypto.randomInt(source.length));
}

function shuffleCharacters(characters = []) {
  const items = Array.isArray(characters) ? [...characters] : [];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function generateStrongPassword(length = 16) {
  const targetLength = Math.max(PASSWORD_POLICY.minLength + 2, Number(length) || 16);
  const passwordCharacters = [
    pickRandomCharacter(PASSWORD_CHARSETS.lower),
    pickRandomCharacter(PASSWORD_CHARSETS.upper),
    pickRandomCharacter(PASSWORD_CHARSETS.digits),
    pickRandomCharacter(PASSWORD_CHARSETS.special)
  ];
  while (passwordCharacters.length < targetLength) {
    passwordCharacters.push(pickRandomCharacter(PASSWORD_ALL_CHARS));
  }
  return shuffleCharacters(passwordCharacters).join('');
}

module.exports = {
  PASSWORD_POLICY,
  validatePasswordPolicy,
  generateStrongPassword
};
