import { test, expect } from '@playwright/test';

test('workspace demo path', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Run HisabAgent' }).click();
  await expect(page.getByRole('heading', { name: 'Reconciled ledger' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your decision queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Output Trust' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit pack preview' })).toBeVisible();
  await expect(page.getByText('Possible duplicate ₹2,500', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Run critic again/ }).click();
  await expect(page.getByText(/Critic pass 2/)).toBeVisible();
});

test('evals lab reports honest results', async ({ page }) => {
  await page.goto('/evals');
  await page.getByRole('button', { name: 'Run all 12 evals' }).click();
  await expect(page.getByText('no regressions against documented behaviour')).toBeVisible();
  await expect(page.getByText('documented limitation').first()).toBeVisible();
});
