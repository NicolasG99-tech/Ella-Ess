import { test, expect } from '@playwright/test';

// Nutzt das per `npm run db:seed` angelegte Admin-Demokonto (siehe .env.example).
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'Demo-Admin-Passwort123!';

test('Admin sieht die Content-Übersicht und kann eine Geschichte verbergen/veröffentlichen', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Content-Übersicht' })).toBeVisible();

  const storyRow = page.getByRole('row', { name: /Pieks sucht ein Zuhause/ });
  await expect(storyRow).toBeVisible();
  await expect(storyRow.getByText('veröffentlicht')).toBeVisible();

  await storyRow.getByRole('button', { name: 'Verbergen' }).click();
  await expect(
    page.getByRole('row', { name: /Pieks sucht ein Zuhause/ }).getByText('verborgen'),
  ).toBeVisible();

  // Zustand für andere Testläufe zurücksetzen.
  await page
    .getByRole('row', { name: /Pieks sucht ein Zuhause/ })
    .getByRole('button', { name: 'Veröffentlichen' })
    .click();
  await expect(
    page.getByRole('row', { name: /Pieks sucht ein Zuhause/ }).getByText('veröffentlicht'),
  ).toBeVisible();
});

test('Nicht-Admin (Elternkonto) erhält 404 auf der Admin-Seite', async ({ page }) => {
  const email = `e2e-nonadmin-${Date.now()}@example.com`;
  const password = 'SicheresTestPasswort123';

  await page.goto('/register');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort (mindestens 10 Zeichen)').fill(password);
  await page.getByLabel(/Nutzungsbedingungen/).check();
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);

  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
});
