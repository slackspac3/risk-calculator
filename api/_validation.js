'use strict';

/**
 * Lightweight request body validation for API boundaries.
 * Zero external dependencies — uses only built-in Node.js primitives.
 *
 * Usage:
 *   const { errors } = validateBody(body, {
 *     riskStatement: { type: 'string', maxLength: 5000 },
 *     iterations:    { type: 'number', min: 100, max: 100000 },
 *     tags:          { type: 'array', maxItems: 50 },
 *     options:       { type: 'object' },
 *     enabled:       { type: 'boolean' }
 *   });
 */

function validateBody(body, schema) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'] };
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];

    // Skip optional fields that are absent or null
    if ((value === undefined || value === null) && !rules.required) continue;

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }

    // Type checking
    if (rules.type) {
      const valid = checkType(value, rules.type);
      if (!valid) {
        errors.push(`Field "${field}" must be of type ${rules.type}.`);
        continue;
      }
    }

    // String constraints
    if (rules.type === 'string' && typeof value === 'string') {
      if (typeof rules.maxLength === 'number' && value.length > rules.maxLength) {
        errors.push(`Field "${field}" exceeds maximum length of ${rules.maxLength}.`);
      }
      if (typeof rules.minLength === 'number' && value.length < rules.minLength) {
        errors.push(`Field "${field}" must be at least ${rules.minLength} characters.`);
      }
      if (rules.pattern instanceof RegExp && !rules.pattern.test(value)) {
        errors.push(`Field "${field}" has an invalid format.`);
      }
      if (Array.isArray(rules.enum) && !rules.enum.includes(value)) {
        errors.push(`Field "${field}" must be one of: ${rules.enum.join(', ')}.`);
      }
    }

    // Number constraints
    if (rules.type === 'number' && typeof value === 'number') {
      if (!Number.isFinite(value)) {
        errors.push(`Field "${field}" must be a finite number.`);
      } else {
        if (typeof rules.min === 'number' && value < rules.min) {
          errors.push(`Field "${field}" must be at least ${rules.min}.`);
        }
        if (typeof rules.max === 'number' && value > rules.max) {
          errors.push(`Field "${field}" must be at most ${rules.max}.`);
        }
      }
    }

    // Array constraints
    if (rules.type === 'array' && Array.isArray(value)) {
      if (typeof rules.maxItems === 'number' && value.length > rules.maxItems) {
        errors.push(`Field "${field}" exceeds maximum of ${rules.maxItems} items.`);
      }
      if (typeof rules.minItems === 'number' && value.length < rules.minItems) {
        errors.push(`Field "${field}" must have at least ${rules.minItems} items.`);
      }
      if (rules.itemType === 'string') {
        const badIndex = value.findIndex(item => typeof item !== 'string');
        if (badIndex !== -1) {
          errors.push(`Field "${field}[${badIndex}]" must be a string.`);
        }
      }
      if (rules.itemMaxLength && rules.itemType === 'string') {
        const badIndex = value.findIndex(item => typeof item === 'string' && item.length > rules.itemMaxLength);
        if (badIndex !== -1) {
          errors.push(`Item in "${field}" exceeds maximum length of ${rules.itemMaxLength}.`);
        }
      }
    }
  }

  return { errors };
}

function checkType(value, type) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return !!value && typeof value === 'object' && !Array.isArray(value);
    default: return true;
  }
}

module.exports = { validateBody };
