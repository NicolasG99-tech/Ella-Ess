# Deployment

Dieses Dokument wird analog zu den anderen docs/-Dateien bei Bedarf erweitert.

## Entschiedener Ansatz: Hetzner + Coolify

- **App (Next.js)**: Hetzner-VPS (Standort Deutschland — Falkenstein oder Nürnberg), verwaltet über [Coolify](https://coolify.io/) (selbst gehostet, Open Source) als PaaS-Schicht. Deployment über das `Dockerfile` im Repo-Root (Next.js `output: 'standalone'`, siehe `next.config.ts`).
- **Datenbank**: Supabase (PostgreSQL, EU-Region), bereits entschieden — siehe `deployment-devops`-Agent und `.env.example`.
- **Spracherkennung (optional)**: Azure AI Speech, EU-/deutsche Datenzone (`germanywestcentral`), bereits entschieden — siehe `speech-provider`-Agent.

Begründung: deutsches Unternehmen, deutsche Rechenzentren — stärkste Datenhoheit (kein US CLOUD Act) bei gleichzeitig niedrigen Kosten (~5–10 €/Monat für einen VPS, der für den MVP-Traffic ausreicht) und einem Deployment-Workflow, der zum bestehenden Docker-Setup passt.

## Einmalige Einrichtung

1. **Hetzner-Server anlegen**: Cloud Console (nicht Webhosting — siehe Hinweis unten) → neuer Server, Standort Falkenstein oder Nürnberg, z. B. Typ **CX23** (2 vCPU/4 GB RAM/40 GB NVMe, ~4 €/Monat, Stand Juli 2026) für den MVP-Start; bei Bedarf später ohne Neuaufsetzen auf CPX22 (2 vCPU/4 GB, konsistentere Performance, ~8 €/Monat) hochskalieren. Ubuntu 24.04 LTS.
2. **Coolify installieren**: per SSH auf dem frischen Server das offizielle Install-Skript ausführen (siehe [Coolify-Dokumentation](https://coolify.io/docs)). Coolify läuft danach selbst als Docker-Setup auf dem Server und verwaltet weitere Deployments über eine Weboberfläche.
3. **Application in Coolify anlegen**: Git-Repository verbinden, Build-Pack **"Dockerfile"** wählen (nutzt das vorbereitete `Dockerfile`).
4. **Umgebungsvariablen in Coolify hinterlegen** (niemals im Repo!): alle Variablen aus `.env.example` mit echten Produktionswerten —
   - `DATABASE_URL`/`DIRECT_URL` (Supabase, siehe dortiger Kommentar in `.env.example`)
   - `AUTH_SECRET` (echt generiert via `npx auth secret`, **nicht** den Dev-Default übernehmen), `AUTH_TRUST_HOST=true`
   - `SPEECH_PROVIDER` (`mock` oder `azure`), ggf. `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`/`AZURE_SPEECH_LANGUAGE`
   - `DEMO_PARENT_*`/`DEMO_ADMIN_*` in Produktion bewusst **nicht** auf echte Zugangsdaten setzen bzw. den Seed-Schritt (siehe unten) für Demo-Daten in Produktion auslassen.
5. **Domain + TLS**: eigene Domain in Coolify hinterlegen — Let's-Encrypt-Zertifikat wird automatisch ausgestellt/erneuert.

## Bei jedem Deployment

- **Migrationen laufen NICHT automatisch beim Container-Start** (siehe Kommentar im `Dockerfile`) — bewusste Entscheidung, um Race Conditions bei (künftig) mehreren gleichzeitig startenden Instanzen zu vermeiden. Stattdessen vor bzw. als expliziter Schritt beim Deployment: `npm run db:migrate:deploy` gegen die Produktions-Datenbank ausführen (z. B. als Coolify "Post-deployment command" oder manuell).
- Seed-Daten (`npm run db:seed`) nur bewusst und nur bei Erstbefüllung ausführen — nicht bei jedem Deployment erneut (idempotent über `upsert`, aber für Produktionsdaten in der Regel nicht gewünscht, insbesondere die `DEMO_*`-Zugänge).

## Bekannte Einschränkungen dieses Setups (siehe auch docs/SECURITY.md)

- **Rate Limiting läuft DB-gestützt** über `RateLimitBucket` (Postgres/Prisma, siehe `src/lib/server/rate-limit.ts`) — übersteht Redeploys und funktioniert auch über mehrere gleichzeitige Coolify-Instanzen hinweg. Trade-off gegenüber Redis: kleines Race-Window bei sehr hoher Gleichzeitigkeit auf denselben Schlüssel, für MVP-Traffic akzeptabel (siehe docs/SECURITY.md).
- **Backups**: Supabase deckt Datenbank-Backups ab. Für den Hetzner-Server selbst (Coolify-Konfiguration, keine App-Daten, die liegen in Supabase) empfiehlt sich zusätzlich ein Hetzner-Snapshot.
- **Monitoring**: Coolify bietet ein einfaches Log-/Status-Dashboard; für Alerting/tiefergehendes Monitoring ist aktuell kein externer Dienst angebunden.
