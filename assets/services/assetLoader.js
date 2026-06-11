(function(globalScope) {
  'use strict';

  const release = globalScope.__RISK_CALCULATOR_RELEASE__ || {};
  const assetVersion = String(release.assetVersion || '20260609v2').trim() || '20260609v2';
  const loadedScripts = new Map();
  const loadedStylesheets = new Map();

  const LOCAL_ASSETS = {
    reportPresentation: 'assets/services/reportPresentation.js',
    metricExplainer: 'assets/services/metricExplainerService.js',
    aiProductState: 'assets/services/aiProductStateService.js',
    exportService: 'assets/services/exportService.js',
    taxonomyData: 'assets/services/scenarioTaxonomyProjectionData.js',
    taxonomyProjection: 'assets/services/scenarioTaxonomyProjection.js',
    dashboard: 'assets/dashboard/userDashboard.js',
    resultsViewModel: 'assets/results/resultsViewModel.js',
    resultsTabs: 'assets/results/resultsTabs.js',
    resultsRoute: 'assets/results/resultsRoute.js',
    assessmentTypeModel: 'assets/state/assessmentTypeModel.js',
    decisionSupportModel: 'assets/state/decisionSupportModel.js',
    projectExposureService: 'assets/services/projectExposureService.js',
    projectParameterSuggestionService: 'assets/services/projectParameterSuggestionService.js',
    draftScenarioState: 'assets/state/draftScenarioState.js',
    step1Assist: 'assets/wizard/step1Assist.js',
    step1: 'assets/wizard/step1.js',
    step2: 'assets/wizard/step2.js',
    step3: 'assets/wizard/step3.js',
    step4: 'assets/wizard/step4.js',
    userOnboarding: 'assets/settings/userOnboarding.js',
    userPreferences: 'assets/settings/userPreferences.js',
    adminOrgSetup: 'assets/admin/orgSetupSection.js',
    adminSystemAccess: 'assets/admin/systemAccessSection.js',
    adminPlatformDefaults: 'assets/admin/platformDefaultsSection.js',
    adminAuditLog: 'assets/admin/auditLogSection.js',
    adminUserAccounts: 'assets/admin/userAccountsSection.js',
    adminDocumentLibrary: 'assets/admin/documentLibrarySection.js',
    adminHome: 'assets/admin/adminHomeSection.js',
    adminAiFeedback: 'assets/admin/aiFeedbackSection.js',
    adminSettings: 'assets/admin/adminSettingsSection.js',
    adminCompanyContextController: 'assets/admin/adminCompanyContextController.js'
  };

  const VENDOR_ASSETS = {
    xlsx: {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw',
      crossOrigin: 'anonymous',
      referrerPolicy: 'no-referrer'
    },
    jspdf: {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk',
      crossOrigin: 'anonymous',
      referrerPolicy: 'no-referrer'
    }
  };

  const ROUTE_ASSETS = {
    taxonomy: [
      LOCAL_ASSETS.taxonomyData,
      LOCAL_ASSETS.taxonomyProjection
    ],
    dashboard: [
      LOCAL_ASSETS.reportPresentation,
      LOCAL_ASSETS.exportService,
      LOCAL_ASSETS.userOnboarding,
      LOCAL_ASSETS.userPreferences,
      LOCAL_ASSETS.dashboard
    ],
    results: [
      LOCAL_ASSETS.assessmentTypeModel,
      LOCAL_ASSETS.decisionSupportModel,
      LOCAL_ASSETS.reportPresentation,
      LOCAL_ASSETS.metricExplainer,
      LOCAL_ASSETS.aiProductState,
      LOCAL_ASSETS.exportService,
      LOCAL_ASSETS.resultsViewModel,
      LOCAL_ASSETS.resultsTabs,
      LOCAL_ASSETS.resultsRoute
    ],
    wizardStep1: [
      LOCAL_ASSETS.assessmentTypeModel,
      LOCAL_ASSETS.aiProductState,
      LOCAL_ASSETS.projectExposureService,
      LOCAL_ASSETS.draftScenarioState,
      LOCAL_ASSETS.taxonomyData,
      LOCAL_ASSETS.taxonomyProjection,
      LOCAL_ASSETS.step1Assist,
      LOCAL_ASSETS.step1
    ],
    wizardStep2: [
      LOCAL_ASSETS.assessmentTypeModel,
      LOCAL_ASSETS.decisionSupportModel,
      LOCAL_ASSETS.aiProductState,
      LOCAL_ASSETS.projectExposureService,
      LOCAL_ASSETS.draftScenarioState,
      LOCAL_ASSETS.step2
    ],
    wizardStep3: [
      LOCAL_ASSETS.assessmentTypeModel,
      LOCAL_ASSETS.projectExposureService,
      LOCAL_ASSETS.projectParameterSuggestionService,
      LOCAL_ASSETS.aiProductState,
      LOCAL_ASSETS.step4,
      LOCAL_ASSETS.step3
    ],
    wizardStep4: [
      LOCAL_ASSETS.assessmentTypeModel,
      LOCAL_ASSETS.decisionSupportModel,
      LOCAL_ASSETS.aiProductState,
      LOCAL_ASSETS.projectExposureService,
      LOCAL_ASSETS.projectParameterSuggestionService,
      LOCAL_ASSETS.draftScenarioState,
      LOCAL_ASSETS.step4
    ],
    settings: [
      LOCAL_ASSETS.userOnboarding,
      LOCAL_ASSETS.userPreferences
    ],
    admin: [
      LOCAL_ASSETS.reportPresentation,
      LOCAL_ASSETS.exportService,
      LOCAL_ASSETS.adminOrgSetup,
      LOCAL_ASSETS.adminSystemAccess,
      LOCAL_ASSETS.adminPlatformDefaults,
      LOCAL_ASSETS.adminAuditLog,
      LOCAL_ASSETS.adminUserAccounts,
      LOCAL_ASSETS.adminDocumentLibrary,
      LOCAL_ASSETS.adminHome,
      LOCAL_ASSETS.adminAiFeedback,
      LOCAL_ASSETS.adminSettings,
      LOCAL_ASSETS.adminCompanyContextController
    ],
    xlsx: [VENDOR_ASSETS.xlsx],
    jspdf: [VENDOR_ASSETS.jspdf]
  };

  function isRemoteAsset(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  function normalizeAssetDescriptor(asset) {
    if (asset && typeof asset === 'object') {
      return {
        src: String(asset.src || '').trim(),
        integrity: String(asset.integrity || '').trim(),
        crossOrigin: String(asset.crossOrigin || '').trim(),
        referrerPolicy: String(asset.referrerPolicy || '').trim(),
        timeoutMs: asset.timeoutMs
      };
    }
    return { src: String(asset || '').trim() };
  }

  function versionedUrl(url) {
    const source = String(url || '').trim();
    if (!source || isRemoteAsset(source) || /[?&]v=/.test(source)) return source;
    return `${source}?v=${encodeURIComponent(assetVersion)}`;
  }

  function hasGlobal(globalName) {
    if (!globalName) return false;
    return globalName.split('.').reduce((scope, part) => scope && scope[part], globalScope) != null;
  }

  function loadScriptOnce(src, options = {}) {
    const url = versionedUrl(src);
    const globalName = String(options.globalName || '').trim();
    if (!url) return Promise.reject(new Error('Script source is required.'));
    if (globalName && hasGlobal(globalName)) return Promise.resolve(url);
    if (loadedScripts.has(url)) return loadedScripts.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts || []).find(script => script.src && script.src.includes(url));
      if (existing && !existing.dataset.assetLoaderPending) {
        resolve(url);
        return;
      }

      const script = existing || document.createElement('script');
      let timeoutId = null;
      script.dataset.assetLoaderPending = 'true';
      script.async = false;
      if (options.integrity) script.integrity = options.integrity;
      if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
      if (options.referrerPolicy) script.referrerPolicy = options.referrerPolicy;
      script.src = url;
      script.onload = () => {
        window.clearTimeout(timeoutId);
        delete script.dataset.assetLoaderPending;
        resolve(url);
      };
      script.onerror = () => {
        window.clearTimeout(timeoutId);
        loadedScripts.delete(url);
        delete script.dataset.assetLoaderPending;
        reject(new Error(`Failed to load script: ${url}`));
      };
      timeoutId = window.setTimeout(() => {
        loadedScripts.delete(url);
        reject(new Error(`Timed out loading script: ${url}`));
      }, Number(options.timeoutMs || 30000));
      if (!existing) document.head.appendChild(script);
    });

    loadedScripts.set(url, promise);
    return promise;
  }

  function loadStylesheetOnce(href, options = {}) {
    const url = versionedUrl(href);
    if (!url) return Promise.reject(new Error('Stylesheet href is required.'));
    if (loadedStylesheets.has(url)) return loadedStylesheets.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => link.href && link.href.includes(url));
      if (existing) {
        resolve(url);
        return;
      }
      const link = document.createElement('link');
      let timeoutId = null;
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => {
        window.clearTimeout(timeoutId);
        resolve(url);
      };
      link.onerror = () => {
        window.clearTimeout(timeoutId);
        loadedStylesheets.delete(url);
        reject(new Error(`Failed to load stylesheet: ${url}`));
      };
      timeoutId = window.setTimeout(() => {
        loadedStylesheets.delete(url);
        reject(new Error(`Timed out loading stylesheet: ${url}`));
      }, Number(options.timeoutMs || 30000));
      document.head.appendChild(link);
    });

    loadedStylesheets.set(url, promise);
    return promise;
  }

  async function loadRouteAssets(routeKey) {
    const key = String(routeKey || '').trim();
    const assets = ROUTE_ASSETS[key] || [];
    for (const asset of assets) {
      const descriptor = normalizeAssetDescriptor(asset);
      await loadScriptOnce(descriptor.src, descriptor);
    }
    return assets.map(asset => versionedUrl(normalizeAssetDescriptor(asset).src));
  }

  function isScriptLoaded(src) {
    const url = versionedUrl(src);
    return loadedScripts.has(url) || Array.from(document.scripts || []).some(script => script.src && script.src.includes(url));
  }

  const api = {
    assetVersion,
    localAssets: Object.freeze({ ...LOCAL_ASSETS }),
    vendorAssets: Object.freeze(Object.fromEntries(Object.entries(VENDOR_ASSETS).map(([key, value]) => [key, Object.freeze({ ...value })]))),
    routeAssets: Object.freeze(Object.fromEntries(Object.entries(ROUTE_ASSETS).map(([key, value]) => [key, value.slice()]))),
    loadScriptOnce,
    loadStylesheetOnce,
    loadRouteAssets,
    isScriptLoaded,
    versionedUrl
  };

  globalScope.AppAssetLoader = api;
})(window);
