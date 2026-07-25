import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'Demo-Admin-Passwort123!';

function uniqueEmail(prefix: string) {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('http://localhost:3100/');
}

test('Vollständiger Lehrkräfte-Flow: registrieren, verifizieren, freigeben, Rückmeldung, widerrufen', async ({
  page,
}) => {
  const teacherEmail = uniqueEmail('lehrkraft');
  const teacherPassword = 'SicheresTestPasswort123';
  const parentEmail = uniqueEmail('eltern');
  const parentPassword = 'SicheresTestPasswort123';

  // 1. Lehrkraft registriert sich.
  await page.goto('/registrieren-lehrer');
  await page.getByLabel('E-Mail-Adresse').fill(teacherEmail);
  await page.getByLabel('Passwort (mindestens 10 Zeichen)').fill(teacherPassword);
  await page.getByLabel(/Schule\/Einrichtung/).fill('Grundschule am Fluss');
  await page.getByLabel(/Nutzungsbedingungen/).check();
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);

  // 2. Eltern registrieren sich und legen ein Kind an.
  await page.goto('/register');
  await page.getByLabel('E-Mail-Adresse').fill(parentEmail);
  await page.getByLabel('Passwort (mindestens 10 Zeichen)').fill(parentPassword);
  await page.getByLabel(/Nutzungsbedingungen/).check();
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);

  await login(page, parentEmail, parentPassword);
  await page.getByRole('link', { name: 'Kind hinzufügen' }).click();
  await page.getByLabel('Name oder Spitzname').fill('E2E-Lehrkraftkind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // 3. Eltern versuchen, der noch nicht verifizierten Lehrkraft Zugriff zu geben — schlägt fehl.
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Lehrkräfte' })
    .getByLabel('E-Mail-Adresse der Lehrkraft')
    .fill(teacherEmail);
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Lehrkräfte' })
    .getByRole('button', { name: 'Zugriff geben' })
    .click();
  await expect(page.getByText('Keine verifizierte Lehrkraft')).toBeVisible();

  await logout(page);

  // 4. Admin verifiziert die Lehrkraft.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  const teacherRow = page.getByRole('row', { name: new RegExp(teacherEmail) });
  await expect(teacherRow).toBeVisible();
  await teacherRow.getByRole('button', { name: 'Verifizieren' }).click();
  await expect(teacherRow.getByText('verifiziert')).toBeVisible();
  await logout(page);

  // 5. Eltern geben der jetzt verifizierten Lehrkraft Zugriff.
  await login(page, parentEmail, parentPassword);
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Lehrkräfte' })
    .getByLabel('E-Mail-Adresse der Lehrkraft')
    .fill(teacherEmail);
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Lehrkräfte' })
    .getByRole('button', { name: 'Zugriff geben' })
    .click();
  await expect(page.getByText('Zugriff erteilt.')).toBeVisible();
  await expect(page.getByText(teacherEmail).first()).toBeVisible();
  await logout(page);

  // 6. Lehrkraft sieht das Kind, gibt eine Rückmeldung.
  await login(page, teacherEmail, teacherPassword);
  await page.goto('/lehrer');
  await page.getByRole('link', { name: 'Ansehen' }).click();
  await expect(page.getByRole('heading', { name: /Assessment-Bogen:/ })).toBeVisible();
  await page.getByLabel('Neue Rückmeldung für die Eltern').fill('Gute Mitarbeit im Unterricht.');
  await page.getByRole('button', { name: 'Rückmeldung senden' }).click();
  await expect(page.getByText('Rückmeldung gesendet.')).toBeVisible();
  await logout(page);

  // 7. Eltern sehen die Rückmeldung auf der Fortschrittsseite.
  await login(page, parentEmail, parentPassword);
  await page.getByRole('link', { name: 'Fortschritt' }).first().click();
  await expect(page.getByText('Gute Mitarbeit im Unterricht.')).toBeVisible();

  // 8. Eltern widerrufen den Zugriff.
  await page.getByRole('link', { name: 'Zugriff für Fachkräfte & Lehrkräfte verwalten' }).click();
  await page.getByRole('button', { name: 'Zugriff entziehen' }).click();
  await expect(page.getByText('Aktuell hat keine Lehrkraft Zugriff.')).toBeVisible();
  await logout(page);

  // 9. Lehrkraft hat keinen Zugriff mehr.
  await login(page, teacherEmail, teacherPassword);
  await page.goto('/lehrer');
  await expect(page.getByText('Noch kein Kinderprofil freigegeben.')).toBeVisible();

  // 10. Zugriff auf eine nicht existente/nicht eigene Freigabe wird blockiert.
  const response = await page.goto('/lehrer/does-not-exist-123');
  expect(response?.status()).toBe(404);
});

test('Nicht angemeldeter Zugriff auf den Lehrkräfte-Bereich wird zum Login umgeleitet', async ({
  page,
}) => {
  const response = await page.goto('/lehrer');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});
