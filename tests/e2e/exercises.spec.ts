import { test, expect, type Page } from '@playwright/test';

// Jeder Test registriert ein eigenes, frisches Elternkonto samt Kinderprofil
// (statt das gemeinsam genutzte Demo-Konto zu verwenden). Rechtschreibversuche
// werden pro Kind/Übungsaufgabe kumulativ gezählt (siehe exerciseService.ts,
// MAX_ATTEMPTS) — ein geteiltes Konto würde Versuche über Testläufe hinweg
// summieren und Tests je nach Ausführungsreihenfolge/-wiederholung brechen.
function uniqueEmail() {
  return `e2e-exercises-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
  await page.getByLabel('Name oder Spitzname').fill('E2E-Übungskind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('Kind kann eine Rechtschreibübung (Lückentext) korrekt lösen', async ({ page }) => {
  await registerAndLoginWithChild(page);

  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await expect(page.getByRole('heading', { name: /Übungen für/ })).toBeVisible();

  await page.getByRole('link', { name: /Lückentext/ }).click();
  await expect(page.getByText('Aufgabe 1 von')).toBeVisible();

  // "H_nd" -> "Hund"
  await page.getByLabel('Deine Antwort').fill('Hund');
  await page.getByRole('button', { name: 'Antworten' }).click();

  await expect(page.getByText('Super gemacht!')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Aufgabe 2 von')).toBeVisible();
});

test('Rechtschreibübung erlaubt einen zweiten Versuch und deckt danach die Lösung auf', async ({
  page,
}) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.getByRole('link', { name: /Lückentext/ }).click();

  await page.getByLabel('Deine Antwort').fill('komplettFalsch');
  await page.getByRole('button', { name: 'Antworten' }).click();
  await expect(page.getByText('Fast! Versuch es noch einmal.')).toBeVisible();

  await page.getByRole('button', { name: 'Nochmal versuchen' }).click();
  await page.getByLabel('Deine Antwort').fill('immerNochFalsch');
  await page.getByRole('button', { name: 'Antworten' }).click();

  await expect(page.getByText(/Die richtige Schreibweise ist:/)).toBeVisible();
});

test('Wortübung lässt sich als gelesen markieren', async ({ page }) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.getByRole('link', { name: /Wortübung: Kurze Wörter/ }).click();

  await expect(page.getByText('Aufgabe 1 von')).toBeVisible();
  await page.getByRole('button', { name: 'Ich habe es gelesen' }).click();
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible();
});

test('Nicht angemeldeter Zugriff auf Übungen wird zum Login umgeleitet', async ({ page }) => {
  const response = await page.goto('/uebungen/some-child-id');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login/);
});
