import { test, expect, type Page } from '@playwright/test';

const PARENT_EMAIL = process.env.DEMO_PARENT_EMAIL ?? 'parent@example.com';
const PARENT_PASSWORD = process.env.DEMO_PARENT_PASSWORD ?? 'Demo-Passwort123!';

// Hinweis: Diese Sandbox stellt kein (auch kein simuliertes) Audiogerät zur
// Verfügung — `getUserMedia()` löst hier nie auf, selbst mit Chromiums
// `--use-fake-device-for-media-stream`. Der vollständige Lese-Flow
// (Bewertung, Wiederholungen, Hilfestellung, Abschnittsfortschritt,
// Story-Abschluss) ist deshalb in `tests/integration/reading-session.test.ts`
// direkt gegen die Server Actions abgedeckt. Hier wird nur geprüft, was ohne
// echte Mikrofonaufnahme sichtbar ist: Navigation, Autorisierung, UI-Aufbau.

async function loginAsDemoParent(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(PARENT_EMAIL);
  await page.getByLabel('Passwort').fill(PARENT_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('Kind kann eine Geschichte auswählen und die Lesesitzung startet', async ({ page }) => {
  await loginAsDemoParent(page);

  await page.getByRole('link', { name: 'Lesen starten' }).first().click();
  await expect(page.getByRole('heading', { name: /Hallo/ })).toBeVisible();

  await page.getByRole('link', { name: 'Pieks sucht ein Zuhause' }).click();
  await expect(page.getByRole('heading', { name: 'Pieks sucht ein Zuhause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Los geht’s!' })).toBeVisible();

  await page.getByRole('button', { name: 'Los geht’s!' }).click();

  await expect(page.getByText('Abschnitt 1 von 4')).toBeVisible();
  await expect(page.getByText(/Pieks ist ein kleiner Igel/)).toBeVisible();
  await expect(page.getByLabel('Entwickler-Testmodus: nächstes Ergebnis simulieren')).toBeVisible();
  // Mikrofonzugriff wird aktiv angefragt (klar sichtbarer Mikrofonstatus).
  await expect(
    page.getByText(/Mikrofon wird angefragt|Ich höre zu|Bereit zum Aufnehmen/),
  ).toBeVisible();
  // Illustrationsbereich ist sichtbar, aber zu Beginn noch ohne freigeschaltete Ebenen.
  await expect(page.getByText('Das Bild entsteht, während du liest …')).toBeVisible();
  await expect(page.getByText('0 von 5 Bildteilen freigeschaltet')).toBeVisible();
});

test('Geschichtenauswahl zeigt ein Illustrations-Vorschaubild pro Geschichte', async ({ page }) => {
  await loginAsDemoParent(page);
  await page.getByRole('link', { name: 'Lesen starten' }).first().click();

  const storyCard = page.getByRole('link', { name: /Pieks sucht ein Zuhause/ });
  await expect(storyCard.locator('img')).toHaveCount(1);
});

test('Fremder/nicht existenter Kinderprofil-Zugriff beim Lesen wird blockiert', async ({
  page,
}) => {
  await loginAsDemoParent(page);
  const response = await page.goto('/lesen/does-not-exist-123');
  expect(response?.status()).toBe(404);
});

test('Nicht existente Geschichte führt zu 404', async ({ page }) => {
  await loginAsDemoParent(page);
  await page.getByRole('link', { name: 'Lesen starten' }).first().click();
  await page.waitForURL(/\/lesen\//);
  const childUrl = page.url();
  const childId = childUrl.split('/lesen/')[1];
  const response = await page.goto(`/lesen/${childId}/does-not-exist-story`);
  expect(response?.status()).toBe(404);
});
