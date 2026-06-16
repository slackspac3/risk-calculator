'use strict';

(function bootstrapReleaseMetadata() {
  const release = Object.freeze({
    version: '0.10.0-pilot.1',
    channel: 'pilot',
    build: '2026-06-16-stitch-step12',
    assetVersion: '20260616v1',
    apiOrigin: 'https://risk-calculator-eight.vercel.app'
  });

  if (typeof globalThis !== 'undefined' && globalThis) {
    globalThis.__RISK_CALCULATOR_RELEASE__ = release;
  }
})();
