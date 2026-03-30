(function(globalScope) {
  'use strict';

  const CANONICAL_SCENARIO_FIELDS = Object.freeze([
    'assetService',
    'primaryDriver',
    'eventPath',
    'effect'
  ]);

  const LEGACY_FIELD_MAP = Object.freeze({
    threatCommunity: 'primaryDriver',
    attackType: 'eventPath'
  });

  function _isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function _cleanScenarioText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function _resolveCanonicalScenarioValue(source = {}, field = '') {
    if (!_isPlainObject(source)) return '';
    const requested = String(field || '').trim();
    if (!requested) return '';
    const canonicalField = LEGACY_FIELD_MAP[requested] || requested;
    const directValue = _cleanScenarioText(source[canonicalField]);
    if (directValue) return directValue;
    const legacyField = Object.keys(LEGACY_FIELD_MAP).find(key => LEGACY_FIELD_MAP[key] === canonicalField);
    return legacyField ? _cleanScenarioText(source[legacyField]) : '';
  }

  function normaliseStructuredScenario(source, { preserveUnknown = false } = {}) {
    if (!_isPlainObject(source)) return null;
    const next = preserveUnknown ? { ...source } : {};
    CANONICAL_SCENARIO_FIELDS.forEach((field) => {
      const value = _resolveCanonicalScenarioValue(source, field);
      if (value) next[field] = value;
      else delete next[field];
    });
    delete next.threatCommunity;
    delete next.attackType;
    const hasContent = CANONICAL_SCENARIO_FIELDS.some(field => _cleanScenarioText(next[field]));
    return hasContent ? next : null;
  }

  function getStructuredScenarioField(source, field) {
    return _resolveCanonicalScenarioValue(source, field);
  }

  function countStructuredScenarioFields(source, fields = CANONICAL_SCENARIO_FIELDS) {
    const list = Array.isArray(fields) ? fields : CANONICAL_SCENARIO_FIELDS;
    return list.filter(field => getStructuredScenarioField(source, field)).length;
  }

  function hasStructuredScenario(source) {
    return countStructuredScenarioFields(source) > 0;
  }

  const exported = {
    CANONICAL_SCENARIO_FIELDS,
    LEGACY_FIELD_MAP,
    normaliseStructuredScenario,
    getStructuredScenarioField,
    countStructuredScenarioFields,
    hasStructuredScenario
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  globalScope.StructuredScenarioModel = exported;
  Object.assign(globalScope, exported);
})(typeof window !== 'undefined' ? window : globalThis);
