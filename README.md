# Lese-Abenteuer

Eine gamifizierte, deutschsprachige Web-App zur Förderung von Lesen, Leseflüssigkeit,
grundlegender Rechtschreibung und Textverständnis für Kinder von 7–10 Jahren.

Kinder lesen kuratierte Geschichten laut vor; die App verfolgt die Position im Text
anhand des Audios, gibt vorsichtiges, motivierendes Feedback und schaltet passend zum
Lesefortschritt von Menschen gestaltete Illustrationen frei.

> Dieses Produkt unterstützt beim Lesen — es diagnostiziert keine LRS/Legasthenie und
> ersetzt keine Logopädie oder Lerntherapie. Details siehe
> [docs/EDUCATIONAL_MODEL.md](docs/EDUCATIONAL_MODEL.md).

## Status

Der Aufbau erfolgte in Meilensteinen (siehe `docs/`). **Meilenstein 10 — Sicherheit,
Barrierefreiheit, Abschluss** ist abgeschlossen, damit ist der ursprünglich geplante
MVP-Funktionsumfang vollständig umgesetzt:

- Security Headers (CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` u.a.)
  auf praktisch jeder Route.
- Datenexport (`/dashboard/konto`, `/fachkraft/konto` → „Daten exportieren") und
  endgültige Kontolöschung (kaskadiert auf Datenbankebene über alle eigenen Daten).
- Ein automatisierter Barrierefreiheits-Scan (`@axe-core/playwright`) deckte zwei echte
  Probleme auf (fehlende `<main>`-Landmarks, leere Tabellen-Kopfzellen) — beide behoben.

Seit 2026-07-28 zusätzlich: ein **Bezahlsystem (Stripe)** mit drei gestaffelten
Tarifen (`/preise`, Verwaltung unter `/dashboard/abo`) — Checkout, Kündigung über das
Stripe-Kundenportal und Webhook-Synchronisation sind implementiert, aber noch NICHT
scharf geschaltet: Es gibt aktuell keine Server Action, die ein aktives Abo
tatsächlich voraussetzt. Details und offene Punkte siehe
[docs/SECURITY.md](docs/SECURITY.md), Abschnitt „Bezahlsystem (Stripe)".

Danach ergänzt: eine eigenständige **Lehrkräfte-Rolle** (`/registrieren-lehrer`,
`/lehrer`) neben Fachkräften, mit rollenspezifischen Fortschrittsdarstellungen — Eltern
sehen zusätzlich zu den bestehenden Fortschrittsbalken eine laienverständliche Kurz-
einordnung („Wie hat [Kind] begonnen / Wo steht es jetzt / Worauf achten"), Fachkräfte und
Lehrkräfte einen strukturierten, aus den Übungsdaten abgeleiteten Assessment-Bogen
(Fehlerarten, Skill-Bereiche, Genauigkeit nach Aufgabentyp). Details siehe
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), Abschnitt „Lehrkräfte-Rolle &
rollenspezifische Fortschrittsdarstellung".

**Dieses Projekt ist ein MVP für lokale Entwicklung/Demo-Zwecke, kein produktionsreifes
Produkt.** Vor einem echten Launch mit echten Kindern/Eltern braucht es u.a. eine
juristische Prüfung (Datenschutz, Einwilligung für Kinderdaten), einen echten
Verifizierungsprozess für Fachkräfte- und Lehrkräfte-Konten, einen Penetrationstest und
eine externe Barrierefreiheitsprüfung — die vollständige, laufend gepflegte Liste steht in
[docs/SECURITY.md](docs/SECURITY.md), Abschnitt „Produktionsanforderungen".

## Voraussetzungen

- Node.js ≥ 20.9 (getestet mit v26)
- Docker Desktop (oder eine andere Docker-Engine) für PostgreSQL
- npm

## Lokale Installation

```bash
npm install
cp .env.example .env   # Standardwerte funktionieren lokal ohne Anpassung
docker compose up -d db
npm run db:migrate      # wendet Migrationen an
npm run db:seed         # legt Stammdaten (Lernprofile) an
npm run dev
```

Die App läuft danach unter [http://localhost:3000](http://localhost:3000).

## Umgebungsvariablen

Siehe [.env.example](.env.example) für alle Variablen und Erklärungen. Alle Default-Werte
sind unbedenkliche lokale Entwicklungswerte, keine Produktionsgeheimnisse.

| Variable                                     | Zweck                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | PostgreSQL-Verbindung für Laufzeit-Queries (lokal: `docker-compose.yml`; bei Supabase: gepoolter Connection String, Port 6543) |
| `DIRECT_URL`                                 | Nur bei Supabase nötig: direkte PostgreSQL-Verbindung (Port 5432) für Migrationen, siehe unten |
| `AUTH_SECRET`                                | Signierschlüssel für Auth.js-Sessions (`npx auth secret` für einen echten Wert) |
| `SESSION_TIMEOUT_MINUTES`                    | Gleitendes Idle-Timeout der Sitzung in Minuten, Standard `20` (45 vorgesehen für eine künftige Schulkonfiguration, siehe docs/SECURITY.md) |
| `SPEECH_PROVIDER`                            | Spracherkennungs-Provider; im MVP nur `"mock"` implementiert                    |
| `STRIPE_SECRET_KEY`                          | Stripe-API-Schlüssel für das Bezahlsystem (siehe docs/SECURITY.md, „Bezahlsystem (Stripe)")   |
| `STRIPE_WEBHOOK_SECRET`                      | Signatur-Secret für den Stripe-Webhook-Endpunkt (`/api/webhooks/stripe`)        |
| `STRIPE_PRICE_BASIC` / `_FAMILY` / `_SCHOOL` | Stripe-Price-IDs der drei Tarife, siehe `src/lib/billing/plans.ts`              |
| `DEMO_PARENT_EMAIL` / `DEMO_PARENT_PASSWORD` | Zugangsdaten für den Seed-Demo-Elternaccount                                    |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`   | Zugangsdaten für das Seed-Admin-Konto (`/admin`, lokale Content-Verwaltung)     |

## Datenbank

```bash
docker compose up -d db        # PostgreSQL starten
npm run db:migrate             # Migrationen (Entwicklung, interaktiv)
npm run db:migrate:deploy      # Migrationen (nicht-interaktiv, z.B. CI)
npm run db:seed                # Seed-Daten einspielen
npm run db:studio              # Prisma Studio (DB-GUI)
```

### Supabase (gehostetes PostgreSQL)

Für Staging/Produktion kann statt der lokalen Docker-Datenbank ein gehostetes
Supabase-Postgres-Projekt genutzt werden. Supabase dient hier ausschließlich als
PostgreSQL-Hosting (verwaltete Backups, wählbares EU-Rechenzentrum, eingebautes
Connection Pooling via PgBouncer/Supavisor) — **nicht** als Ersatz für Auth.js oder
die App-eigene Autorisierungsschicht (`src/lib/server/authz.ts`); Supabase Auth, RLS
und `supabase-js` werden bewusst nicht eingesetzt (siehe
[docs/SECURITY.md](docs/SECURITY.md)). Der lokale Docker-Workflow bleibt der Standard
für die Entwicklung und ist von dieser Option unberührt.

1. Projekt auf [supabase.com](https://supabase.com) anlegen, dabei eine EU-Region
   wählen (z.B. Frankfurt) — relevant wegen des Kinderdaten-Bezugs der App.
2. Im Dashboard unter „Project Settings → Database → Connection string" zwei
   Connection Strings kopieren: „Connection pooling" (Transaction-Modus, Port 6543)
   und „Direct connection" (Port 5432).
3. `DATABASE_URL` auf den gepoolten String (Port 6543, `pgbouncer=true`) setzen,
   `DIRECT_URL` auf den direkten String (Port 5432) — siehe Kommentare in
   [.env.example](.env.example) für Details und ein Platzhalter-Beispiel.
4. Erste Migration gegen die gehostete DB anwenden — dabei `db:migrate:deploy`
   verwenden (nicht-interaktiv), nicht `db:migrate` (das ist für die lokale,
   interaktive Entwicklung gedacht):
   ```bash
   npm run db:migrate:deploy
   ```
5. `npm run db:seed` nur ausführen, falls eine Erstbefüllung tatsächlich gewünscht
   ist — dabei sicherstellen, dass keine Demo-/Seed-Zugänge (`DEMO_PARENT_*`,
   `DEMO_ADMIN_*`) in einer echten Umgebung landen.
6. `AUTH_SECRET` separat für die Zielumgebung erzeugen (`npx auth secret`), niemals
   den lokalen Dev-Wert wiederverwenden.

## Tests

```bash
npm run typecheck   # TypeScript strict, keine Fehler erlaubt
npm run lint         # ESLint
npm run format:check # Prettier-Check
npm run test          # Unit-/Integrationstests (Vitest)
npm run test:e2e      # End-to-End-Tests (Playwright, baut & startet die App automatisch)
```

## Produktions-Build

```bash
npm run build
npm run start
```

## Docker

`docker-compose.yml` startet aktuell ausschließlich PostgreSQL für die lokale
Entwicklung. Eine vollständige Containerisierung der App selbst ist keine
MVP-Anforderung und folgt bei Bedarf vor einem echten Produktionseinsatz
(siehe [docs/SECURITY.md](docs/SECURITY.md), Abschnitt „Produktionsanforderungen").

## Demo-Zugang

`npm run db:seed` legt an:

- Ein **Demo-Elternkonto** (`parent@example.com`, Passwort aus `.env`) mit Demo-Kinderprofil
  „Mia".
- Ein **Demo-Admin-Konto** (`admin@example.com`, Passwort aus `.env`) für die lokale
  Content-Verwaltung unter [/admin](http://localhost:3000/admin).
- **5 kuratierte Geschichten** (je mit Textabschnitten, 5 Illustrationsebenen, 2–4
  Verständnisfragen), **20 Wortübungen**, **10 Rechtschreibübungen** (alle vier Typen),
  **7 Literacy-Skills** und **7 Belohnungen** (2 Sterne, 5 Abzeichen) — siehe `src/content/`.

## Bekannte Einschränkungen (Stand Meilenstein 10)

- **`script-src` der Content-Security-Policy erlaubt `'unsafe-inline'`** statt eines
  strengeren Nonce-Ansatzes — ein Nonce-Versuch wurde mit einem echten E2E-Test wieder
  verworfen, da pro Proxy-Aufruf neu generierte Nonces nicht mit Next.js' client-seitigem
  Prefetching zusammenpassen (siehe [docs/SECURITY.md](docs/SECURITY.md)).
- Der automatisierte Barrierefreiheits-Scan deckt keine manuelle
  Screenreader-/Tastaturprüfung und kein vollständiges Farbkontrast-Audit ab.
- **Fachkräfte-Verifizierung ist eine lokale Admin-Demo, keine echte
  Qualifikationsprüfung** — ein Admin-Klick auf „Verifizieren" bestätigt nichts
  Fachliches. Vor einem echten Einsatz braucht es einen belastbaren
  Verifizierungsprozess (z.B. Nachweis der Berufszulassung) — siehe
  [docs/EDUCATIONAL_MODEL.md](docs/EDUCATIONAL_MODEL.md), Abschnitt „Später von
  Fachpersonal zu prüfen".
- Der Fachkräfte-Bereich erlaubt ausschließlich freien Textaustausch (Notizen) auf Basis
  der App-eigenen Fortschrittsübersicht — keine Video-/Audiokommunikation, keine
  Diagnosefunktion, keine Therapieplanung, kein Zugriff auf Rohaudiodaten (die ohnehin
  nie den Browser des Kindes verlassen, siehe SECURITY.md).
- Freigaben (`ChildAccessGrant`) unterstützen im Datenmodell ein optionales Ablaufdatum
  (`expiresAt`), das im MVP über die UI nicht gesetzt werden kann — Zugriff bleibt aktiv,
  bis Eltern ihn manuell widerrufen.
- Die Fortschrittsübersicht zeigt maximal die letzten 5 abgeschlossenen Geschichten
  („Zuletzt gelesen") und keine historische Verlaufsgrafik über die Zeit — nur den
  aktuellen Stand.
- Rechtschreibbelohnungen ("Übungsstern" etc.) werden **lebenslang pro Kind** gezählt,
  nicht pro Sitzung oder Tag — analog zur Versuchszählung bei Rechtschreibübungen (siehe
  unten). Der Belohnungskatalog (`Reward.type`) sieht zusätzlich `avatar_item` vor, das im
  MVP noch nicht aktiv genutzt wird (analog zur Rolle `specialist`, siehe
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- Rechtschreibübungen erlauben je Kind und Aufgabe **lebenslang** maximal zwei Versuche
  (keine Sitzungs- oder Tages-Zurücksetzung) — nach dem zweiten falschen Versuch wird die
  Lösung dauerhaft aufgedeckt. Ein Zurücksetzen ist nur über die Datenbank möglich (siehe
  `src/lib/exercises/exerciseService.ts`).
- Der Übungsbereich (`/uebungen`) merkt sich keinen Bearbeitungsfortschritt zwischen
  Seitenaufrufen — ein erneuter Aufruf einer Übung beginnt immer bei Aufgabe 1.
- `SPEECH_PROVIDER=mock` ist der einzige implementierte Anbieter. Der Mock verarbeitet
  keine echten Audiodaten — aufgenommenes Audio wird nie an den Server übertragen (siehe
  [docs/SECURITY.md](docs/SECURITY.md)). Ein „Entwickler-Testmodus" in der Leseansicht
  erlaubt, jedes der 8 Bewertungsszenarien gezielt zu simulieren.
- Das Fortsetzen einer unterbrochenen Lesesitzung funktioniert auf Abschnitts-, nicht auf
  Wortebene (ein pausierter Abschnitt beginnt beim Fortsetzen erneut bei Wort 1).
- In dieser Sandbox-Umgebung steht kein (auch kein simuliertes) Mikrofon-Audiogerät zur
  Verfügung. Der Testmodus-Button „Ergebnis simulieren (ohne Aufnahme)" (Meilenstein 4)
  erlaubt inzwischen aber einen kompletten End-to-End-Test einer ganzen Lesesitzung
  inklusive Verständnisfragen und Belohnungsvergabe ohne echte Aufnahme (siehe
  `tests/e2e/gamification.spec.ts`); nur die eigentliche Mikrofonaufnahme selbst bleibt
  auf einen Vitest-Integrationstest (`tests/integration/reading-session.test.ts`)
  angewiesen.
- Illustrationen sind bewusst einfache, selbst erstellte SVG-Platzhalter (siehe
  `public/illustrations/`), keine professionelle Kinderbuch-Kunst.
- Die Admin-Demo erlaubt nur das Veröffentlichen/Verbergen einer Geschichte, keine
  Content-Erstellung über die UI — Inhalte werden kuratiert in `src/content/` gepflegt und
  per Seed eingespielt (bewusst gegen Laufzeit-Texterstellung durch ein Sprachmodell, siehe
  [docs/EDUCATIONAL_MODEL.md](docs/EDUCATIONAL_MODEL.md)).
- Passwort-Reset ist strukturell vollständig (Token, Ablauf, Verbrauch), aber der
  E-Mail-Versand ist gemockt (Link erscheint nur im Server-Log) — siehe
  `src/features/auth/actions.ts` und [docs/SECURITY.md](docs/SECURITY.md).
- Rate Limiting ist In-Memory und pro Prozess, kein zentraler Store — siehe
  [docs/SECURITY.md](docs/SECURITY.md).
- `docker-compose.yml` enthält nur die Datenbank, keinen App-Container.

## Weitere Dokumentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Komponentenübersicht, Datenfluss, Provider-Abstraktion
- [docs/SECURITY.md](docs/SECURITY.md) — Bedrohungsmodell, Schutzmaßnahmen, Produktionsanforderungen
- [docs/EDUCATIONAL_MODEL.md](docs/EDUCATIONAL_MODEL.md) — Lernprofile, Feedbackregeln, Abgrenzung zur Diagnostik
