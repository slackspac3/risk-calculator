'use strict';

(function bootstrapReleaseMetadata() {
  const release = Object.freeze({
    version: '0.10.0-pilot.1',
    channel: 'pilot',
    build: '2026-06-17-context-refinement-copy',
    assetVersion: '20260617v4',
    apiOrigin: 'https://risk-calculator-eight.vercel.app'
  });

  if (typeof globalThis !== 'undefined' && globalThis) {
    globalThis.__RISK_CALCULATOR_RELEASE__ = release;
  }
})();
