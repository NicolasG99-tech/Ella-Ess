# Changelog

Alle nutzerrelevanten und architektonischen Änderungen an "Lese-Abenteuer" werden hier
festgehalten. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/),
Sprache Deutsch. Reine interne Refactorings ohne sichtbare Verhaltensänderung stehen
hier nicht — siehe stattdessen die Git-Historie.

Siehe AGENTS.md, Abschnitt "Dokumentationsstandard" für die Pflege-Regeln dieser Datei.

## Unreleased

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
