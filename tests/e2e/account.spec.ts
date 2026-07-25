import { test, expect } from '@playwright/test';

function uniqueEmail() {
  return `e2e-account-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('Eltern können ihre Daten exportieren und ihr Konto endgültig löschen', async ({ page }) => {
  const email = uniqueEmail();
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

  await page.getByRole('link', { name: 'Kind hinzufügen' }).click();
  await page.getByLabel('Name oder Spitzname').fill('E2E-Kontokind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Mein Konto' }).click();
  await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Daten exportieren' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('lese-abenteuer-daten.json');

  await page.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await page.getByLabel(/Tippe zur Bestätigung/).fill(email);
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();

  await expect(page).toHaveURL('http://localhost:3100/');

  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('E-Mail-Adresse oder Passwort ist falsch.')).toBeVisible();
});
