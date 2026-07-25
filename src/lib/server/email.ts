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

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
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

/**
 * Versendet den Passwort-Reset-Link. Gleiche Funktion/Signatur unabhängig
 * davon, ob ein echter Provider konfiguriert ist — der Aufrufer
 * (requestPasswordResetAction) muss den Unterschied nicht kennen.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${getAppBaseUrl()}/passwort-zuruecksetzen/${token}`;

  await sendTransactionalEmail({
    to: email,
    subject: 'Passwort zurücksetzen — Lese-Abenteuer',
    text:
      `Du hast angefordert, dein Passwort zurückzusetzen.\n\n` +
      `Klicke auf diesen Link, um ein neues Passwort zu vergeben (30 Minuten gültig):\n${resetUrl}\n\n` +
      `Falls du das nicht warst, kannst du diese E-Mail ignorieren — es ändert sich nichts an deinem Konto.`,
    html:
      `<p>Du hast angefordert, dein Passwort zurückzusetzen.</p>` +
      `<p><a href="${resetUrl}">Klicke hier, um ein neues Passwort zu vergeben</a> (30 Minuten gültig).</p>` +
      `<p>Falls du das nicht warst, kannst du diese E-Mail ignorieren — es ändert sich nichts an deinem Konto.</p>`,
  });
}
