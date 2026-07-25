import { test, expect } from '@playwright/test';

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test('Registrierung, Login, Kinderprofil, Logout, Fremdzugriff blockiert', async ({ page }) => {
  const email = uniqueEmail();
  const password = 'SicheresTestPasswort123';

  await page.goto('/register');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort (mindestens 10 Zeichen)').fill(password);
  await page.getByLabel(/Nutzungsbedingungen/).check();
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(page.getByText('Konto erstellt. Du kannst dich jetzt anmelden.')).toBeVisible();

  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Kinderprofile' })).toBeVisible();

  await page.getByRole('link', { name: 'Kind hinzufügen' }).click();
  await expect(page).toHaveURL(/\/dashboard\/children\/new/);

  await page.getByLabel('Name oder Spitzname').fill('E2E-Kind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('E2E-Kind')).toBeVisible();

  // Logout muss die Session wirklich beenden, ohne Server-Fehler auszulösen.
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('http://localhost:3100/');

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  const redirectUrl = new URL(page.url());
  expect(redirectUrl.pathname).toBe('/login');
  expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/dashboard');

  expect(consoleErrors).toEqual([]);

  // Erneut anmelden — das Kinderprofil muss weiterhin vorhanden sein.
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('E2E-Kind')).toBeVisible();

  // Fremdzugriff auf ein nicht existierendes/fremdes Kinderprofil wird blockiert.
  const response = await page.goto('/dashboard/children/does-not-exist-123/edit');
  expect(response?.status()).toBe(404);
});
