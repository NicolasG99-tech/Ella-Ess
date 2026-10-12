# Changelog

Alle nutzerrelevanten und architektonischen Änderungen an "Lese-Abenteuer" werden hier
festgehalten. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/),
Sprache Deutsch. Reine interne Refactorings ohne sichtbare Verhaltensänderung stehen
hier nicht — siehe stattdessen die Git-Historie.

Siehe AGENTS.md, Abschnitt "Dokumentationsstandard" für die Pflege-Regeln dieser Datei.

## Unreleased

### Hinzugefügt

- **Preise auf `/preise` sichtbar** (Preisentscheidung 2026-10-12): Basic 15,00 €,
  Familie 22,00 €, jeweils pro Monat inkl. MwSt.; Schule „Preis auf Anfrage“ ohne
  Checkout-Button. Anzeigepreise stehen in `monthlyPriceCents`
  (`src/lib/billing/plans.ts`) und müssen von Hand mit den Stripe-Preisen
  übereinstimmen (Abrechnungsquelle bleibt Stripe). `getStripePriceId()` lehnt
  „auf Anfrage“-Tarife ab, sodass auch ein direkter Aufruf von
  `createCheckoutSessionAction('school')` keinen Checkout mehr startet
  (Verhaltensänderung). Tests: `tests/unit/billing-plans.test.ts`.
- **Bezahlsystem (Stripe)** — Ergebnis der Produktentscheidung "Jetzt Zahlungsmodell"
  (2026-07-28): drei gestaffelte Tarife (Basic/Familie/Schule, `src/lib/billing/plans.ts`),
  vorerst ohne kostenlose Testphase. Neue `Subscription`-Tabelle
  (`prisma/schema.prisma`), Checkout-Flow (`/preise`, `createCheckoutSessionAction`),
  Stripe-Kundenportal für Kündigungen (`/dashboard/abo`,
  `createBillingPortalSessionAction` — erfüllt die Kündigungsbutton-Pflicht aus
  § 312k BGB), Webhook-Handler (`/api/webhooks/stripe`) synchronisiert den lokalen
  Abo-Status und löst Benachrichtigungsmails aus (`sendPaymentMethodChangedEmail`).
  `requireActiveSubscription()` (`src/lib/server/authz.ts`) steht als
  Feature-Gating-Baustein bereit, ist aber noch an keiner Server Action angebunden —
  siehe docs/SECURITY.md, Abschnitt „Bezahlsystem (Stripe)" für den vollständigen
  Stand und offene Punkte. **Manuell nachzuholen** (im Sandbox-Environment nicht
  möglich, siehe README „Bekannte Sandbox-Einschränkungen"): `npm install` (zieht das
  neue `stripe`-Paket), `npx prisma generate` + `npx prisma migrate dev` (neue
  `Subscription`-Tabelle), echtes Stripe-Konto mit drei Produkten/Preisen anlegen,
  `.env` um `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_*` ergänzen.
- Rate Limiting für kindgerichtete Inhalts-Aktionen (Leseversuch einreichen, Hilfe
  anfordern, Verständnisfrage beantworten, Rechtschreib-/Wortleseübung abschicken):
  gemeinsames Kontingent von 10 Aktionen/Minute pro Kinderprofil
  (`checkChildContentRateLimit` in `src/lib/server/rate-limit.ts`), unabhängig von den
  bereits bestehenden, separaten Limits für Login/Registrierung/Passwort-Reset. Bei
  Sperre erhält das Kind einen freundlichen, nicht wertenden Hinweis ("Kurze Pause —
  das war schnell hintereinander!") statt eines Fehlers; der Versuch zählt nicht als
  falsche Antwort. Ergebnis der Sicherheitsprüfung vom 2026-07-28, Punkt 3.
- Sitzungs-Timeout auf ein gleitendes Idle-Timeout von 20 Minuten umgestellt (statt
  fester 30 Tage), konfigurierbar über `SESSION_TIMEOUT_MINUTES`; 45 Minuten für eine
  mögliche künftige Schulkonfiguration vorgesehen. Siehe `src/lib/server/auth.ts`,
  docs/SECURITY.md. Ergebnis der Sicherheitsprüfung vom 2026-07-28, Punkt 5.
- docs/SECURITY.md: Billing-Notifications als kommende Produktionsanforderung
  dokumentiert (N/A bis ein Bezahlsystem existiert). Ergebnis der Sicherheitsprüfung
  vom 2026-07-28, Punkt 6.
- `src/lib/server/email.ts` von einer einzelnen Passwort-Reset-Funktion zu einem
  generischen Benachrichtigungs-Template-System ausgebaut (gemeinsamer Rahmen +
  Vorlagen für Auth-Codes, Datenschutzbenachrichtigungen, Login-Benachrichtigungen,
  Änderungen am Zahlungsmodus). Aktiv angebunden: Login-Benachrichtigung bei jeder
  echten Anmeldung (`events.signIn` in `src/lib/server/auth.ts`) und
  Datenschutz-Bestätigungsmail bei Kontolöschung. Auth-Code- und
  Zahlungsmodus-Vorlagen sind vorbereitet, aber noch ohne Aufrufer (kein
  E-Mail-Verifizierungs- bzw. Bezahlsystem vorhanden). Ergebnis der
  Sicherheitsprüfung vom 2026-07-28, Punkte 7+8.
- docs/SECURITY.md: unverbindliche rechtliche Orientierung für ein künftiges
  Bezahlsystem ergänzt (Button-Lösung § 312j BGB, Kündigungsbutton § 312k BGB,
  Widerrufsrecht § 356 BGB, Taschengeldparagraph § 110 BGB, DSGVO Art. 8) — keine
  Rechtsberatung, siehe dortiger Hinweis. Ergebnis der Sicherheitsprüfung vom
  2026-07-28, Punkt 9.
- Cookie-Einwilligungssystem (§ 25 TDDDG): globales Banner (`CookieConsentBanner.tsx`)
  fragt granular vier Kategorien ab (Notwendig/Funktional/Statistik/Marketing),
  Entscheidung in `localStorage`, jederzeit widerrufbar über einen dauerhaften
  „Cookie-Einstellungen"-Button. `hasConsent(category)` als zentrale Prüfstelle für
  künftigen Code, der nicht-notwendige Cookies/Skripte einbinden will — aktuell setzt
  die App noch keine (siehe `src/lib/consent/cookieConsent.ts`, docs/SECURITY.md).
  Ergebnis der Sicherheitsprüfung vom 2026-07-28, Punkt 10.

### Behoben

- **Stripe-Webhook: Abo-Status explizit abgebildet** (`src/lib/billing/subscriptionService.ts`):
  Der Stripe-Status wurde bisher ungeprüft in das Prisma-Enum `SubscriptionStatus`
  geschrieben (Typfehler bei `tsc`; ein künftiger, unbekannter Stripe-Status hätte zur
  Laufzeit den DB-Schreibvorgang und damit den Webhook scheitern lassen).
  `mapStripeSubscriptionStatus()` ordnet jetzt jeden bekannten Status einzeln zu und
  speichert unbekannte Status „fail closed“ als `incomplete` (kein Zugang, Fehler im
  Log). Benachrichtigungsmails bestätigen bei nicht aktivem Status (z. B. `paused`)
  keinen laufenden Tarif mehr. Der Audit-Eintrag `subscription.sync` enthält zusätzlich
  den rohen Stripe-Status (`stripeStatus`, auf 64 Zeichen gekürzt). Tests:
  `tests/unit/billing-subscription-service.test.ts`, `tests/unit/stripe-webhook-route.test.ts`
  und `tests/unit/stripe-webhook-signature.test.ts` (echte SDK-Signaturprüfung:
  manipulierter Body, falsches Secret und veralteter Zeitstempel werden mit 400 abgelehnt).

- Cookie-Banner: Nach Annehmen/Ablehnen der Cookies war die Seite nicht mehr
  aufrufbar (Endlos-Rendering). Ursache: `getStoredConsent()` lieferte bei jedem
  Aufruf ein neues Objekt, `useSyncExternalStore()` verlangt bei unverändertem Inhalt
  aber dasselbe Objekt. Fix: Ergebnis wird zwischengespeichert, solange sich der
  gespeicherte Rohtext nicht ändert (`src/lib/consent/cookieConsent.ts`).
- RLS-Migration `20260728120000_enable_row_level_security` referenzierte die erst
  später angelegte Tabelle `Subscription` und scheiterte deshalb in der Shadow-DB
  (Prisma-Fehler P3006/42P01). `Subscription` dort entfernt, RLS für diese Tabelle
  stattdessen in `20261010091234_add_subscription` direkt nach dem `CREATE TABLE`.
- **Kritisch**: Row Level Security (RLS) auf allen Tabellen aktiviert (Migration
  `20260728120000_enable_row_level_security`), nachdem Supabases Sicherheitsprüfung
  `rls_disabled_in_public` und `sensitive_columns_exposed` meldete — ohne RLS war
  Supabases automatisch generierte, von dieser App nie genutzte PostgREST-API für
  jede Tabelle (inkl. `User.passwordHash`) öffentlich ohne jede Prüfung erreichbar.
  Bewusst weiterhin ohne eigene SQL-Policies (Default-Deny reicht, App verbindet als
  Tabellenbesitzer und bleibt unberührt) — siehe docs/SECURITY.md, Präzisierung vom
  2026-07-28 zum Abschnitt "App-eigene Schicht statt Supabase RLS". **Manuell
  nachzuholen**: SQL aus der Migration sofort im Supabase SQL Editor der
  Produktions-DB ausführen (siehe Chat-Anweisung), da diese Warnung eine bereits
  live erreichbare Datenbank betrifft und nicht bis zum nächsten Deploy warten sollte.
- `tests/unit/rate-limit.test.ts`: Testfälle riefen das seit der Postgres-Umstellung
  asynchrone `checkRateLimit()` ohne `await` auf und verglichen dadurch ein
  Promise-Objekt statt des aufgelösten Werts — technisch immer falsch. Fix: `it()`
  als `async`, `await` bei jedem Aufruf.

### In Konzeptphase (noch nicht implementiert)

- **Adaptive individuelle Aussprachekorrektur**: pro Kind gespeicherte, häufig
  falsch gelesene Wörter/Muster sollen zukünftige Textauswahl beeinflussen (auch in
  passiv vorgelesenen Textteilen) — siehe docs/EDUCATIONAL_MODEL.md, Abschnitt
  "Adaptive individuelle Wortwiederholung (Konzept)".
- **Passive Sprachvorbild-Elemente**: Texte sollen künftig aktiv vom Kind gelesene und
  passiv vorgelesene (Sprachvorbild-)Abschnitte kombinieren — siehe
  docs/EDUCATIONAL_MODEL.md, Abschnitt "Passive Sprachvorbild-Elemente (Konzept)", und
  docs/ARCHITECTURE.md.
- **Azure AI Speech Aktivierung**: Einrichtung in `germanywestcentral`, Funktionstest
  nach Einbettung, zunächst nur mit eigener Erwachsenenstimme unter eigener
  Einwilligung — siehe `.claude/agents/speech-provider.md` für die
  Aktivierungsvoraussetzungen (AVV, Einwilligungstexte, rechtliche Einordnung).
- **E-Book-Bibliothek**: zusätzlich zum bestehenden Angebot nutzbare, an das Kind und
  seine Interessen kuratierte Geschichtensammlung — für spätere Entwicklungsschritte
  notiert (Stand 2026-07-28), siehe docs/EDUCATIONAL_MODEL.md, Abschnitt
  "E-Book-Bibliothek (Konzept)".

## 2026-07-25

### Hinzugefügt

- Zentraler, DB-gestützter Rate-Limiter (`RateLimitBucket`-Modell,
  `src/lib/server/rate-limit.ts`) statt In-Memory-Map — übersteht Neustarts, wirkt über
  mehrere Instanzen hinweg.
- Echter Passwort-Reset-E-Mail-Versand über Brevo (`src/lib/server/email.ts`), mit
  Log-Fallback ohne konfigurierten `BREVO_API_KEY`.
- Wortpositions-basierte Illustrationsfreischaltung (`unlockAfterWordIndex` auf
  `IllustrationLayer`) über Inline-Marker `[[unlock:layerName]]` im Autorentext, siehe
  docs/CONTENT_AUTHORING.md.
- Content-Autoren-Workspace (`content-drafts/<slug>/`) mit Importskript
  (`npm run content:import`), das generierten Content von Hand gepflegtem Content in
  `src/content/stories.ts` trennt.
- Produktivbetrieb erstmals live: Hetzner-Cloud-Server + Coolify (App-Hosting,
  Docker-Deployment) + Supabase (PostgreSQL, Region Frankfurt) — siehe
  docs/DEPLOYMENT.md.

### Behoben

- `Dockerfile`: generierter Prisma-Client (`src/generated/prisma`, eigener
  `output`-Pfad außerhalb von `node_modules`) fehlte in der Builder-Stage, da nur
  `node_modules` aus der `deps`-Stage kopiert wurde — führte zu
  `Module not found: Can't resolve '@/generated/prisma/client'` beim Docker-Build.
  Fix: expliziter `COPY --from=deps /app/src/generated/prisma ./src/generated/prisma`.

### Dokumentation

- docs/CONTENT_AUTHORING.md neu angelegt (Autoren-Workspace-Format, Marker-Syntax).
- docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DEPLOYMENT.md um die obigen Punkte
  ergänzt.
