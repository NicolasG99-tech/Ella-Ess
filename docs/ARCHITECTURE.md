# Architektur

Dieses Dokument wird mit jedem Meilenstein erweitert. Stand: Meilenstein 10.

## Komponentenübersicht

```
Next.js App Router (TypeScript strict)
├── Kinderbereich   – spielerisch, bildorientiert, große Touch-Ziele
├── Elternbereich   – Dashboard, Profilverwaltung, Datenschutz
└── Admin-Demo      – lokale Content-Verwaltung (kein öffentlicher Marktplatz)

Server Actions (Zod-validiert) → zentrale authz()-Guard → lib/server/*
lib/providers/speech/*  – SpeechRecognitionProvider-Abstraktion (Mock + Adapter-Stub)
lib/reading/*           – Textpositions-Erkennung, Bewertungs-Zustandsmaschine
Prisma ORM (Driver-Adapter @prisma/adapter-pg) → PostgreSQL (Docker)
Auth.js (next-auth v5, Credentials-Provider, JWT-Sessions)
```

Kernprinzip: **UI ↔ Provider ↔ Datenzugriff sind getrennt.** UI-Komponenten importieren
nie eine konkrete Provider-Implementierung direkt, sondern nur das Interface aus
`lib/providers/speech/types.ts`. Das erlaubt, `MockSpeechRecognitionProvider` später
durch einen echten Anbieter zu ersetzen, ohne UI-Code anzufassen.

## Datenfluss (Lesesitzung, Stand Meilenstein 4)

Eine "Aufnahme" entspricht in der UI einem ganzen Textabschnitt (2–5 Sätze), nicht
einem einzelnen Wort — das hält die Anzahl der Server-Roundtrips gering und passt zur
Segmentgröße der Story-Inhalte.

1. Client nimmt ein Audio-Segment auf (`useAudioRecorder`, MediaRecorder-API). Das Audio
   wird **nie an den Server übertragen** — der Mock-Provider benötigt keine echten
   Audiodaten, siehe „Audioverarbeitung" unten.
2. Client ruft `submitReadingAttemptAction` auf (Server Action). Diese prüft
   Autorisierung (`requireOwnChildProfile`) und delegiert an
   `lib/reading/readingSessionService.ts` — eine von der Action-Hülle getrennte
   Orchestrierungsschicht, damit sie ohne Next.js-Request-Kontext direkt
   integrationstestbar ist (siehe `tests/integration/reading-session.test.ts`).
3. `SpeechRecognitionProvider.transcribeAudio()` liefert erkannte Wörter mit
   Konfidenzwerten (im Mock: simuliert, siehe „Provider-Abstraktion").
   `alignToTargetText()` (delegiert an `lib/reading/positionTracker.ts`) bestimmt die
   neue Leseposition. `evaluateReadingAttempt()` leitet daraus einen konservativen
   Bewertungszustand ab.
4. `computeSessionStep()` (`lib/reading/sessionStateMachine.ts`) entscheidet, ob die
   Position vorrückt, eine Wiederholung nötig ist, oder — nach maximal 2 Wiederholungen —
   Hilfe angeboten wird (nie eine Endlosschleife).
5. Ergebnis wird als `ReadingAttempt`/`WordEvaluation` persistiert. Erreicht die Position
   das Ende eines Abschnitts, rückt `ReadingSession.currentSectionOrder` automatisch vor;
   war es der letzte Abschnitt, wird die Sitzung als `completed` markiert. Beim
   Abschnittswechsel prüft `lib/reading/illustrationUnlockService.ts`, welche
   `IllustrationLayer`s ab diesem Abschnitt freigeschaltet sind, und legt dafür
   `UnlockedIllustration`-Zeilen an (idempotent — siehe „Illustrationsfreischaltung"
   unten).
6. UI erhält den neuen Zustand (Position, Rückmeldungstext, Wiederholungszähler, neu
   freigeschaltete Illustrationsebenen) und rendert entsprechend — inklusive
   Wort-für-Wort-Hervorhebung im Text und weicher Einblend-Animation für neue
   Illustrationsebenen.

## Illustrationsfreischaltung (Meilenstein 5)

- Freischaltung hängt **ausschließlich vom erreichten Abschnitt** ab
  (`IllustrationLayer.unlockAfterSectionOrder`), nie von Lesegeschwindigkeit oder
  Versuchsanzahl — `unlockIllustrationsForCompletedSection()` erhält nur die
  Sitzungs-ID, Story-ID und den gerade abgeschlossenen Abschnitt, keine Zeitangaben.
- Seit Meilenstein 11 (Content-Autoren-Workspace) gibt es zusätzlich eine
  **wortpositions-basierte** Freischaltung innerhalb eines Abschnitts
  (`IllustrationLayer.unlockAfterWordIndex`), gespeist aus Inline-Markern
  `[[unlock:layerName]]` im Autorentext (siehe docs/CONTENT_AUTHORING.md). Auch das
  ist rein positionsbasiert (welches Wort gerade erreicht wurde), nicht zeit- oder
  tempobasiert — die pädagogische Garantie „keine Bewertung von Lesegeschwindigkeit"
  bleibt unverändert. `unlockIllustrationsForWordCheckpoint()` läuft ergänzend zu
  `unlockIllustrationsForCompletedSection()` bei jedem `submitReadingAttempt`; beide
  schreiben idempotent in dieselbe `UnlockedIllustration`-Tabelle.
- Freischaltstatus wird pro `ReadingSession` in `UnlockedIllustration` gespeichert
  (`@@unique([readingSessionId, illustrationLayerId])` verhindert Duplikate); ein
  fortgesetzter Lesevorgang zeigt exakt die zuvor freigeschalteten Ebenen erneut, ohne
  die Freischalt-Animation erneut auszulösen.
- `IllustrationStack.tsx` stapelt die freigeschalteten Ebenen nach `renderOrder`
  übereinander (`next/image`, lokale SVGs unter `public/illustrations/`). Neu
  freigeschaltete Ebenen erhalten eine weiche, rein optionale CSS-Einblendanimation
  (`animate-illustration-unlock`, `globals.css`), die sowohl die
  Kindprofil-Einstellung `reducedMotion` als auch die System-Einstellung
  `prefers-reduced-motion` respektiert.
- `next.config.ts` aktiviert `images.dangerouslyAllowSVG` mit restriktiver
  Content-Security-Policy (`script-src 'none'; sandbox;`) — unbedenklich, da alle
  SVGs selbst erstellt sind (kein Nutzer-Upload, keine Skripte).

## Verständnisfragen & Übungen (Meilenstein 6)

- **Verständnisfragen** laufen direkt im Anschluss an eine abgeschlossene Lesesitzung
  (`ReadingView.tsx`, Phase `'comprehension'`) und gehören damit zur Lesesitzung, nicht
  zum eigenständigen Übungsbereich. `lib/comprehension/evaluateAnswer.ts` ist eine reine
  Funktion, die je nach Fragetyp unterschiedlich vergleicht: `boolean` (Aussage
  richtig/falsch), normalisierter String (Multiple-Choice/Inferenz), Array in exakter
  Reihenfolge (Reihenfolge-Fragen). `comprehensionService.ts` erlaubt maximal zwei
  Versuche pro Frage und Sitzung (gezählt über `ComprehensionAttempt`, gefiltert nach
  `readingSessionId` — ein neuer Lesedurchgang setzt den Zähler also zurück), zeigt beim
  ersten Fehlversuch nur einen Hinweistext, deckt die richtige Antwort erst beim
  endgültigen Fehlversuch auf.
- **Übungen** (`/uebungen/[childId]`) sind ein eigenständiger Bereich, unabhängig von
  einer Lesesitzung. Fünf Übungstypen: `word_reading` (Selbstauskunft „gelesen“, keine
  Bewertung), `spelling_gap_fill`/`letter_order`/`syllable_build`/`dictation`
  (Texteingabe, exakter Abgleich mit `solution`/`acceptedVariants` — bewusst ohne
  Fuzzy-Toleranz wie beim Vorlesen, da Rechtschreibung exakt sein soll).
  `exerciseService.ts` zählt Versuche **lebenslang pro Kind und Übungsaufgabe** (nicht
  pro Sitzung, da `ExerciseItem` keine Verbindung zu einer Sitzung hat) — siehe README,
  „Bekannte Einschränkungen“.
- **Fortschrittsberechnung**: `lib/progress/masteryCalculation.ts` aktualisiert
  `SkillProgress.masteryLevel` (0–1) nur beim finalen (nicht mehr wiederholbaren)
  Versuchsergebnis, per exponentiell gleitendem Mittelwert
  (`neu = alt + 0.25 × (Ziel − alt)`, Ziel abhängig von
  „richtig beim ersten Versuch“/„richtig beim zweiten Versuch“/„falsch“). Betrifft alle
  `LiteracySkill`s des jeweiligen `LearningProfile`, nicht nur ein einzelnes Skill —
  bewusst grob für den MVP, siehe EDUCATIONAL_MODEL.md für die fachliche Einordnung.
- Beide Bereiche folgen demselben Pure-Function-zuerst-Muster wie die Lesesitzung:
  Bewertungslogik (`evaluateAnswer.ts`, `evaluateSpellingAnswer.ts`,
  `masteryCalculation.ts`) ist von der DB-Orchestrierung (`comprehensionService.ts`,
  `exerciseService.ts`) getrennt und unit-testbar ohne Datenbank; die Services selbst
  sind ohne Next.js-Request-Kontext direkt integrationstestbar (siehe
  `tests/integration/comprehension.test.ts`, `tests/integration/exercises.test.ts`).

## Gamification (Meilenstein 7)

- Datenmodell (`Reward`, `EarnedReward`) stammt bereits aus dem Meilenstein-1-Schema —
  Meilenstein 7 hat keine Migration benötigt, nur die Orchestrierung
  (`lib/gamification/gamificationService.ts`) und den Content (`src/content/rewards.ts`)
  ergänzt.
- Zwei `RewardType`: `star` (wiederholbar, ein Stern pro abgeschlossener Geschichte bzw.
  Übungsaufgabe) und `xp_badge` (genau einmal pro Kind — `grantIfNotYetEarned()` prüft vor
  dem Anlegen, ob bereits ein `EarnedReward` für diesen Code existiert). `avatar_item` ist
  im Schema vorbereitet, aber im MVP nicht aktiv genutzt (analog zur Rolle `specialist`).
- Belohnungsvergabe hängt sich an genau zwei bestehende Abschluss-Punkte:
  `advanceSectionIfNeeded()` in `readingSessionService.ts` (wenn `sessionComplete` wird)
  und die beiden „final"-Zweige in `exerciseService.ts`
  (`submitSpellingAttempt` bei `!canRetry`, Ende von `markWordReadingComplete`) — beide
  Stellen waren bereits vorher der natürliche Ort für Nebenwirkungen nach Abschluss (siehe
  Illustrationsfreischaltung oben).
- Meilenstein-Abzeichen (`badge_first_story`, `badge_five_stories`,
  `badge_first_exercise`, `badge_ten_exercises`) zählen **lebenslang pro Kind**, nicht pro
  Sitzung — `completedSessionCount`/`completedExerciseCount` werden bei jedem Aufruf frisch
  aus der DB gezählt, nicht zwischengespeichert.
- `badge_regular_practice` (an 3 verschiedenen Kalendertagen geübt) ist das einzige
  zeitbasierte Kriterium — bewusst **nicht** als verlustbehafteter "Streak" umgesetzt
  (kein Reset bei Auslassen eines Tages, kein Drängen/Erinnern), siehe
  docs/EDUCATIONAL_MODEL.md, Abschnitt „Gamification ohne Dark Patterns".
  `lib/gamification/milestones.ts::countDistinctPracticeDays()` ist eine reine Funktion,
  unabhängig testbar von der Datenbank.
- `getRewardsOverview()` aggregiert für die Seite `/belohnungen/[childId]` Sterne-Anzahl,
  Abzeichen-Liste und Gesamt-XP — ausschließlich der eigene Verlauf des Kindes, keine
  Rangliste oder Vergleichsgröße über Kinder hinweg.
- `RewardBadge.tsx` ist eine gemeinsame, rein darstellende Komponente, die sowohl in
  `ReadingView.tsx` (Belohnungen am Ende einer Geschichte) als auch in
  `ExercisePractice.tsx` (Belohnungen nach einer Übungsaufgabe) verwendet wird.
- Der Testmodus-Button „Ergebnis simulieren (ohne Aufnahme)" (Meilenstein 4) macht seit
  Meilenstein 7 einen vollständigen End-to-End-Test einer kompletten Lesesitzung
  inklusive Verständnisfragen und Belohnungsvergabe möglich, ohne echtes Mikrofon
  (`tests/e2e/gamification.spec.ts`) — im Mock-Modus liefert das Szenario „Richtig
  gelesen" alle verbleibenden Wörter eines Abschnitts auf einmal korrekt zurück, sodass
  ein Klick pro Abschnitt für den kompletten Abschluss genügt.

## Eltern-Dashboard (Meilenstein 8)

- Neue Seite `/dashboard/children/[childId]` (unter der bestehenden `(parent)`-Route-Gruppe,
  bereits durch `dashboard/layout.tsx` sitzungsgeschützt) zeigt eine
  Fortschrittsübersicht pro Kind — getrennt von `/dashboard/children/[childId]/edit`
  (Stammdaten/Barrierefreiheit), folgt aber demselben Autorisierungsmuster:
  `requireOwnChildProfile()` + `try/catch` → `notFound()`.
- `lib/progress/parentDashboardService.ts::getChildProgressOverview()` bündelt vier
  parallele Abfragen (`Promise.all`): `SkillProgress` (gruppiert nach `LearningProfile`),
  abgeschlossene `ReadingSession`s (liefert sowohl die Gesamtzahl als auch die letzten 5
  für „Zuletzt gelesen"), finalisierte `SpellingAttempt`s (Übungsanzahl) und
  `ComprehensionAttempt`s (Trefferquote beim ersten Versuch). Übungs- und
  Praxistage-Zählung nutzt bewusst dieselbe „final"-Bedingung
  (`isCorrect || attemptNumber >= MAX_ATTEMPTS`) und dieselbe
  `countDistinctPracticeDays()`-Funktion wie `gamificationService.ts` — konsistente
  Zahlen zwischen Belohnungs- und Fortschrittsansicht, statt zweier leicht
  unterschiedlicher Definitionen von „ein Übungstag".
- Zwei reine, unit-getestete Hilfsfunktionen: `masteryLevelLabel.ts::describeMasteryLevel()`
  übersetzt den rohen `masteryLevel` (0–1) in eine von drei Beschreibungen („Wird
  geübt"/„Wird sicherer"/„Sicher") statt einer Prozentzahl oder Schulnote — die visuelle
  Balkenlänge zeigt den Fortschritt, der Text bewertet ihn nicht.
  `comprehensionSummary.ts::summarizeFirstTryAccuracy()` zählt ausschließlich Versuche mit
  `attemptNumber === 1`, damit ein unterstützter zweiter Versuch die Quote nicht
  beschönigt.
- Die Seite selbst zeigt zusätzlich den festen Hinweistext aus
  docs/EDUCATIONAL_MODEL.md, Abschnitt „Grenzen automatischer Auswertung" — kein
  „Lesealter", kein Vergleich mit anderen Kindern — direkt über den Kennzahlen, nicht nur
  in der Dokumentation.

## Fachkräfte-Zusammenarbeit (Meilenstein 9)

Nutzt die bereits seit Meilenstein 1 im Schema vorbereiteten Modelle
(`SpecialistProfile`, `ChildAccessGrant`, `SpecialistFeedback`, `FeedbackRequest`) —
keine neue Migration nötig, nur Orchestrierung (`lib/specialist/specialistService.ts`)
und UI.

- **Zwei-stufige Vertrauenskette**: (1) Eine Fachkraft registriert sich unter
  `/registrieren-fachkraft` (`role: 'specialist'` + `SpecialistProfile` mit
  `verifiedAt: null`). (2) Eine Admin-Person verifiziert das Profil in der bestehenden
  Admin-Demo (`toggleSpecialistVerifiedAction`, analog zum Story-Veröffentlichen-Muster).
  (3) Erst danach können Eltern dieser Fachkraft per E-Mail-Adresse Zugriff auf ein
  Kinderprofil geben (`grantSpecialistAccess()` prüft `role`, `specialistProfile` und
  `verifiedAt` — alle drei fehlschlagend liefern dieselbe generische Fehlermeldung, um
  keine Rückschlüsse auf existierende Konten zuzulassen).
- **IDOR-Schutz auf beiden Seiten**: `requireOwnActiveGrant()`
  (`lib/server/authz.ts`) verifiziert für Fachkräfte, dass eine `ChildAccessGrant`-ID
  wirklich zum eigenen `SpecialistProfile` gehört, nicht widerrufen und nicht abgelaufen
  ist — analog zu `requireOwnChildProfile()`. Umgekehrt prüft
  `createFeedbackRequest()` serverseitig, dass eine `childAccessGrantId` tatsächlich zum
  angegebenen `childProfileId` gehört, bevor eine Anfrage angelegt wird — ursprünglich
  fehlte dieser Check in der Server Action selbst und wurde bei der
  IDOR-Durchsicht dieses Meilensteins nachgezogen (siehe
  `tests/integration/specialist.test.ts`, Testfall „IDOR").
- **Freigabe ist granular und widerrufbar**: `ChildAccessGrant.scope` (Json, aktuell
  fest `{ view: 'progress_overview' }`) grenzt den Zugriff auf die reine
  Fortschrittsübersicht ein — dieselbe Komponente (`ProgressOverviewSummary.tsx`), die
  auch Eltern sehen, keine separate/größere Datenmenge für Fachkräfte. `revokedAt`
  entfernt eine Freigabe sofort aus allen Abfragen (`listActiveGrantsForChild/-Specialist`
  filtern konsequent danach); wiederholtes Freigeben derselben Fachkraft ist idempotent
  (kein doppelter aktiver Grant).
- **Rückmeldungen sind reine Freitextnotizen** (`SpecialistFeedback.note`), keine
  strukturierte Diagnose- oder Bewertungsskala — bewusste Designentscheidung, siehe
  docs/EDUCATIONAL_MODEL.md. `FeedbackRequest` (Eltern fragen aktiv nach einer
  Rückmeldung) und `SpecialistFeedback` (die Antwort) sind im Schema bewusst nicht
  referenziell verknüpft — eine Fachkraft markiert eine Anfrage manuell als erledigt,
  unabhängig davon, ob/wann sie tatsächlich eine Notiz dazu verfasst.

## Lehrkräfte-Rolle & rollenspezifische Fortschrittsdarstellung

Eigenständige dritte Berufsrolle neben Fachkräften (`role: 'teacher'`), auf ausdrücklichen
Wunsch als **paralleles, nicht wiederverwendetes** Datenmodell umgesetzt
(`TeacherProfile`, `TeacherAccessGrant`, `TeacherFeedback`, `TeacherFeedbackRequest` statt
Erweiterung der bestehenden `Specialist*`-Tabellen um ein Diskriminator-Feld) — bewusste
Entscheidung gegen einen größeren Umbau des bereits getesteten Meilenstein-9-Codes, zulasten
struktureller Duplikation (Registrierung, Zugriffsverwaltung, Admin-Verifizierung existieren
für beide Rollen praktisch identisch, nur mit anderem Modellnamen). Route-Gruppe
`(teacher)/lehrer/*` spiegelt `(specialist)/fachkraft/*` 1:1.

- **Zwei-stufige Vertrauenskette identisch zu Fachkräften**: Registrierung unter
  `/registrieren-lehrer` → Admin-Verifizierung (`toggleTeacherVerifiedAction`) → erst danach
  können Eltern per E-Mail-Adresse Zugriff geben (`grantTeacherAccess()`). IDOR-Schutz
  (`requireOwnActiveTeacherGrant()`) folgt demselben Muster wie
  `requireOwnActiveGrant()`.
- **Gemeinsam genutztes, generisches Assessment-Modul statt getrennter Auswertungslogik**:
  Anders als beim Datenmodell wurde hier bewusst **nicht** dupliziert. Sowohl
  `/fachkraft/[grantId]` als auch `/lehrer/[grantId]` rendern dieselbe
  `<AssessmentSheet>`-Komponente auf Basis von `getChildAssessment()`
  (`src/lib/progress/assessmentService.ts`) — ein aus den vorhandenen Übungsdaten
  abgeleiteter, professionell strukturierter Bogen (Skill-Bereiche nach Übungsbedarf
  sortiert, Fehlerarten auf Wortebene aus `WordEvaluation`, Genauigkeit nach
  Aufgabentyp), ohne Anspruch auf ein konkretes externes Diagnostikverfahren (dazu läge
  keine Fachgrundlage vor). Die reine Aggregationslogik lebt getrennt in
  `assessmentCalculations.ts` (pure Funktionen, direkt unit-testbar).
- **Eltern-Dashboard bekam eine zusätzliche, laienverständliche Ebene**: Die bestehende
  `<ProgressOverviewSummary>` (Balken/Rohwerte) bleibt unverändert bestehen, wurde aber um
  `<ParentFriendlySummaryCard>` ergänzt — eine Kurzeinordnung „Wie hat [Kind] begonnen /
  Wo steht [Kind] jetzt / Worauf achten" aus `buildParentFriendlySummary()`
  (`src/lib/progress/parentSummary.ts`, pure Funktion). „Worauf achten"-Hinweise sind
  heuristisch (niedriger Beherrschungsgrad, lange nicht geübter Bereich, niedrige
  Verständnis-Trefferquote) und ausdrücklich keine Diagnose — dieselbe Einschränkung wie
  beim restlichen Fortschritts-Dashboard.
- **Ein Elternteil kann parallel sowohl Fachkräften als auch Lehrkräften Zugriff geben** —
  zwei unabhängige Abschnitte auf derselben Kind-Bearbeiten-Seite
  (`SpecialistAccessManager` und `TeacherAccessManager`), jeweils mit eigener
  Widerrufs-Liste.

## Sicherheit, Barrierefreiheit & Konto-Selbstverwaltung (Meilenstein 10)

- **Security Headers**: `src/proxy.ts` setzt seit diesem Meilenstein auf praktisch
  jeder Route (Matcher `/((?!_next/static|_next/image|favicon.ico).*)`, nicht mehr nur
  den bisherigen geschützten Prefixes) `Content-Security-Policy`,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` und
  `Permissions-Policy`. Die Auth-Redirect-Logik bleibt unverändert auf
  `PROTECTED_PREFIXES` beschränkt — beide Zuständigkeiten leben bewusst in derselben
  Datei, da beide bei jedem Request laufen müssen und eine zweite Middleware-Datei mit
  Next.js nicht koexistieren kann.
- **Nonce-basierte CSP wurde versucht und mit echten E2E-Tests wieder verworfen** — ein
  Lehrbuchbeispiel dafür, warum "es lädt im Browser" nicht "es ist korrekt" bedeutet:
  Ein manueller Test (curl, einzelner Seitenaufruf) zeigte korrekt gesetzte Nonces auf
  allen Next.js-eigenen Skript-Tags. Erst der volle E2E-Lauf (mehrere Navigationen in
  einer Browser-Session, inkl. Prefetching durch Next.js' Client-Router) deckte echte
  „Refused to execute/load script"-Konsolenfehler auf, weil jeder Proxy-Aufruf einen
  neuen zufälligen Nonce erzeugt, der nicht mehr zum bereits vom Browser durchgesetzten
  CSP-Header der aktuellen Seite passt. Zurückgerollt auf `'unsafe-inline'` für
  `script-src`, siehe docs/SECURITY.md für den dokumentierten Nachbesserungsbedarf.
- **Konto-Selbstverwaltung**: `/dashboard/konto` (Eltern) und `/fachkraft/konto`
  (Fachkräfte) bieten Datenexport (`GET /api/account/export`, ein Route Handler statt
  Server Action, damit der Browser eine echte Datei herunterlädt) und endgültige
  Kontolöschung. `gatherAccountData()`/`deleteOwnAccountAction()`
  (`src/lib/account/accountService.ts`, `src/features/account/actions.ts`) sind
  rollenunabhängig — dieselbe Funktion bedient Eltern-, Fachkräfte- und
  Lehrkräfte-Konten (`accountService.ts` liest zusätzlich `TeacherProfile`, siehe oben).
  Löschung
  nutzt ausschließlich Datenbank-Kaskaden (`onDelete: Cascade` im gesamten
  User-abhängigen Beziehungsgraphen, siehe `prisma/schema.prisma`) statt manueller
  Lösch-Reihenfolge — deutlich weniger Fehleranfällig als Schritt-für-Schritt-Löschen.
  `AuditEvent.actorUserId` bleibt bewusst über `onDelete: SetNull` erhalten.
- **Barrierefreiheit**: `tests/e2e/accessibility.spec.ts` scannt zentrale Seiten mit
  `@axe-core/playwright`. Fand real zwei Probleme, die reines manuelles Durchklicken
  nicht aufgefallen wären: `(auth)/layout.tsx` und `(child)/layout.tsx` nutzten ein
  einfaches `<div>` statt `<main>` als äußeres Element (kein Landmark für
  Screenreader — betraf Login, Registrierung, gesamten Kinderbereich); die
  Aktionsspalten der Admin-Tabellen hatten leere `<th>`-Kopfzellen (jetzt mit
  `sr-only`-Text „Aktionen"). Beide Fixes sind minimal und ändern kein sichtbares
  Layout. `fontScale`/`lineSpacingScale`/`reducedMotion`/`audioHintsEnabled`
  (`ChildProfile`) decken individuelle Anpassungen bereits seit früheren Meilensteinen
  ab (siehe „Illustrationsfreischaltung" oben, `reducedMotion`).

## Authentifizierung & Autorisierung

- **Auth.js (next-auth v5)** mit Credentials-Provider (E-Mail/Passwort) und
  JWT-Session-Strategie (von Auth.js für Credentials vorgeschrieben). Die
  Adapter-Tabellen `Account`/`Session`/`VerificationToken` sind im Schema vorbereitet,
  falls später OAuth-Provider ergänzt werden.
- Passwort-Hashing mit Argon2id (`@node-rs/argon2`), dem von OWASP empfohlenen
  Algorithmus für neue Systeme.
- **Zentrale Autorisierung** (`src/lib/server/authz.ts`): jede Server Action prüft in
  dieser Reihenfolge (1) Authentifizierung (`requireUser()`), (2) Rolle
  (`requireRole()`), (3) Objekt-Eigentümerschaft (`requireOwnChildProfile()` — IDOR-
  Schutz per `parentId`-Filter direkt in der Query), (4) Zod-Validierung der
  Eingaben, (5) `logAuditEvent()`. Für **Seiten** (nicht Actions) gibt es separat
  `requireUserForPage()`, die bei fehlender Session redirected statt zu werfen —
  wichtig, weil Next.js Seiten spekulativ vor-rendern kann (Link-Prefetching), auch
  während ein Logout gerade läuft; ein Wurf dort würde als ungefangener Serverfehler
  im Log landen, obwohl die Antwort am Ende korrekt umleitet.
- `src/proxy.ts` (Next.js 16 hat `middleware.ts` in `proxy.ts` umbenannt) schützt
  `/dashboard/*`, `/admin/*`, `/lesen/*` und `/uebungen/*` zusätzlich auf HTTP-Ebene
  (Redirect zu `/login`, bevor die Seite überhaupt rendert) und läuft seit Next 16 im
  Node.js- statt Edge-Runtime. Bei einem `src/`-Layout muss die Datei unter `src/`
  liegen — am Projekt-Root wird sie sonst kommentarlos ignoriert (siehe SECURITY.md).
- Logout läuft über den `next-auth/react`-Client, nicht als Server Action: Auth.js'
  Server-`signOut()` ruft intern `cookies().set()` auf, was laut Next.js-Dokumentation
  einen sofortigen Re-Render der aktuellen (geschützten) Route auslöst, _bevor_ der
  anschließende `redirect()` greift — auf der bereits abgemeldeten Seite schlägt dieser
  Re-Render dann fehl. Der Client-Aufruf umgeht das über eine normale
  Browser-Navigation nach dem Abmelden.

## Audioverarbeitung

- Aufnahme ausschließlich im Browser (`useAudioRecorder`, MediaRecorder-API), Mikrofon-
  Zustände (`idle`, `requesting_permission`, `recording`, `processing`,
  `permission_denied`, `unsupported`, `error`) sind für die UI klar unterscheidbar.
- **Das aufgenommene Audio verlässt den Browser nie.** Der Mock-Provider verarbeitet
  keine echten Audiodaten; ein echter Provider würde an dieser Stelle Audio kurzzeitig
  hochladen und nach der Verarbeitung sofort löschen (Stub dokumentiert in
  `lib/providers/speech/adapterStub.ts`). Das ist eine stärkere Umsetzung von „Audio nach
  Verarbeitung löschen" als das Lastenheft verlangt: es gibt nichts zu löschen, weil nie
  etwas übertragen wurde.
- Mikrofonzugriff wird aktiv angefragt; Ablehnung und nicht unterstützte Browser zeigen
  eine verständliche Meldung statt eines stillen Fehlers.
- Ein „Entwickler-Testmodus" in der Leseansicht (nur sichtbar, wenn
  `SPEECH_PROVIDER=mock`) erlaubt, jedes der 8 Simulationsszenarien gezielt für den
  nächsten Versuch zu erzwingen — nützlich für Demos und Tests, ohne echte
  unterschiedliche Aufnahmen zu benötigen.

### Echter Provider (SPEECH_PROVIDER=azure)

Seit Kurzem existiert neben dem Mock ein konkreter, echter Provider:
`AzureSpeechRecognitionProvider` (`lib/providers/speech/AzureSpeechRecognitionProvider.ts`)
gegen Azure AI Speech — Pronunciation Assessment. **Nicht standardmäßig aktiv**
(Standard bleibt `SPEECH_PROVIDER=mock`); Aktivierung setzt `AZURE_SPEECH_KEY`
und `AZURE_SPEECH_REGION` voraus (siehe `.env.example`) und erfordert vorher
einen abgeschlossenen Datenschutz-Review (siehe unten und docs/SECURITY.md).

- **Audio-Erfassung nur bei echtem Provider**: `useAudioRecorder` sammelt
  Audio-Chunks nur, wenn `captureAudio: true` übergeben wird
  (`ReadingView.tsx`: `captureAudio: !isMockProvider`) — im Mock-Modus ändert
  sich das bisherige Verhalten nicht, es wird weiterhin nichts gesammelt oder
  übertragen.
- **Client-seitige Vorverarbeitung** (`lib/providers/speech/audioPreprocessing.ts`):
  dekodiert den `MediaRecorder`-Output (i. d. R. `audio/webm`) über die Web
  Audio API und kodiert ihn als WAV/PCM, da Azures Kurz-Audio-REST-API dieses
  Format erwartet. Optional wird davor eine leichte, resample-basierte
  Tonhöhen-/Tempo-Verschiebung angewendet (`SPEECH_PRIVACY_PITCH_SHIFT_RATE`)
  — **als zusätzliche Defense-in-Depth-Maßnahme, nicht als verlässliche
  Anonymisierung der Stimme als biometrisches Merkmal** (Begründung im
  Quellcode-Kommentar der Datei). Das fertige WAV wird als `audio`-Feld der
  Server Action `submitReadingAttemptAction` übergeben (Next.js Server
  Actions unterstützen `Blob`/`File`-Argumente nativ).
- **Bewertungslogik geteilt, nicht dupliziert**: `evaluateReadingAttempt`
  und `detectPossibleSelfCorrection` sind als provider-unabhängige, pure
  Funktionen nach `lib/reading/defaultProviderHelpers.ts` ausgelagert und
  werden von `MockSpeechRecognitionProvider` und
  `AzureSpeechRecognitionProvider` gleichermaßen genutzt — verhindert, dass
  die konservativen Bewertungsschwellen (siehe EDUCATIONAL_MODEL.md) zwischen
  Implementierungen auseinanderlaufen. `alignToTargetText`
  (`positionTracker.ts`) bleibt ebenfalls provider-unabhängig und wird von
  beiden identisch aufgerufen.
- **Server-Action-Body-Limit angehoben**: `next.config.ts` setzt
  `experimental.serverActions.bodySizeLimit` auf `4mb` (Standard 1 MB reicht
  für Audio-Uploads nicht aus). Im Mock-Modus ungenutzt.
- **Wichtige Konsequenz für das Kernprinzip "Rohaudio verlässt nie den
  Browser"**: Dieses Prinzip gilt weiterhin uneingeschränkt für den
  Standard-Modus (`SPEECH_PROVIDER=mock`). Bei aktivem `SPEECH_PROVIDER=azure`
  gilt es **nicht mehr** — echtes Kinderaudio wird an Azure übertragen. Siehe
  docs/SECURITY.md, Abschnitt „Sensible Daten", für die aktualisierte
  Einordnung, und den `speech-provider`-Agenten für die Aktivierungs-
  Voraussetzungen.

## Textpositions-Erkennung

`lib/reading/positionTracker.ts` (`alignToTargetText`) verarbeitet eine Folge erkannter
Wörter sequentiell gegen ein kleines Suchfenster (6 Wörter) im Zieltext. Ein "Cursor"
rückt nur bei einem klaren Treffer vor:

- passt ein Wort zum direkt erwarteten Wort → ein Wort vor;
- passt es zum übernächsten erwarteten Wort → ein Wort ausgelassen (toleriert), zwei vor;
- passt es zu einem bereits bestätigten Wort → Wiederholung, Cursor bleibt stehen (kein
  Rücksprung);
- zwei aufeinanderfolgende erkannte Wörter zielen auf dieselbe Position, wobei nur das
  zweite passt → Selbstkorrektur;
- passt es zu nichts in der Nähe → wird ignoriert (Rauschen/zusätzliches Wort), markiert
  aber ggf. `possibleMisreadWord`, wenn die Erkennungs-Konfidenz dafür hoch genug war.

Das Suchfenster **wandert mit dem Cursor mit** (nicht an der Anfangsposition fixiert) —
das ermöglicht, einen ganzen (aber kurzen) Textabschnitt in einem Aufruf zu verarbeiten,
ohne die Lookahead-Begrenzung („kein Volltext-Rematch") pro Einzelschritt aufzugeben.
Diese Fixierung war ein realer Bug, der erst durch den Integrationstest
(`tests/integration/reading-session.test.ts`) auffiel, da die dortigen Zieltexte länger
als ein Fenster sind — die isolierten Unit-Tests mit kürzeren Testtexten hatten ihn
nicht aufgedeckt. Liefert immer einen Konfidenzwert; unterhalb eines Schwellwerts wird
die Position nicht bewegt. 14 Unit-Tests in `tests/unit/position-tracker.test.ts` decken
alle Kernfälle ab.

`lib/reading/sessionStateMachine.ts` (`computeSessionStep`) entscheidet auf Basis des
Bewertungszustands, ob vorgerückt, wiederholt oder (nach max. 2 Wiederholungen) Hilfe
angeboten wird — rein, ohne Seiteneffekte, 9 Unit-Tests.

**Geplant, noch nicht implementiert** (siehe docs/EDUCATIONAL_MODEL.md, „Passive
Sprachvorbild-Elemente"): Textabschnitte sollen künftig aktiv zu lesende und passiv
vorgelesene Zeilen mischen. `deriveExpectedWords` und `alignToTargetText` müssten dafür
zwischen beiden Zeilenrollen unterscheiden — passive Zeilen dürfen nicht in die
„expected words"-Zählung eingehen, sonst würde das System auf nie gesprochene Wörter
warten. Bei Umsetzung: diesen Abschnitt durch die konkrete technische Beschreibung
ersetzen.

## Provider-Abstraktion

`SpeechRecognitionProvider`-Interface (`transcribeAudio`, `alignToTargetText`,
`evaluateReadingAttempt`, `returnWordConfidence`, `detectPossibleSelfCorrection`) in
`lib/providers/speech/types.ts`. `MockSpeechRecognitionProvider` simuliert alle 8
geforderten Szenarien (`correct`, `likely_correct`, `possible_error`, `unclear_audio`,
`unavailable`, `self_corrected`, `skipped_word`, `extra_word`) — ohne erzwungenes
Szenario gewichtet zufällig, überwiegend positiv (wie bei einem echten Kind). Ein
Adapter-Stub (`adapterStub.ts`) dokumentiert die Anbindung eines echten Anbieters. Die
Factory `lib/providers/speech/index.ts` liest `SPEECH_PROVIDER` aus der Umgebung; jeder
andere Wert als `mock` wirft aktuell einen klaren Fehler.

## Content-Struktur (Meilenstein 3)

Kuratierte Inhalte sind typisierte TS-Daten unter `src/content/` (`stories.ts`,
`exercises.ts`, `literacySkills.ts`, gemeinsame Typen in `types.ts`), getrennt von der
Seed-Logik (`prisma/seed.ts`), die sie per `upsert` in die Datenbank spielt. Die
Wortliste pro Textabschnitt (`StorySection.expectedWords`, Basis für die
Textpositions-Erkennung in Meilenstein 4) wird nicht manuell gepflegt, sondern aus dem
Fließtext abgeleitet (`lib/content/deriveExpectedWords.ts`). Illustrations-Assets liegen
als einfache, selbst erstellte SVGs unter `public/illustrations/<story-slug>/<ebene>.svg`.
Unit-Tests gegen die Content-Module (nicht gegen die Datenbank) stellen sicher, dass neue
Inhalte die strukturellen Mindestanforderungen erfüllen, bevor sie geseedet werden.

Seit Meilenstein 11 kommt zusätzlich ein **Autoren-Workspace** hinzu, der Content-Erstellung
ohne TypeScript-Kenntnisse erlaubt: Rohdaten liegen als Dateien unter
`content-drafts/<slug>/` (JSON-Metadaten, Markdown-Abschnitte, SVG-Illustrationen) und werden
per `npm run content:import` (`scripts/import-content-drafts.ts`) in generierten TS-Code unter
`src/content/generated/<slug>.ts` übersetzt. `src/content/stories.ts` exportiert
`stories = [...handAuthoredStories, ...generatedStories]` — von Hand gepflegte und generierte
Geschichten stehen gleichberechtigt nebeneinander, ohne dass der Import bestehenden,
handgeschriebenen Content überschreibt. Volles Format und die Marker-Syntax für
wortpositions-basierte Illustrationsfreischaltung: siehe docs/CONTENT_AUTHORING.md.

## Bezahlsystem (Stripe)

Seit 2026-07-28 (Produktentscheidung "Jetzt Zahlungsmodell"). Vollständige Details,
inkl. rechtlichem Rahmen und offener Punkte, siehe docs/SECURITY.md, Abschnitt
„Bezahlsystem (Stripe)". Kurzüberblick des Datenflusses:

1. `/preise` zeigt den Tarif-Katalog (`src/lib/billing/plans.ts`, drei feste Tarife,
   kein dynamisches Pricing).
2. `createCheckoutSessionAction()` (`src/features/billing/actions.ts`) legt bei
   Bedarf einen Stripe-Kunden an (`getOrCreateStripeCustomerId()`, ID wird auf
   `User.stripeCustomerId` gecacht, um bei abgebrochenen Checkouts keine
   Kunden-Dubletten in Stripe anzulegen) und leitet zur von Stripe gehosteten
   Checkout-Seite weiter.
3. Stripe stellt nach erfolgreichem Checkout bzw. jeder späteren Statusänderung
   (Verlängerung, Kündigung, fehlgeschlagene Zahlung) ein signiertes Webhook-Event an
   `/api/webhooks/stripe` zu. Der Handler verifiziert die Signatur und ruft
   `syncSubscriptionFromStripe()` auf — das ist die EINZIGE Stelle, die die lokale
   `Subscription`-Tabelle schreibt (siehe Begründung im Code-Kommentar dort).
4. `/dashboard/abo` liest den lokalen `Subscription`-Datensatz rein lesend und bietet
   den Kündigungsbutton (`createBillingPortalSessionAction()` → Stripe-Kundenportal,
   erfüllt § 312k BGB).

`requireActiveSubscription()` (`src/lib/server/authz.ts`) ist als Feature-Gating-
Baustein vorbereitet, aber bewusst an keiner bestehenden Server Action angebunden —
welche Funktionen tatsächlich ein Abo voraussetzen, ist eine noch offene
Produktentscheidung. Ebenso ist der `maxChildProfiles`-Wert pro Tarif aktuell nur im
Katalog dokumentiert, nicht in `createChildProfileAction()` durchgesetzt.

## Speicherstrategie

- PostgreSQL via Prisma (Driver-Adapter `@prisma/adapter-pg`, seit Prisma 7
  erforderlich statt der impliziten Query-Engine-Bindung).
- Kein Rohaudio-Storage. Illustrations-Assets liegen als statische SVG/PNG-Dateien im
  Repository (`public/`), keine Laufzeit-Bildgenerierung.

## Skalierungsüberlegungen (nicht MVP-kritisch)

Für den MVP genügt eine einzelne Node-Instanz + eine PostgreSQL-Instanz. Vor einem
echten Produktionseinsatz wären zu klären: Connection-Pooling (z.B. PgBouncer) bei
mehreren Serverless-Instanzen, ein Object-Storage für künftige Audio-Kurzzeitpuffer
statt lokalem Dateisystem, und horizontale Skalierung der Node-Prozesse hinter einem
Load Balancer. Siehe auch SECURITY.md, Abschnitt „Produktionsanforderungen".

Für das PostgreSQL-Hosting selbst steht optional Supabase als gehosteter, EU-Region-
fähiger Provider zur Verfügung (siehe README.md, Abschnitt „Supabase (gehostetes
PostgreSQL)") — genutzt ausschließlich als reine Postgres-Instanz, nicht als Auth-/
RLS-/Client-SDK-Ersatz für die bestehende Auth.js-Schicht. Das Connection-Pooling-
Problem bei mehreren Serverless-Instanzen ist dadurch weitgehend abgedeckt: Supabases
eingebauter PgBouncer/Supavisor-Pooler (Transaction-Modus, Port 6543) dient als
`DATABASE_URL` für Laufzeit-Queries, während Schema-Migrationen weiterhin die direkte
Verbindung (`DIRECT_URL`, Port 5432) benötigen, da PgBouncer im Transaction-Modus kein
DDL/keine Prepared Statements zuverlässig unterstützt (siehe `prisma.config.ts`).
