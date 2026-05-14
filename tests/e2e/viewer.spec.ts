import { expect, test } from '@playwright/test';

test('viewer renders State A chrome with Enter stop CTA', async ({ page }) => {
  // Suppress 3D asset 404 / parse noise in console — placeholders are 0-byte/1×1 in dev.
  await page.goto('/trips/japan-spring-2026');

  // State A chrome should render without requiring valid 3D assets or a Mapbox token.
  await expect(page.getByRole('heading', { name: /shibuya crossing|japan, spring 2026/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /enter stop/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /all trips/i })).toBeVisible();
});
