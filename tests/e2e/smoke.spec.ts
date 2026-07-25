import { test, expect } from '@playwright/test';

test('Startseite lädt und zeigt den Produktnamen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /lese-abenteuer/i })).toBeVisible();
});
