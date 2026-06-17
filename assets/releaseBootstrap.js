'use strict';

(function bootstrapReleaseMetadata() {
  const release = Object.freeze({
    version: '0.10.0-pilot.1',
    channel: 'pilot',
    build: '2026-06-17-structured-ai-response',
    assetVersion: '20260617v5',
    apiOrigin: 'https://risk-calculator-eight.vercel.app'
  });

  if (typeof globalThis !== 'undefined' && globalThis) {
    globalThis.__RISK_CALCULATOR_RELEASE__ = release;
  }
})();
