'use strict';

(function attachRegisterWorkbookSelector(globalScope) {
  function normalizeSheetName(name = '') {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/^[\d.\-_\s]+/, '')
      .replace(/\s+/g, ' ');
  }

  function isPrimaryRiskRegisterSheetName(name = '') {
    const normalized = normalizeSheetName(name);
    return normalized === 'risk register';
  }

  function isRiskRegisterLikeSheetName(name = '') {
    const normalized = normalizeSheetName(name);
    return normalized.includes('risk register') || (normalized.includes('risk') && normalized.includes('register'));
  }

  function selectRegisterWorkbookSheets(sheetSummaries = []) {
    const sheets = Array.isArray(sheetSummaries) ? sheetSummaries.filter(Boolean) : [];
    const exactMatches = sheets.filter(sheet => isPrimaryRiskRegisterSheetName(sheet.sheetName));
    if (exactMatches.length) {
      return {
        selectedSheets: exactMatches,
        ignoredSheets: sheets.filter(sheet => !exactMatches.includes(sheet)),
        selectionMode: 'exact_risk_register'
      };
    }

    const looseMatches = sheets.filter(sheet => isRiskRegisterLikeSheetName(sheet.sheetName));
    if (looseMatches.length) {
      return {
        selectedSheets: looseMatches,
        ignoredSheets: sheets.filter(sheet => !looseMatches.includes(sheet)),
        selectionMode: 'matching_risk_register'
      };
    }

    return {
      selectedSheets: sheets,
      ignoredSheets: [],
      selectionMode: 'all_sheets'
    };
  }

  const api = {
    normalizeSheetName,
    isPrimaryRiskRegisterSheetName,
    isRiskRegisterLikeSheetName,
    selectRegisterWorkbookSheets
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
