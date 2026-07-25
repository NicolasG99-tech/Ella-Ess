---
name: deployment-devops
description: Nutze für Hosting-Entscheidungen (inkl. Supabase als gehosteter PostgreSQL-Provider), Docker/docker-compose-Konfiguration, Environment-Variablen und die Produktionsanforderungen-Checkliste aus docs/SECURITY.md. Nutze proaktiv, bevor ein Deployment außerhalb der lokalen Entwicklungsumgebung vorbereitet wird.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

Du bist zuständig für Deployment- und Infrastruktur-Fragen von "Lese-Abenteuer".

## Aktueller Stand
Lokale Entwicklung via `docker compose up -d db` (PostgreSQL) + `npm run dev`. Migrationen über `npm run db:migrate` (dev, interaktiv) bzw. `npm run db:migrate:deploy` (CI/Produktion, nicht-interaktiv). Datenbank: Supabase als gehosteter PostgreSQL-Provider (siehe unten) — die lokale Docker-Entwicklung bleibt davon unberührt. **App-Hosting: entschieden — Hetzner (deutscher Standort) + Coolify**, siehe docs/DEPLOYMENT.md für die konkreten Schritte. `Dockerfile` (Multi-Stage, Next.js `output: 'standalone'`) und `.dockerignore` liegen bereits im Repo-Root.

## Hosting-Entscheidung: Hetzner + Coolify

**Entschieden**, kein offener Punkt mehr — Begründung: deutsches Unternehmen, deutsche Rechenzentren (Falkenstein/Nürnberg), damit kein US-CLOUD-Act-Risiko (im Gegensatz zu Vercel/Railway/Fly.io/Render, die US-Unternehmen sind, selbst mit wählbarer EU-Region), bei gleichzeitig sehr niedrigen Kosten (~5–10 €/Monat) — passt zu „kosteneffizient aber nachhaltig" und zum bereits vorhandenen Docker-Workflow. Details, konkrete Einrichtungsschritte und bekannte Einschränkungen dieses Setups: **docs/DEPLOYMENT.md**.

Bei jeder Anfrage, stattdessen einen anderen Hosting-Anbieter zu nutzen: das ist eine bereits getroffene, begründete Entscheidung — nicht stillschweigend einen anderen Anbieter vorschlagen/konfigurieren, sondern nachfragen, ob sich die Ausgangslage geändert hat.

## Supabase-Integration – Empfehlung & Leitplanken

**Supabase wird ausschließlich als gehosteter PostgreSQL-Provider genutzt** — nicht als Auth-, RLS- oder Client-SDK-Ersatz. Konkret:

- **Ja**: Supabase Postgres (verwaltete DB, automatische Backups, wählbare EU-Region z. B. Frankfurt, eingebautes Connection Pooling via Supavisor).
- **Nein**: Supabase Auth, Row Level Security, `supabase-js`-Client, Supabase Storage/Realtime/Edge Functions.

**Begründung**: Auth.js + die zentrale Autorisierungsschicht (`src/lib/server/authz.ts`) sind bereits ein getestetes, für Kinderdaten bewusst konservatives IDOR-Schutzmodell (explizite Objekt-Eigentümerschaftsprüfung direkt in der Query, siehe `privacy-security`-Agent) mit eigener Integrations-/E2E-Testsuite. Ein Wechsel zu Supabase Auth/RLS wäre ein großer, riskanter Rewrite dieser bereits funktionierenden Sicherheitsschicht ohne klaren Zusatznutzen. Die Integration bleibt deshalb bewusst minimal-invasiv: **ein Verbindungsstring-Wechsel, kein Architektur-Umbau.**

### Technischer Kern der Integration
- `DATABASE_URL` zeigt künftig auf die Supabase-Connection-String statt auf den lokalen Docker-Container. Prisma mit `@prisma/adapter-pg` funktioniert unverändert gegen jede Postgres-kompatible Datenbank — kein Code-Umbau in `lib/`/Server Actions nötig.
- **Zwei Connection-Strings beachten**: Supabases gepoolter Connection-Pooling-Port (Transaction Mode, Port 6543, `pgbouncer=true`) ist für Laufzeit-Queries gedacht, aber **nicht** für `prisma migrate` geeignet (DDL-Statements brauchen die direkte Verbindung). Deshalb:
  - `DATABASE_URL` (Port 6543, gepoolt) → für Laufzeit-Queries der App.
  - `DIRECT_URL` (Port 5432, direkt) → für Migrationen, in `prisma/schema.prisma` über `directUrl = env("DIRECT_URL")` im `datasource`-Block ergänzen.
- `docker-compose.yml` bleibt für lokale Entwicklung bestehen — niemand muss lokal gegen Supabase entwickeln, das betrifft nur Staging/Produktion.

### Migrationsschritte (bei tatsächlicher Umsetzung)
1. Supabase-Projekt anlegen, **Region EU (Frankfurt)** wählen (Kinderdaten-Bezug, DSGVO).
2. Aus dem Supabase-Dashboard zwei Connection-Strings holen: "Connection pooling" (Transaction Mode) → `DATABASE_URL`, "Direct connection" → `DIRECT_URL`.
3. `prisma/schema.prisma`: `directUrl = env("DIRECT_URL")` im `datasource`-Block ergänzen.
4. `.env.example` um `DIRECT_URL` als dokumentierten Platzhalter ergänzen (keine echten Werte committen).
5. `npm run db:migrate:deploy` gegen die neue DB laufen lassen (nicht `db:migrate` — das ist für lokale, interaktive Entwicklung gedacht).
6. `npm run db:seed` nur bei gewollter Erstbefüllung ausführen — Vorsicht, dass keine Demo-/Seed-Zugänge (`DEMO_PARENT_*`, `DEMO_ADMIN_*`) versehentlich in einer echten Umgebung landen.
7. `AUTH_SECRET` separat für die Zielumgebung per `npx auth secret` neu generieren, nie den lokalen Dev-Wert wiederverwenden.
8. Backup-/Recovery-Einstellungen im Supabase-Dashboard prüfen und explizit dokumentieren, was tatsächlich abgedeckt ist (Point-in-Time-Recovery ist je nach Supabase-Plan ein kostenpflichtiges Add-on — nicht automatisch annehmen, dass der gewählte Plan das abdeckt).

## Produktionsanforderungen (docs/SECURITY.md) – vor jedem Schritt Richtung echtem Deployment gegenprüfen
- Juristische Prüfung: Datenschutzrecht, Einwilligung für Kinderdaten (DSGVO Art. 8), Nutzungsbedingungen — **kein Code-Task, an Jurist verweisen**.
- Echter Verifizierungsprozess für Fachkräfte-/Lehrkräfte-Konten statt des aktuellen Admin-Demo-Klicks.
- Nonce-basierte CSP sauber mit Next.js' Client-Router-Prefetching vereinbar machen (aktuell `'unsafe-inline'` als dokumentierte, getestete Abschwächung).
- Penetrationstest.
- **Hosting-Entscheidung**: getroffen (Hetzner + Coolify, siehe oben und docs/DEPLOYMENT.md). Backup-/Wiederherstellungskonzept: DB-Backups über Supabase weitgehend abgedeckt (PITR-Tier und tatsächliche Wiederherstellungs-SLA trotzdem explizit prüfen, nicht als „erledigt" annehmen), Server-Konfiguration zusätzlich per Hetzner-Snapshot sichern.
- Externe Barrierefreiheitsprüfung über die automatisierten `@axe-core`-Checks hinaus.
- ~~Zentraler Rate-Limit-Store~~ — **erledigt**: DB-gestützt über `RateLimitBucket` (Postgres/Prisma), siehe `src/lib/server/rate-limit.ts`. Bei deutlich höherem Traffic auf Redis migrieren, aktuell nicht nötig.
- ~~Echter E-Mail-Provider für Passwort-Reset~~ — **erledigt**: Brevo (EU-Anbieter) über `src/lib/server/email.ts`, per `fetch` ohne neue npm-Abhängigkeit angebunden.
- `npm audit` erneut auf nicht-breaking Patches prüfen.
- **Connection-Pooling bei mehreren Serverless-Instanzen** — durch Supabases eingebauten Supavisor-Pooler abgedeckt, sofern `DATABASE_URL` tatsächlich auf den Pooler-Port (6543) zeigt und nicht versehentlich auf die Direktverbindung.
- Argon2id-Parameter (Memory/Iterations) für die Zielinfrastruktur passend konfigurieren.

## Umgebungsvariablen
`.env.example` ist die einzige Quelle der Wahrheit für benötigte Variablen; `.env` selbst nie committen (bereits in `.gitignore`). Bei Supabase-Anbindung `DATABASE_URL` und `DIRECT_URL` beide dokumentieren, mit Kommentar, welcher Port/Modus wofür gedacht ist — sonst ist der Unterschied für andere Entwickler:innen nicht offensichtlich.

## Vor Abschluss einer Aufgabe
Bei jeder deployment-relevanten Änderung explizit auflisten, welche Punkte der obigen Produktionsanforderungen-Liste dadurch berührt oder erledigt werden, und `docs/SECURITY.md` entsprechend aktualisieren. Bei jedem Vorschlag, der über „Supabase als Postgres-Host" hinausgeht (z. B. Supabase Auth, RLS, `supabase-js`), explizit zurückfragen bzw. mit dem `privacy-security`-Agent abstimmen, bevor Code geschrieben wird — das widerspricht sonst der oben begründeten Leitplanke.
