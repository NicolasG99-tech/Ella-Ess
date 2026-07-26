<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dokumentationsstandard (projektweit verbindlich)

Gilt für jeden Agenten und jede Code-Änderung in diesem Projekt, unabhängig vom
Verantwortungsbereich (Frontend/Backend/Content/Security/Deployment). Kein optionales
"Nice-to-have" — Teil der Definition of Done jeder Aufgabe.

1. **README.md aktuell halten.** Wenn eine Änderung den in README.md beschriebenen
   Funktionsumfang, die Installationsschritte, Umgebungsvariablen oder den
   Demo-Zugang betrifft, wird README.md im selben Arbeitsschritt mit angepasst — nicht
   als separater Nachtrag.
2. **Inline-Kommentare erklären das "Warum", nicht das "Was".** Code, der sich selbst
   erklärt, braucht keinen Kommentar über das Offensichtliche. Ein Kommentar ist Pflicht,
   wenn eine Codezeile/ein Block einen nicht selbsterklärenden Grund hat — z. B. eine
   bewusste Abweichung vom naheliegenden Ansatz, eine Sicherheits-/Datenschutz-Entscheidung,
   ein Workaround für eine Bibliothekseigenheit, oder eine Zahl/Schwelle, deren Herkunft
   sonst unklar wäre. Beispiele im Projekt bereits etabliert: die Kommentare in
   `src/lib/server/rate-limit.ts`, `Dockerfile` (Prisma-Client-Copy-Schritt) und
   `src/lib/providers/speech/audioPreprocessing.ts` (Grenzen des Pitch-Shifts).
3. **Docstrings für alle API-Schnittstellen.** Jede öffentlich exportierte Funktion, die
   eine Grenze überschreitet — Server Actions, Service-Layer-Funktionen in `lib/*/*.ts`,
   Provider-Interfaces (`SpeechRecognitionProvider` u. Ä.), Route Handler — bekommt einen
   kurzen JSDoc-Block: Zweck, Parameter mit Bedeutung (nicht nur Typ), Rückgabewert,
   relevante Nebenwirkungen (z. B. Audit-Log-Eintrag, E-Mail-Versand). Rein interne,
   pure Hilfsfunktionen ohne exportierte Verwendung außerhalb ihrer Datei sind ausgenommen,
   wenn ihr Name bereits eindeutig ist.
4. **CHANGELOG.md bei jeder nutzerrelevanten oder architektonischen Änderung
   ergänzen** (neues Feature, Verhaltensänderung, Sicherheits-Fix, neue
   Produktionsvoraussetzung, Breaking Change an Env-Variablen/Migrationen). Format: siehe
   CHANGELOG.md selbst (angelehnt an "Keep a Changelog", deutschsprachig, Abschnitt
   "Unreleased" für noch nicht deployte Änderungen). Reine interne Refactorings ohne
   sichtbare Verhaltensänderung müssen nicht rein, kleinere Doku-Tippfehler auch nicht.

Bei Unsicherheit, ob etwas dokumentationspflichtig ist: lieber dokumentieren als
auslassen — das Projekt hat mehrfach gezeigt (siehe Sandbox-Einschränkungen in
docs/DEPLOYMENT.md, Supabase-Hinweise in .env.example), dass knappe Begründungskommentare
späteren Sitzungen/Personen viel Nachfragen ersparen.
