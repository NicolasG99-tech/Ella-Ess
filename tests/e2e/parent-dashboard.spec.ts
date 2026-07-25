import { test, expect, type Page } from '@playwright/test';

// Eigenes, frisch registriertes Konto pro Test — die Fortschrittsübersicht
// zählt Aktivität lebenslang pro Kind, ein geteiltes Konto würde Tests je
// nach Ausführungsreihenfolge verfälschen (siehe exercises.spec.ts).
function uniqueEmail() {
  return `e2e-parent-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLoginWithChild(page: Page) {
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
  await page.getByLabel('Name oder Spitzname').fill('E2E-Fortschrittskind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('Zeigt eine leere Fortschrittsübersicht für ein neues Kind', async ({ page }) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Fortschritt' }).first().click();

  await expect(page.getByRole('heading', { name: /Fortschritt von/ })).toBeVisible();
  await expect(page.getByText('Noch keine Geschichte zu Ende gelesen.')).toBeVisible();
  await expect(
    page.getByText('Noch keine Übungsdaten — die Übersicht füllt sich nach den ersten'),
  ).toBeVisible();
});

test('Zeigt aktualisierte Zahlen nach einer abgeschlossenen Übung', async ({ page }) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.getByRole('link', { name: /Wortübung: Kurze Wörter/ }).click();
  await page.getByRole('button', { name: 'Ich habe es gelesen' }).click();
  await page.getByRole('link', { name: 'Beenden' }).click();
  await page.getByRole('link', { name: 'Zurück zum Elternbereich' }).click();

  await page.getByRole('link', { name: 'Fortschritt' }).first().click();

  const exerciseCard = page.locator('div').filter({ hasText: 'Übungen geschafft' }).first();
  await expect(exerciseCard).toContainText('1');
  await expect(page.getByText('Lesegrundlagen')).toBeVisible();
});

test('Fremder/nicht existenter Kinderprofil-Zugriff auf die Fortschrittsseite wird blockiert', async ({
  page,
}) => {
  await registerAndLoginWithChild(page);
  const response = await page.goto('/dashboard/children/does-not-exist-123');
  expect(response?.status()).toBe(404);
});
