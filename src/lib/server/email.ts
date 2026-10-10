// Transaktionaler E-Mail-Versand — bewusst per einfachem `fetch()` gegen die
// REST-API von Brevo (EU-/französisches Unternehmen, DSGVO-nativ, passt zur
// bestehenden EU-Datenresidenz-Linie: Hetzner/Supabase/Azure-EU-Zone, siehe
// docs/DEPLOYMENT.md) umgesetzt — KEIN zusätzliches npm-Paket (z.B.
// nodemailer) nötig, dadurch keine Änderung an package-lock.json erforderlich.
//
// Ohne konfigurierten Provider (lokale Entwicklung, kein BREVO_API_KEY) wird
// wie bisher nur ins Server-Log geschrieben — bewusst dasselbe
// Fallback-Verhalten wie bei SPEECH_PROVIDER=mock, kein Verhaltensbruch für
// die lokale Entwicklung.
//
// Dieses Modul ist als generisches BENACHRICHTIGUNGS-TEMPLATE-SYSTEM
// aufgebaut (Ergebnis der Sicherheitsprüfung 2026-07-28, Punkte 7+8): ein
// gemeinsamer HTML-/Text-Rahmen (wrapHtml/wrapText) plus pro Anlass eine
// kleine "build*Template"-Funktion, die nur Betreff/Inhalt liefert. Neue
// Benachrichtigungsarten sollen künftig genauso angelegt werden, statt
// eigene, unabhängige Sende-Pfade zu bauen — das hält Branding/Fußzeile an
// einer Stelle pflegbar und macht neue Vorlagen leicht testbar (reine
// Funktionen ohne Netzwerkzugriff).

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

interface SendEmailInput extends EmailContent {
  to: string;
}

async function sendTransactionalEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME || 'Lese-Abenteuer';

  if (!apiKey || !fromAddress) {
    // Kein Provider konfiguriert — Inhalt ins Server-Log statt echtem Versand
    // (nur der lokale/Dev-Fall; enthält bewusst die Empfängeradresse, da dies
    // ausschließlich für lokales Debugging gedacht ist, siehe README.md).
    console.log(`[MOCK E-MAIL] An ${input.to}: ${input.subject}\n${input.text}`);
    return { sent: false };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromAddress, name: fromName },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
    });

    if (!response.ok) {
      // Bewusst ohne Empfängeradresse geloggt (keine PII in Produktions-Logs,
      // siehe docs/SECURITY.md/privacy-security-Agent) — der HTTP-Status
      // reicht zur Fehlerdiagnose auf Betreiber-Seite.
      console.error(`[E-MAIL] Versand fehlgeschlagen: HTTP ${response.status}`);
      return { sent: false };
    }

    return { sent: true };
  } catch {
    console.error('[E-MAIL] Versand fehlgeschlagen: Netzwerkfehler.');
    return { sent: false };
  }
}

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000';
}

// Gemeinsamer HTML-Rahmen für alle Benachrichtigungs-Mails. Bewusst sehr
// einfach gehalten (Inline-Styles, keine externen Assets) — Transaktions-
// E-Mails werden häufig in eingeschränkten Webmail-Clients gerendert, die
// weder <style>-Blöcke noch externe Bilder zuverlässig laden.
function wrapHtml(bodyHtml: string): string {
  return (
    `<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">` +
    `<p style="font-weight: bold; font-size: 18px; color: #92400e;">Lese-Abenteuer</p>` +
    bodyHtml +
    `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />` +
    `<p style="font-size: 12px; color: #888;">Diese Nachricht wurde automatisch von Lese-Abenteuer verschickt. ` +
    `Falls du Fragen dazu hast, antworte einfach auf diese E-Mail.</p>` +
    `</div>`
  );
}

function wrapText(bodyText: string): string {
  return (
    `Lese-Abenteuer\n\n${bodyText}\n\n---\n` +
    `Diese Nachricht wurde automatisch von Lese-Abenteuer verschickt. Falls du Fragen dazu hast, ` +
    `antworte einfach auf diese E-Mail.`
  );
}

/**
 * Baut Betreff/Inhalt für die Passwort-Reset-Mail. Reine Funktion (kein
 * Netzwerkzugriff) — der eigentliche Versand erfolgt über
 * sendPasswordResetEmail().
 */
function buildPasswordResetTemplate(resetUrl: string): EmailContent {
  return {
    subject: 'Passwort zurücksetzen — Lese-Abenteuer',
    text: wrapText(
      `Du hast angefordert, dein Passwort zurückzusetzen.\n\n` +
        `Klicke auf diesen Link, um ein neues Passwort zu vergeben (30 Minuten gültig):\n${resetUrl}\n\n` +
        `Falls du das nicht warst, kannst du diese E-Mail ignorieren — es ändert sich nichts an deinem Konto.`,
    ),
    html: wrapHtml(
      `<p>Du hast angefordert, dein Passwort zurückzusetzen.</p>` +
        `<p><a href="${resetUrl}">Klicke hier, um ein neues Passwort zu vergeben</a> (30 Minuten gültig).</p>` +
        `<p>Falls du das nicht warst, kannst du diese E-Mail ignorieren — es ändert sich nichts an deinem Konto.</p>`,
    ),
  };
}

/**
 * Versendet den Passwort-Reset-Link. Gleiche Funktion/Signatur unabhängig
 * davon, ob ein echter Provider konfiguriert ist — der Aufrufer
 * (requestPasswordResetAction) muss den Unterschied nicht kennen.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${getAppBaseUrl()}/passwort-zuruecksetzen/${token}`;
  await sendTransactionalEmail({ to: email, ...buildPasswordResetTemplate(resetUrl) });
}

/**
 * Baut Betreff/Inhalt für eine generische Auth-Code-Mail (z.B. künftige
 * E-Mail-Verifizierung bei der Registrierung oder ein Zwei-Faktor-Code).
 * `purpose` beschreibt in einem kurzen Satzfragment, wofür der Code gilt
 * (z.B. "um deine E-Mail-Adresse zu bestätigen").
 */
function buildAuthCodeTemplate(code: string, purpose: string, validMinutes: number): EmailContent {
  return {
    subject: 'Dein Bestätigungscode — Lese-Abenteuer',
    text: wrapText(
      `Dein Code, ${purpose}:\n\n${code}\n\n` +
        `Der Code ist ${validMinutes} Minuten gültig. Falls du das nicht angefordert hast, kannst du diese ` +
        `E-Mail ignorieren.`,
    ),
    html: wrapHtml(
      `<p>Dein Code, ${purpose}:</p>` +
        `<p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>` +
        `<p>Der Code ist ${validMinutes} Minuten gültig. Falls du das nicht angefordert hast, kannst du diese ` +
        `E-Mail ignorieren.</p>`,
    ),
  };
}

/**
 * Versendet einen Bestätigungscode. Noch nicht an einen konkreten Ablauf
 * angebunden (aktuell gibt es weder E-Mail-Verifizierung bei der
 * Registrierung noch Zwei-Faktor-Authentifizierung) — als Vorlage bereits
 * vorbereitet, damit ein künftiges Feature nur noch den Code erzeugen und
 * diese Funktion aufrufen muss, statt eine neue Vorlage zu entwerfen.
 *
 * @param email - Empfängeradresse.
 * @param code - Der anzuzeigende Code (Erzeugung/Speicherung liegt beim Aufrufer).
 * @param purpose - Kurzes Satzfragment, z.B. "um deine E-Mail-Adresse zu bestätigen".
 * @param validMinutes - Gültigkeitsdauer in Minuten, für den Anzeigetext.
 */
export async function sendAuthCodeEmail(
  email: string,
  code: string,
  purpose: string,
  validMinutes: number,
): Promise<void> {
  await sendTransactionalEmail({ to: email, ...buildAuthCodeTemplate(code, purpose, validMinutes) });
}

/**
 * Baut Betreff/Inhalt für eine generische Datenschutzbenachrichtigung (z.B.
 * Kontolöschung bestätigt, Änderung der Einwilligung, künftig: Änderungen an
 * den Nutzungsbedingungen). `headline` erscheint als hervorgehobene
 * Überschrift, `message` als Fließtext.
 */
function buildPrivacyNoticeTemplate(headline: string, message: string): EmailContent {
  return {
    subject: `${headline} — Lese-Abenteuer`,
    text: wrapText(`${headline}\n\n${message}`),
    html: wrapHtml(
      `<p style="font-weight: bold;">${headline}</p>` + `<p>${message}</p>`,
    ),
  };
}

/**
 * Versendet eine Datenschutz-relevante Benachrichtigung (z.B. Bestätigung
 * einer Kontolöschung). Bewusst generisch statt einer eigenen Funktion pro
 * Anlass, da der Inhalt je nach Ereignis stark variiert, die Struktur aber
 * gleich bleibt.
 *
 * @param email - Empfängeradresse. Bei einer Kontolöschung MUSS diese vor
 *   dem eigentlichen Löschvorgang aus der Session/DB gelesen werden, siehe
 *   deleteOwnAccountAction() in features/account/actions.ts.
 * @param notice - `headline` (kurze Überschrift) und `message` (Fließtext).
 */
export async function sendPrivacyNoticeEmail(
  email: string,
  notice: { headline: string; message: string },
): Promise<void> {
  await sendTransactionalEmail({
    to: email,
    ...buildPrivacyNoticeTemplate(notice.headline, notice.message),
  });
}

/**
 * Baut Betreff/Inhalt für eine Login-Benachrichtigung.
 */
function buildLoginNotificationTemplate(occurredAt: Date): EmailContent {
  const formatted = occurredAt.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });
  return {
    subject: 'Neue Anmeldung bei deinem Konto — Lese-Abenteuer',
    text: wrapText(
      `Dein Lese-Abenteuer-Konto wurde soeben angemeldet (${formatted} Uhr, MEZ/MESZ).\n\n` +
        `Warst du das nicht, ändere zeitnah dein Passwort über "Passwort vergessen" auf der Login-Seite.`,
    ),
    html: wrapHtml(
      `<p>Dein Lese-Abenteuer-Konto wurde soeben angemeldet (${formatted} Uhr, MEZ/MESZ).</p>` +
        `<p>Warst du das nicht, ändere zeitnah dein Passwort über „Passwort vergessen" auf der Login-Seite.</p>`,
    ),
  };
}

/**
 * Versendet eine Login-Benachrichtigung. Wird aus dem `events.signIn`-Hook
 * in src/lib/server/auth.ts ausgelöst — dieser Hook feuert bei der
 * JWT-Strategie ausschließlich bei einer tatsächlichen Anmeldung über das
 * Login-Formular (nicht bei jeder Session-Aktualisierung/jedem
 * Seitenaufruf), daher keine Spam-Gefahr bei normaler Nutzung.
 *
 * Bewusst ohne IP-Adresse/Geräteinfo im MVP (dafür fehlt noch die
 * Erfassungsinfrastruktur) — reiner Zeitstempel-Hinweis reicht als erster
 * Schritt, um ungewöhnliche Logins auffindbar zu machen (Ergebnis der
 * Sicherheitsprüfung 2026-07-28, Punkt 8).
 *
 * @param email - Empfängeradresse des angemeldeten Kontos.
 * @param occurredAt - Zeitpunkt der Anmeldung.
 */
export async function sendLoginNotificationEmail(email: string, occurredAt: Date): Promise<void> {
  await sendTransactionalEmail({ to: email, ...buildLoginNotificationTemplate(occurredAt) });
}

/**
 * Baut Betreff/Inhalt für eine Benachrichtigung über eine Änderung des
 * Zahlungsmodus (z.B. neue hinterlegte Karte, gekündigtes Abo).
 */
function buildPaymentMethodChangedTemplate(description: string): EmailContent {
  return {
    subject: 'Änderung an deinen Zahlungsdaten — Lese-Abenteuer',
    text: wrapText(
      `${description}\n\n` +
        `Warst du das nicht, melde dich bitte umgehend bei uns.`,
    ),
    html: wrapHtml(
      `<p>${description}</p>` + `<p>Warst du das nicht, melde dich bitte umgehend bei uns.</p>`,
    ),
  };
}

/**
 * Versendet eine Benachrichtigung über eine Änderung des Zahlungsmodus.
 * NOCH NICHT AN EIN ECHTES BEZAHLSYSTEM ANGEBUNDEN — es gibt aktuell keine
 * Abrechnung (siehe docs/SECURITY.md, "Produktionsanforderungen",
 * Billing-Notifications). Als Vorlage vorbereitet, damit das künftige
 * Bezahlsystem (siehe Sicherheitsprüfung 2026-07-28, Punkt 6) nur noch einen
 * Beschreibungstext erzeugen und diese Funktion aufrufen muss.
 *
 * @param email - Empfängeradresse.
 * @param description - Vollständiger, bereits formulierter Satz zur
 *   konkreten Änderung (z.B. "Deine hinterlegte Zahlungsmethode wurde
 *   geändert." oder "Dein Abo endet zum 31.08.2026.").
 */
export async function sendPaymentMethodChangedEmail(email: string, description: string): Promise<void> {
  await sendTransactionalEmail({ to: email, ...buildPaymentMethodChangedTemplate(description) });
}
