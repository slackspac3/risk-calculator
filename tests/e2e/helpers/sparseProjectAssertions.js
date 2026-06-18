'use strict';

const { expect } = require('@playwright/test');

function expectSparseBuyerExposurePayload(payload) {
  expect(payload.assessmentType).toBe('project_buyer');
  expect(payload.buyerEconomics.approvedBudget).toBe(1000000);
  expect(payload.buyerEconomics.delayCostPerDay ?? null).toBeNull();
  expect(payload.buyerEconomicsMeta.delayCostPerDay?.status || 'unknown').toBe('unknown');
  expect(payload.buyerProxyAnswers.likelyDelay).toBe('weeks');
  expect(payload.buyerProxyAnswers.supplierReplacementDifficulty).toBe('hard');
  expect(JSON.stringify(payload.buyerEconomics)).not.toContain('"delayCostPerDay":0');
}

async function expectSparseProjectExposurePanel(exposurePanel) {
  await expect(exposurePanel).toContainText(/Live AI/i);
  await expect(exposurePanel).toContainText(/Thin project economics/i);
  await expect(exposurePanel).toContainText(/Unknown/i);
  await expect(exposurePanel).toContainText(/Delay cost/i);
  await expect(exposurePanel).toContainText(/What is the approximate business cost per day/i);
  await expect(exposurePanel).not.toContainText(/\$0\b/);
}

function expectSparseBuyerDraftState(draft, { requireMeta = false, requireFingerprint = false } = {}) {
  expect(draft.buyerEconomics.delayCostPerDay).toBeNull();
  if (requireMeta) {
    expect(draft.buyerEconomicsMeta.delayCostPerDay.status).toBe('unknown');
  }
  expect(draft.projectExposure.financialDrivers.find(driver => driver.id === 'buyer-delay-cost').likely).toBeNull();
  if (requireFingerprint) {
    expect(draft.projectExposure.inputFingerprintBreakdown?.categories?.projectFinancialValues).toBeTruthy();
  }
}

async function expectReviewAndRunProjectGap(page, label = /Delay cost/i) {
  const projectFairPanel = page.locator('details').filter({ hasText: /Project financial exposure and FAIR parameters/i }).first();
  await expect(projectFairPanel).toBeVisible({ timeout: 10000 });
  await projectFairPanel.evaluate(node => {
    node.open = true;
  });
  await expect(projectFairPanel).toContainText(/Parameter gap/i);
  await expect(projectFairPanel).toContainText(label);
  await expect(projectFairPanel).toContainText(/Not quantified/i);
  await expect(projectFairPanel).toContainText(/not treated as zero/i);
}

module.exports = {
  expectReviewAndRunProjectGap,
  expectSparseBuyerDraftState,
  expectSparseBuyerExposurePayload,
  expectSparseProjectExposurePanel
};
