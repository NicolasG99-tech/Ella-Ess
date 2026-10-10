import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/server/db';
import { verifyPassword } from '@/lib/server/password';
import { loginSchema } from '@/lib/validation/auth';
import { sendLoginNotificationEmail } from '@/lib/server/email';

// Sitzungs-Timeout, siehe Sicherheitsprüfung 2026-07-28, Punkt 5. Löst das
// vorherige, feste 30-Tage-maxAge ab (praktisch "nie automatisch abgemeldet")
// — Kinder nutzen ihr Profil oft unbeaufsichtigt auf einem Familien- oder
// (künftig) Schulgerät, ein wochenlang eingeloggtes Elternkonto wäre dort ein
// unnötiges Risiko. 20 Minuten als Standard; 45 Minuten für eine mögliche
// künftige Schulkonfiguration vorgesehen — es gibt aktuell noch kein
// Schul-/Organisationskonzept (kein eigenes Datenmodell für Schulen/Klassen),
// das eine automatische Umschaltung anhand der Kontoart erlauben würde, daher
// vorerst über die Umgebungsvariable SESSION_TIMEOUT_MINUTES konfigurierbar
// statt hart pro Rolle unterschieden. Siehe .env.example, docs/SECURITY.md.
const SESSION_TIMEOUT_MINUTES = Number(process.env.SESSION_TIMEOUT_MINUTES) || 20;
const SESSION_MAX_AGE_SECONDS = SESSION_TIMEOUT_MINUTES * 60;
// NextAuth verlängert bei der JWT-Strategie das Session-Cookie (inkl. neuer
// Ablaufzeit) automatisch, sobald seit dem letzten Update mindestens
// `updateAge` vergangen ist UND eine Anfrage eintrifft — dadurch wirkt
// `maxAge` faktisch als GLEITENDES Idle-Timeout: Bei fortlaufender Nutzung
// bleibt die Sitzung bestehen, bei SESSION_TIMEOUT_MINUTES Minuten
// Inaktivität läuft sie ab. `updateAge` bewusst auf ein Zehntel der maxAge
// (mind. 60s) gesetzt, statt NextAuths Standard von 24h, damit die
// Verlängerung während aktiver Nutzung zeitnah greift.
const SESSION_UPDATE_AGE_SECONDS = Math.max(60, Math.floor(SESSION_MAX_AGE_SECONDS / 10));

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValid = await verifyPassword(user.passwordHash, password);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  events: {
    // Feuert bei der JWT-Strategie ausschließlich bei einer tatsächlichen
    // Anmeldung über das Login-Formular (authorize() liefert einen neuen
    // User zurück) — NICHT bei jeder Session-Aktualisierung/jedem
    // Seitenaufruf (dafür ist der `jwt`-Callback oben zuständig, dort ohne
    // `user`-Argument). Daher hier unbedenklich als Login-Benachrichtigung
    // nutzbar, ohne bei normaler Nutzung zu spammen. Bewusst "fire and
    // forget"-artig ohne den Login-Vorgang zu blockieren oder bei einem
    // E-Mail-Fehler fehlzuschlagen — sendLoginNotificationEmail() wirft
    // selbst nicht (siehe email.ts, sendTransactionalEmail() fängt alle
    // Fehler intern ab). Siehe Sicherheitsprüfung 2026-07-28, Punkt 8.
    async signIn({ user }) {
      if (user?.email) {
        await sendLoginNotificationEmail(user.email, new Date());
      }
    },
  },
});
