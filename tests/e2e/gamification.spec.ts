import { test, expect, type Page } from '@playwright/test';

// Eigenes, frisch registriertes Konto pro Test (siehe exercises.spec.ts) —
// Belohnungs-Meilensteine ("erste Geschichte", "erste Übung") werden
// lebenslang pro Kind gezählt und würden sich bei einem geteilten Konto
// zwischen Testläufen gegenseitig stören.
function uniqueEmail() {
  return `e2e-gamification-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
  await page.getByLabel('Name oder Spitzname').fill('E2E-Belohnungskind');
  await page.getByLabel('Geburtsjahr').fill('2017');
  await page.getByRole('button', { name: 'Profil anlegen' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// Beantwortet eine Multiple-Choice-/Inferenz-Frage korrekt und geht weiter.
async function answerOptionQuestion(page: Page, optionLabel: string) {
  await page.getByRole('button', { name: optionLabel, exact: true }).click();
  await page.getByRole('button', { name: 'Antworten' }).click();
  await page.getByRole('button', { name: /Nächste Frage|Fertig/ }).click();
}

// Beantwortet eine Aussage-Frage (Richtig/Falsch) korrekt und geht weiter.
async function answerStatementQuestion(page: Page, correct: boolean) {
  await page.getByRole('button', { name: correct ? 'Richtig' : 'Falsch' }).click();
  await page.getByRole('button', { name: /Nächste Frage|Fertig/ }).click();
}

test('Erste Geschichte gibt einen Lesestern und das Erste-Geschichte-Abzeichen', async ({
  page,
}) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Lesen starten' }).first().click();
  await page.getByRole('link', { name: 'Pieks sucht ein Zuhause' }).click();
  await page.getByRole('button', { name: 'Los geht’s!' }).click();

  await page.getByLabel('Entwickler-Testmodus: nächstes Ergebnis simulieren').selectOption({
    label: 'Richtig gelesen',
  });

  // "Pieks sucht ein Zuhause" hat 4 Textabschnitte — im Mock-Modus liest das
  // Testmodus-Szenario "Richtig gelesen" jeweils den kompletten restlichen
  // Abschnitt korrekt, ein Klick pro Abschnitt genügt daher zum Abschluss.
  for (let section = 0; section < 4; section += 1) {
    await page.getByRole('button', { name: 'Ergebnis simulieren (ohne Aufnahme)' }).click();
  }

  // Die 3 Verständnisfragen von "Pieks sucht ein Zuhause" (siehe
  // src/content/stories.ts) werden hier jeweils korrekt beantwortet.
  await answerOptionQuestion(page, 'Ein Igel');
  await answerStatementQuestion(page, false);
  await answerOptionQuestion(page, 'Um es warm zu machen');

  await expect(page.getByRole('heading', { name: 'Fertig gelesen! 🎉' })).toBeVisible();
  await expect(page.getByText('Lesestern')).toBeVisible();
  await expect(page.getByText('Erste Geschichte', { exact: true })).toBeVisible();
});

test('Erste abgeschlossene Übung gibt einen Übungsstern und das Erste-Übung-Abzeichen', async ({
  page,
}) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.getByRole('link', { name: /Wortübung: Kurze Wörter/ }).click();

  await page.getByRole('button', { name: 'Ich habe es gelesen' }).click();

  await expect(page.getByText('Übungsstern')).toBeVisible();
  await expect(page.getByText('Erste Übung', { exact: true })).toBeVisible();
});

test('Belohnungsseite zeigt gesammelte Sterne und Abzeichen, fremder Zugriff wird blockiert', async ({
  page,
}) => {
  await registerAndLoginWithChild(page);
  await page.getByRole('link', { name: 'Übungen' }).first().click();
  await page.getByRole('link', { name: /Wortübung: Kurze Wörter/ }).click();
  await page.getByRole('button', { name: 'Ich habe es gelesen' }).click();
  await page.getByRole('link', { name: 'Beenden' }).click();
  await page.getByRole('link', { name: 'Zurück zum Elternbereich' }).click();

  await page.getByRole('link', { name: 'Belohnungen' }).first().click();
  await expect(page.getByText('1 Stern gesammelt.')).toBeVisible();
  await expect(page.getByText('Erste Übung', { exact: true })).toBeVisible();

  const response = await page.goto('/belohnungen/does-not-exist-123');
  expect(response?.status()).toBe(404);
});
