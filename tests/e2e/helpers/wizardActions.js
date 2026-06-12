'use strict';

async function startBuyerProjectAssessment(page, expect) {
  await page.goto('/#/wizard/1');
  await expect(page.getByRole('heading', { name: /what are you assessing/i })).toBeVisible({ timeout: 10000 });
  const current = page.locator('.app-stage-shell.is-current');
  await current.locator('[data-assessment-type="project_buyer"]').click();
  await expect(page).toHaveURL(/#\/wizard\/2$/);
  const active = page.locator('.app-stage-shell.is-current');
  await expect(active.locator('.step1-route-inputs--buyer')).toBeVisible({ timeout: 10000 });
  return active;
}

async function fillSparseBuyerProjectIntake(active) {
  await active.locator('#guided-event').fill('The implementation partner may miss the go-live date for a customer onboarding platform.');
  await active.locator('#guided-impact').fill('Delayed customer launch, operational workarounds, and replacement supplier pressure.');
  await active.locator('#project-name').fill('Customer onboarding platform rollout');
  await active.locator('#project-supplier').fill('Implementation partner');
  await active.locator('#project-stage').fill('Implementation');
  await active.locator('#project-main-consequence').fill('Go-live is delayed and the team may need to replace the supplier.');
  await active.locator('#step1-buyer-approvedBudget').fill('1000000');
  await active.locator('#step1-buyer-proxy-mainImpact').selectOption('delay');
  await active.locator('#step1-buyer-proxy-likelyDelay').selectOption('weeks');
  await active.locator('#step1-buyer-proxy-supplierReplacementDifficulty').selectOption('hard');
  await active.locator('#step1-buyer-proxy-criticalPath').selectOption('yes');
}

async function generateProjectExposureMap(active, expect, { requestCount }) {
  const exposurePanel = active.locator('[data-project-exposure-panel="buyer"]');
  await expect(exposurePanel).toContainText(/Unknown high-impact inputs/i);
  await expect(exposurePanel).toContainText(/Delay cost per day/i);
  const generateButton = exposurePanel.locator('[data-project-exposure-action="generate"]');
  await generateButton.scrollIntoViewIfNeeded();
  await generateButton.click();
  await expect.poll(requestCount).toBeGreaterThan(0);
  return exposurePanel;
}

async function continueToReviewAndRun(page, expect, exposurePanel) {
  await exposurePanel.locator('[data-project-exposure-action="continue"]').click();
  await page.getByRole('button', { name: /continue to scenario review/i }).click();
  await expect(page).toHaveURL(/#\/wizard\/3$/);
  await expect(page.getByRole('heading', { name: /refine the scenario/i })).toBeVisible({ timeout: 10000 });

  const continueToEstimate = page.getByRole('button', { name: /continue to estimate/i });
  await continueToEstimate.scrollIntoViewIfNeeded();
  await continueToEstimate.click();
  await expect(page).toHaveURL(/#\/wizard\/4$/);
  await expect(page.locator('.wizard-step-title').filter({ hasText: /Tune the estimate/i }).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: /continue to review/i }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /continue to review/i }).click();
  await expect(page).toHaveURL(/#\/wizard\/5$/);
  await expect(page.getByRole('heading', { name: /Review & Run Simulation/i })).toBeVisible({ timeout: 10000 });
}

module.exports = {
  continueToReviewAndRun,
  fillSparseBuyerProjectIntake,
  generateProjectExposureMap,
  startBuyerProjectAssessment
};
