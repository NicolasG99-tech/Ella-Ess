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
  // Wartet, bis die Session-Weiterleitung abgeschlossen ist, bevor der Test
  // weiternavigiert — sonst kann ein sofortiges page.goto() die noch laufende
  // Anmeldung unterbrechen, bevor das Session-Cookie gesetzt ist.
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('http://localhost:3100/');
}

test('Vollständiger Fachkräfte-Flow: registrieren, verifizieren, freigeben, Rückmeldung, widerrufen', async ({
  page,
}) => {
  const specialistEmail = uniqueEmail('fachkraft');
  const specialistPassword = 'SicheresTestPasswort123';
  const parentEmail = uniqueEmail('eltern');
  const parentPassword = 'SicheresTestPasswort123';

  // 1. Fachkraft registriert sich.
  await page.goto('/registrieren-fachkraft');
  await page.getByLabel('E-Mail-Adresse').fill(specialistEmail);
  await page.getByLabel('Passwort (mindestens 10 Zeichen)').fill(specialistPassword);
  await page.getByLabel(/Qualifikation/).fill('Logopädin');
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
  await page.getByLabel('Name oder Spitzname').fill('E2E-Fachkraftkind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // 3. Eltern versuchen, der noch nicht verifizierten Fachkraft Zugriff zu geben — schlägt fehl.
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Fachkräfte' })
    .getByLabel('E-Mail-Adresse der Fachkraft')
    .fill(specialistEmail);
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Fachkräfte' })
    .getByRole('button', { name: 'Zugriff geben' })
    .click();
  await expect(page.getByText('Keine verifizierte Fachkraft')).toBeVisible();

  await logout(page);

  // 4. Admin verifiziert die Fachkraft.
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');
  const specialistRow = page.getByRole('row', { name: new RegExp(specialistEmail) });
  await expect(specialistRow).toBeVisible();
  await specialistRow.getByRole('button', { name: 'Verifizieren' }).click();
  await expect(specialistRow.getByText('verifiziert')).toBeVisible();
  await logout(page);

  // 5. Eltern geben der jetzt verifizierten Fachkraft Zugriff.
  await login(page, parentEmail, parentPassword);
  await page.getByRole('link', { name: 'Bearbeiten' }).click();
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Fachkräfte' })
    .getByLabel('E-Mail-Adresse der Fachkraft')
    .fill(specialistEmail);
  await page
    .locator('section')
    .filter({ hasText: 'Zugriff für Fachkräfte' })
    .getByRole('button', { name: 'Zugriff geben' })
    .click();
  await expect(page.getByText('Zugriff erteilt.')).toBeVisible();
  await expect(page.getByText(specialistEmail).first()).toBeVisible();
  await logout(page);

  // 6. Fachkraft sieht das Kind, gibt eine Rückmeldung.
  await login(page, specialistEmail, specialistPassword);
  await page.goto('/fachkraft');
  await page.getByRole('link', { name: 'Ansehen' }).click();
  await expect(page.getByRole('heading', { name: /Assessment-Bogen:/ })).toBeVisible();
  await page.getByLabel('Neue Rückmeldung für die Eltern').fill('Gute Fortschritte insgesamt.');
  await page.getByRole('button', { name: 'Rückmeldung senden' }).click();
  await expect(page.getByText('Rückmeldung gesendet.')).toBeVisible();
  await logout(page);

  // 7. Eltern sehen die Rückmeldung auf der Fortschrittsseite.
  await login(page, parentEmail, parentPassword);
  await page.getByRole('link', { name: 'Fortschritt' }).first().click();
  await expect(page.getByText('Gute Fortschritte insgesamt.')).toBeVisible();

  // 8. Eltern widerrufen den Zugriff.
  await page.getByRole('link', { name: 'Zugriff für Fachkräfte & Lehrkräfte verwalten' }).click();
  await page.getByRole('button', { name: 'Zugriff entziehen' }).click();
  await expect(page.getByText('Aktuell hat keine Fachkraft Zugriff.')).toBeVisible();
  await logout(page);

  // 9. Fachkraft hat keinen Zugriff mehr.
  await login(page, specialistEmail, specialistPassword);
  await page.goto('/fachkraft');
  await expect(page.getByText('Noch kein Kinderprofil freigegeben.')).toBeVisible();

  // 10. Zugriff auf eine nicht existente/nicht eigene Freigabe wird blockiert.
  const response = await page.goto('/fachkraft/does-not-exist-123');
  expect(response?.status()).toBe(404);
});

test('Nicht angemeldeter Zugriff auf den Fachkräfte-Bereich wird zum Login umgeleitet', async ({
  page,
}) => {
  const response = await page.goto('/fachkraft');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});
