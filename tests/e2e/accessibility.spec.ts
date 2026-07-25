import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automatisierter Barrierefreiheits-Scan (Meilenstein 10) — deckt keine
// vollständige manuelle Prüfung ab (siehe docs/SECURITY.md,
// Produktionsanforderungen), findet aber die meisten strukturellen Probleme
// (fehlende Labels/Alt-Texte, unzureichender Kontrast, ungültige ARIA-Nutzung).
async function expectNoAccessibilityViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test('Startseite ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  await page.goto('/');
  await expectNoAccessibilityViolations(page);
});

test('Login-Seite ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  await page.goto('/login');
  await expectNoAccessibilityViolations(page);
});

test('Registrierungsseite ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  await page.goto('/register');
  await expectNoAccessibilityViolations(page);
});

test('Eltern-Dashboard ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  const email = `e2e-a11y-${Date.now()}@example.com`;
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

  await expectNoAccessibilityViolations(page);

  await page.getByRole('link', { name: 'Kind hinzufügen' }).click();
  await expectNoAccessibilityViolations(page);
  await page.getByLabel('Name oder Spitzname').fill('E2E-A11y-Kind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await expectNoAccessibilityViolations(page);

  await page.getByRole('link', { name: /Wortübung: Kurze Wörter/ }).click();
  await expectNoAccessibilityViolations(page);
});

test('Lese-Ansicht (Intro) ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  const PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? 'parent@example.com';
  const PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? 'Demo-Passwort123!';

  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(PARENT_EMAIL);
  await page.getByLabel('Passwort').fill(PARENT_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Lesen starten' }).first().click();
  await expectNoAccessibilityViolations(page);

  await page.getByRole('link', { name: 'Pieks sucht ein Zuhause' }).click();
  await expectNoAccessibilityViolations(page);
});

test('Belohnungsseite ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  const PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? 'parent@example.com';
  const PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? 'Demo-Passwort123!';

  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(PARENT_EMAIL);
  await page.getByLabel('Passwort').fill(PARENT_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: 'Belohnungen' }).first().click();
  await expectNoAccessibilityViolations(page);
});

test('Admin-Bereich ist frei von automatisiert erkennbaren Barrierefreiheitsproblemen', async ({
  page,
}) => {
  const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin@example.com';
  const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'Demo-Admin-Passwort123!';

  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/admin');
  await expectNoAccessibilityViolations(page);
});
