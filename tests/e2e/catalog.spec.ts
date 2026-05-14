import { expect, test } from '@playwright/test';

test('catalog lists trips and links to viewer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Trip Visual' })).toBeVisible();
  const cards = page.getByRole('link', { name: /Japan, Spring 2026/i });
  await expect(cards).toBeVisible();
  await cards.click();
  await expect(page).toHaveURL(/\/trips\/japan-spring-2026/);
});
