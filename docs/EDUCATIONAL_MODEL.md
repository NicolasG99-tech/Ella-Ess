# Pädagogisches Modell

Dieses Dokument wird mit jedem Meilenstein erweitert. Stand: Meilenstein 10.

## Abgrenzung zur Diagnostik

Diese App ist ein **Bildungsprodukt**, kein diagnostisches oder medizinisches
Instrument. Sie:

- unterstützt beim Lesen, passt Übungen an, zeigt Lernfortschritte, erkennt
  _wahrscheinliche_ Lesefehler und bietet Wiederholungen/Hilfen an;
- diagnostiziert **nicht** LRS oder Legasthenie, trifft **keine** medizinischen
  Aussagen, ersetzt **keine** Logopädie oder Lerntherapie, leitet **keine** sicheren
  Fehler aus unsicheren Audiodaten ab, und bewertet ein Kind **nie** negativ oder
  beschämend.

Jede Stelle im Produkt, die Fortschritt oder Unsicherheit darstellt (Eltern-Dashboard,
Feedback während des Lesens), muss diese Grenze einhalten. Formulierungen wie „falsch",
„schlecht gelesen", „zu langsam", „versagt", „unterdurchschnittlich" oder
„enttäuschend" sind im gesamten Produkt untersagt.

## Lernprofile

| Profil                                               | Schwerpunkte                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Lesegrundlagen** (`reading_basics`)                | Buchstaben-Laut-Beziehungen, kurze Wörter, Silben, einfache Sätze, Lesegenauigkeit       |
| **Leseflüssigkeit** (`fluency`)                      | kurze Texte, genaues Lesen, flüssigeres Lesen, Satzgrenzen, Selbstkorrekturen            |
| **Grundlegende Rechtschreibung** (`spelling_basics`) | Laut-Buchstaben-Zuordnung, häufige Wortmuster, kurze Diktate, Lückentexte, Wortbausteine |

Eine nicht-diagnostische Einstufung _empfiehlt_ ein Startprofil; die App erklärt dabei
deutlich sichtbar, dass dies **keine medizinische oder pädagogische Diagnose** ist,
sondern lediglich ein Vorschlag, den Eltern jederzeit ändern können. Details zur
Einstufungslogik folgen mit Meilenstein 2/3.

## Feedbackregeln (Bewertungslogik)

Die Bewertungslogik ist konservativ. Zustände: `correct`, `likely_correct`,
`possible_error`, `unclear_audio`, `self_corrected`, `skipped`, `unavailable`.

- Nur bei hoher Konfidenz wird ein möglicher Fehler als Korrekturhinweis angezeigt.
- Bei niedriger Konfidenz bittet das System neutral um Wiederholung
  („Ich konnte dich nicht deutlich genug hören. Versuchen wir es noch einmal.").
- Ein möglicher Fehler wird motivierend formuliert
  („Fast geschafft. Schau dir dieses Wort noch einmal an.").
- Ein zweiter erfolgreicher Versuch wird positiv bewertet; Selbstkorrekturen gelten als
  positives Lernverhalten.
- Nach maximal zwei Wiederholungen wird eine Hilfestellung angeboten — das Kind bleibt
  nie in einer Endlosschleife hängen.
- Ein technischer Fehler (`unavailable`) erscheint niemals als Lesefehler.

Seit Meilenstein 4 implementiert in `lib/reading/sessionStateMachine.ts`
(`computeSessionStep`) — siehe [ARCHITECTURE.md](ARCHITECTURE.md) für die technische
Beschreibung. Ein Unit-Test (`tests/unit/session-state-machine.test.ts`) prüft explizit,
dass keine der in Abschnitt „Abgrenzung zur Diagnostik" untersagten Formulierungen in
den Rückmeldetexten vorkommt.

Dieselben Grundsätze gelten seit Meilenstein 6 für Verständnisfragen
(`lib/comprehension/comprehensionService.ts`) und Rechtschreibübungen
(`lib/exercises/exerciseService.ts`):

- Maximal zwei Versuche, bevor die richtige Antwort/Lösung aufgedeckt wird — nie mehr
  Wiederholungsdruck als beim Vorlesen selbst.
- Beim ersten Fehlversuch bei Verständnisfragen gibt es nur einen Hinweistext
  (`hintText`, z.B. ein Verweis auf die relevante Textstelle), keine Auflösung — Auflösung
  ausschließlich beim endgültigen, nicht mehr wiederholbaren Versuch.
- Rückmeldetexte sind durchgehend neutral-ermutigend formuliert
  („Kein Problem — beim nächsten Mal klappt es bestimmt.“), nie wertend oder
  beschämend, unabhängig davon, wie oft ein Kind einen Fehlversuch hatte.
- Rechtschreibübungen verlangen bewusst exakte Übereinstimmung (kein
  Fuzzy-Toleranzbereich wie bei der Leseerkennung) — die Übung soll gezielt die korrekte
  Schreibweise einüben, nicht grob „ähnlich genug“ durchwinken.

## Gamification ohne Dark Patterns (Meilenstein 7)

Der ursprüngliche Produktauftrag schließt manipulative Spielmechaniken explizit aus.
Belohnungen (`lib/gamification/gamificationService.ts`, Katalog in
`src/content/rewards.ts`) folgen deshalb festen Leitplanken:

- **Kein Vergleich zwischen Kindern**: keine Bestenliste, kein „Platz X von Y", keine
  sichtbare Fortschrittsangabe eines anderen Kindes. `getRewardsOverview()` liefert
  ausschließlich den eigenen Verlauf.
- **Kein Verfall**: einmal verdiente Sterne und Abzeichen gehen nie wieder verloren — es
  gibt keinen „Streak", der bei Auslassen eines Tages zurückgesetzt wird, und keine
  zeitlich befristeten Belohnungen.
- **Keine künstliche Dringlichkeit**: keine Countdown-Timer, keine „nur noch heute"-Hinweise,
  keine Erinnerungs-Benachrichtigungen, die zum Weiterspielen drängen.
- **Keine Zufallsmechanik**: jede Belohnung ist deterministisch an ein konkretes,
  nachvollziehbares Kriterium gekoppelt (z.B. „5. abgeschlossene Geschichte") — kein
  Lootbox-artiges Zufallselement.
- **Keine Bezahlschranken**: keine Werbung, keine In-App-Käufe, kein „Belohnung schneller
  freischalten gegen Bezahlung".
- Belohnungen sind ausschließlich an echten Lernfortschritt gekoppelt (abgeschlossene
  Geschichte, abgeschlossene Übung, Übungsregelmäßigkeit über mehrere Tage) — nie an
  Lesegeschwindigkeit, Fehlerfreiheit oder Zeitdruck, konsistent mit den Feedbackregeln
  oben.

## Grenzen automatischer Auswertung

Die automatische Spracherkennung und Positionsbestimmung ist eine Annäherung, keine
exakte Messung — besonders bei Hintergrundgeräuschen, undeutlicher Aussprache oder
technischen Einschränkungen des Mikrofons. Das Eltern-Dashboard weist deshalb explizit
darauf hin, dass automatische Auswertungen ungenau sein können, vergibt keinen
pauschalen „Lesealter"-Wert und vergleicht nicht mit anderen Kindern.

Seit Meilenstein 8 implementiert in `/dashboard/children/[childId]`
(`lib/progress/parentDashboardService.ts`):

- Der oben beschriebene Hinweistext steht direkt auf der Seite, sichtbar über den
  Kennzahlen, nicht nur in dieser Dokumentation.
- Fähigkeiten werden als beschreibendes Label (Wird geübt / Wird sicherer / Sicher,
  siehe `masteryLevelLabel.ts`) plus Balkenlänge dargestellt — bewusst keine Prozentzahl
  oder Schulnote, die wie eine exakte Messung wirken könnte.
- Es gibt keine Rangliste, keinen Klassen-/Geschwisterkinder-Vergleich und keine
  aggregierte Gesamtnote über alle Fähigkeiten hinweg — jede Fähigkeit steht für sich.

## Fachkräfte-Zusammenarbeit (Meilenstein 9)

Logopäd:innen, Ergotherapeut:innen und ähnliche Fachpersonen können mit expliziter
Einwilligung der Eltern Einblick in die Fortschrittsübersicht eines Kindes erhalten
(`/registrieren-fachkraft`, `/fachkraft`, siehe ARCHITECTURE.md). Dieser Bereich ist
bewusst eng geschnitten:

- **Kein Diagnose-Feature.** Fachkräfte sehen exakt dieselbe, nicht-diagnostische
  Fortschrittsübersicht wie Eltern (`ProgressOverviewSummary.tsx`) — keine
  zusätzlichen, „klinischeren" Kennzahlen, keine Skalen, keine Schweregrad-Einstufung.
- **Kein Ersatz für eine reguläre Untersuchung.** Rückmeldungen
  (`SpecialistFeedback.note`) sind freie Textnotizen, keine strukturierte
  Diagnose oder Therapieempfehlung — an jeder Eingabe- und Anzeigestelle steht dieser
  Hinweis explizit im UI-Text, nicht nur hier in der Dokumentation.
- **Kein Fernbehandlungs-Kanal.** Ausschließlich asynchroner Textaustausch — keine
  Video-/Audiokommunikation, keine Terminvereinbarung, keine Abrechnungsfunktion.
- **Einwilligung ist granular, sichtbar und jederzeit widerrufbar.** Eltern sehen, wem
  sie wann Zugriff auf welches Kind gegeben haben, und können jede Freigabe mit einem
  Klick beenden — Zugriff endet sofort, nicht erst nach Ablauf einer Frist.
- **Zwei-Faktor-Vertrauen statt Selbstauskunft.** Eine Fachkraft kann ihre eigene
  Qualifikation nicht selbst „freischalten" — erst eine Admin-Verifizierung UND eine
  elterliche Freigabe zusammen ermöglichen Zugriff. Die aktuelle Admin-Verifizierung ist
  jedoch nur eine lokale Demo (ein Klick, keine echte Nachweisprüfung) — siehe „Später
  von Fachpersonal zu prüfen" unten und docs/SECURITY.md.

## Lehrkräfte-Rolle und rollenspezifische Darstellung

Auf ausdrücklichen Wunsch ergänzt: eine eigenständige Lehrkräfte-Rolle neben Fachkräften
(`/registrieren-lehrer`, `/lehrer`), mit denselben Zustimmungs- und Widerrufsregeln wie bei
Fachkräften (siehe oben — gilt unverändert für Lehrkräfte). Zwei Ergänzungen betreffen beide
Berufsrollen sowie das Eltern-Dashboard:

- **Assessment-Bogen statt einfacher Fortschrittsbalken.** Fachkräfte und Lehrkräfte sehen
  jetzt einen strukturierteren, aus den vorhandenen Übungsdaten abgeleiteten Bogen
  (Skill-Bereiche nach Übungsbedarf sortiert, Fehlerarten auf Wortebene, Genauigkeit nach
  Aufgabentyp) statt der reinen Elternansicht. **Wichtig:** Dieser Bogen orientiert sich an
  keinem konkreten externen Diagnostik- oder Assessment-Verfahren aus der schulischen oder
  therapeutischen Praxis — dafür fehlt fachliche Grundlage in diesem Projekt. Er ist eine
  generische, professionell wirkende Strukturierung vorhandener Zahlen, keine Umsetzung
  eines anerkannten Instruments. Vor echtem Einsatz sollte geprüft werden, ob und wie er an
  ein in der jeweiligen Praxis tatsächlich genutztes Verfahren anschließt (siehe „Später
  von Fachpersonal zu prüfen" unten).
- **Laienverständliche Kurzeinordnung im Eltern-Dashboard.** Ergänzend zu den bestehenden
  Balken fasst eine neue Kachel „Wie hat [Kind] begonnen / Wo steht [Kind] jetzt / Worauf
  achten" den Fortschritt in Alltagssprache zusammen. Die „Worauf achten"-Hinweise sind
  **heuristisch** (niedriger Beherrschungsgrad, ein Bereich lange nicht geübt, niedrige
  Verständnis-Trefferquote) — feste, im Code sichtbare Schwellenwerte, keine fachlich
  hergeleitete Einschätzung. Es gilt dieselbe Grenze wie im gesamten Dashboard: keine
  Diagnose, kein „Lesealter", kein Kinder-Vergleich.

## Content-Freigabeprozess

Alle Texte, Aufgaben, Wörter, Fragen und Hilfestellungen stammen aus einer kontrollierten
Datenbank — es werden **keine** Lerntexte während einer Kindersitzung durch ein
Sprachmodell generiert. Konkret (Stand Meilenstein 3):

- Geschichten, Übungen und Literacy-Skills sind als typisierte TS-Daten in `src/content/`
  gepflegt (`stories.ts`, `exercises.ts`, `literacySkills.ts`), nicht als Freitext in der
  Datenbank editierbar.
- `prisma/seed.ts` spielt diese Inhalte in die Datenbank ein (idempotent, per `upsert`).
- Unit-Tests (`tests/unit/content-stories.test.ts`, `tests/unit/content-exercises.test.ts`)
  prüfen strukturelle Mindestanforderungen automatisch (z.B. alle 5 Illustrationsebenen
  vorhanden, 2–4 Verständnisfragen pro Geschichte, Mindestanzahl an Übungen).
- Die lokale Admin-Demo (`/admin`, nur Rolle `admin`) erlaubt ausschließlich das
  Veröffentlichen/Verbergen einer Geschichte — keine Texterstellung über die UI. Das hält
  die Eingabefläche für Kindertext-Inhalte bewusst klein.
- Ein redaktionelles Vier-Augen-Prinzip für neue Inhalte (z.B. Pull-Request-Review von
  `src/content/`) ist im MVP organisatorisch, nicht technisch erzwungen — vor einem
  Produktivbetrieb mit externen Autor:innen sollte das förmlicher werden (z.B. ein
  Freigabe-Status-Feld statt `isPublished` als einfachem Boolean).

## Adaptive individuelle Wortwiederholung (Konzept, in Planung)

Auf ausdrücklichen Produktwunsch skizziert (Stand: Planung vor Meilenstein 11,
Aussprachekorrektur mit Azure AI Speech). **Noch nicht implementiert** — dieser
Abschnitt hält die Idee und ihre Leitplanken fest, bevor Code entsteht, und wird bei
Umsetzung durch ein konkretes technisches Kapitel in docs/ARCHITECTURE.md ersetzt/ergänzt.

**Grundidee:** Wird beim Vorlesen ein Wort mit ausreichender Konfidenz als
`possible_error` erkannt (bestehende Zustände, siehe „Feedbackregeln" oben — keine neue,
laxere Schwelle), passiert zweierlei:

1. **Sofort-Feedback bleibt wie bisher**: ermutigend, ggf. mit einer sanften Korrektur
   (richtige Aussprache vorbildhaft anbieten, nicht die falsche wiederholen oder
   benennen) — folgt denselben Formulierungsregeln wie oben, keine neuen Ausnahmen.
2. **Langfristig**: das Wort (bzw. das zugrunde liegende Muster, siehe offene Fragen
   unten) wird in einem individuellen, dem Kind zugeordneten Übungswortschatz vermerkt.
   Zukünftige Textauswahl bevorzugt Inhalte, die dieses Wort enthalten — auch in
   **passiv vorgelesenen** Abschnitten (siehe nächster Abschnitt), um wiederholte,
   beiläufige Exposition ohne Testcharakter zu ermöglichen.

**Zentrale Leitplanke — Vereinbarkeit mit „Content-Freigabeprozess" (oben):** Die
Textauswahl darf **keine** Laufzeit-Texterzeugung durch ein Sprachmodell werden — das
bleibt ausgeschlossen. Die Umsetzung muss deshalb eine **Auswahl/Filterung aus
kuratiertem, vorab freigegebenem Content** sein (z. B. Geschichten/Übungssätze, die ein
bestimmtes Wort ohnehin enthalten, werden bei der Auswahl priorisiert), nicht eine
Generierung neuer Sätze um ein Zielwort herum. Das kann bedeuten, dass die Content-Bank
(`content-drafts/`) künftig gezielt mit häufigen Übungswörtern durchsetzte Texte braucht
— ein Autoren-/Redaktionsthema, kein Laufzeit-Feature.

**Abgrenzung zur Diagnostik gilt unverändert:** Der individuelle Übungswortschatz ist
**kein** Fehlerprofil, das dem Kind oder Eltern als Defizitliste gezeigt wird — er ist
intern für die Content-Auswahl. Falls er später sichtbar gemacht wird (z. B. im
Eltern-Dashboard), gelten dieselben Regeln wie bei allen Fortschrittsanzeigen: keine
Prozentzahlen, keine Fehlerzähler, beschreibende statt wertende Formulierung.

**Offene Fragen, vor Implementierung zu klären** (nicht vollständig, Ausgangspunkt für
Diskussion mit `content-pedagogy`- und `privacy-security`-Agent):

- Granularität: einzelne Wörter oder zugrunde liegende Muster (Laut-Buchstaben-Beziehung,
  Wortbaustein)? Wortebene ist einfacher umzusetzen, Musterebene generalisiert besser und
  entspricht eher etablierter Leseförderung — fachliche Prüfung nötig
  („Später von Fachpersonal zu prüfen" unten).
- Wie lange bleibt ein Wort im Übungswortschatz, und wann gilt es als „gefestigt" und
  wird entfernt? Ohne Ausschlusskriterium droht eine dauerhaft wachsende, nie
  abschließende Liste.
- Aufbewahrung/Löschung: unterliegt denselben DSGVO-Grundsätzen wie andere
  Kind-Daten (siehe docs/SECURITY.md) — Datenminimierung, klare Löschfrist, Löschung bei
  Kontolöschung über bestehende Kaskaden.
- Wie stark darf Content-Auswahl auf Übungswörter optimieren, ohne dass Geschichten sich
  repetitiv/erzwungen anfühlen oder das Kind indirekt spürt, „getestet" zu werden?

## Passive Sprachvorbild-Elemente (Konzept, in Planung)

Ebenfalls Stand: Planung, **nicht implementiert**. Ergänzt die adaptive
Wortwiederholung oben um eine zweite Komponente: Textabschnitte sollen künftig aus einer
Mischung aus **aktiv vom Kind gelesenen** und **passiv vorgelesenen** (Sprachvorbild-)
Zeilen bestehen. Erster Vorschlag zur Orientierung: von 6 Zeilen liest das Kind 2 aktiv,
4 werden als korrektes Sprachvorbild vorgelesen — das genaue Verhältnis ist **bewusst
noch offen** und braucht vor Festlegung eine fachliche Einschätzung (siehe unten) sowie
Erprobung, nicht nur eine technische Entscheidung.

**Zweck:** Wiederholte, beiläufige Exposition gegenüber korrekt ausgesprochenen
Zielwörtern (aus dem individuellen Übungswortschatz, siehe oben), ohne zusätzlichen
Leseaufwand oder Testdruck — Vorbild statt Prüfung.

**Technische Anknüpfungspunkte (bei Umsetzung zu klären, hier nur benannt):**

- Passive Zeilen brauchen eine Audioquelle mit korrekter Aussprache — entweder
  aufgezeichnete, kuratierte Sprachaufnahmen (konsistent mit dem Grundsatz „keine
  Laufzeit-Erzeugung") oder eine Text-to-Speech-Stimme; falls TTS, wäre das ein neuer,
  von der Spracherkennung getrennter Provider-Typ und bräuchte eine eigene
  Datenschutz-/Anbieter-Prüfung (`speech-provider`-Agent), auch wenn hier keine
  Kinderaudiodaten übertragen werden (nur Text → Sprache, keine biometrische
  Verarbeitung von Kindstimmen).
- Die aktiv/passiv-Aufteilung müsste im Content-Format markiert werden — voraussichtlich
  eine Erweiterung der bestehenden Inline-Marker-Syntax (`[[unlock:...]]`, siehe
  docs/CONTENT_AUTHORING.md) um einen analogen Marker für Zeilenrollen, statt eines
  neuen, separaten Formats.
- Wirkung auf die bestehende Wortpositions-Logik (`deriveExpectedWords`,
  `positionTracker.ts`): passive Zeilen dürfen nicht als vom Kind zu lesende
  „expected words" gezählt werden — braucht eine bewusste Erweiterung dieser Funktionen,
  keine Nebenwirkung.

**Fachliche Prüfung nötig** (siehe „Später von Fachpersonal zu prüfen" unten): Verhältnis
aktiv/passiv, ob Sprachvorbild-Wiederholung in dieser Form tatsächlich zu den
gewünschten Effekten führt (Leseforschung/Grundschulpädagogik), und ob TTS oder
menschliche Aufnahmen für ein Sprachvorbild bei Kindern dieser Altersgruppe geeigneter
sind.

## E-Book-Bibliothek (Konzept, für spätere Entwicklungsschritte notiert)

Von Nicolas skizzierte Ausbau-Idee (Stand 2026-07-28), **nicht implementiert** — dieser
Abschnitt hält nur die Idee und ihre Leitplanken fest, damit sie bei Bedarf ohne
Nachfragen aufgegriffen werden kann.

**Grundidee:** Zusätzlich zum bestehenden Angebot (begleitete Lesesitzungen mit
Spracherkennungs-Feedback und Illustrationsfreischaltung) eine E-Book-Bibliothek, die
ein Kind ergänzend nutzen kann — an das Kind und seine Interessen kuratierte
Geschichten (z. B. Themenbereiche wie Tiere, Abenteuer, Fantasie, Sport), nicht nur
der aktuell kleine, feste Story-Katalog.

**Vereinbarkeit mit „Content-Freigabeprozess" (oben) — gilt unverändert:** „Kuratiert"
heißt Auswahl/Filterung aus einem vorab redaktionell freigegebenen Bestand (analog zum
bestehenden `content-drafts/`-Workspace, siehe docs/CONTENT_AUTHORING.md), keine
Laufzeit-Texterzeugung durch ein Sprachmodell. Eine größere Content-Bank mit
Themen-/Interessens-Tags wäre die technische Voraussetzung, kein KI-Textgenerator.

**Offene Fragen, vor Implementierung zu klären:**

- Wie werden „Interessen" erfasst — explizite Auswahl durch Eltern/Kind im
  Kinderprofil (z. B. Themen-Tags) oder implizit aus bisherigem Leseverhalten
  abgeleitet? Ein Interessen-Feld am `ChildProfile` unterläge denselben
  DSGVO-Minimierungsgrundsätzen wie der individuelle Übungswortschatz (siehe
  „Adaptive individuelle Wortwiederholung" oben).
- Verhältnis zum bestehenden begleiteten Lese-Flow: freier, unbegleiteter Lesemodus
  (ohne Spracherkennung/Feedback) oder nutzt jedes Bibliotheks-Buch weiterhin dieselbe
  Vorlese-Auswertung wie die aktuellen Geschichten? Ein freier Modus skaliert
  content-seitig einfacher (keine pro-Buch-Illustrations-/Checkpoint-Autorenarbeit
  nötig), verzichtet dafür auf das bestehende Kernfeature dieses Produkts.
- Content-Beschaffung: eigene Autor:innen vs. lizenzierte/gemeinfreie
  Kinderbuch-Texte — bei lizenzierten Werken zusätzliche urheberrechtliche Prüfung für
  eine kommerzielle, kostenpflichtige App (siehe docs/SECURITY.md, „Bezahlsystem
  (Stripe)").
- Einordnung ins Preismodell: eigener Tarif-Baustein/Zusatzoption oder Teil der
  bestehenden Tarife?
- Dieselben pädagogischen Leitplanken wie im gesamten Produkt (keine Diagnostik, keine
  Dark-Pattern-Gamification, altersgerechte Inhalte) müssten für jeden neuen Titel
  gelten, nicht nur für die aktuell eng kuratierte Story-Auswahl — bei deutlich größerem
  Content-Umfang wird das redaktionelle Vier-Augen-Prinzip (siehe
  „Content-Freigabeprozess" oben) wichtiger als im aktuellen MVP-Maßstab.

## Später von Fachpersonal zu prüfen

- Lernprofile, Formulierungen und Fehler-Schwellenwerte — Grundschulpädagogik/Leseforschung.
- Adaptive individuelle Wortwiederholung und passive Sprachvorbild-Elemente (beide oben
  als Konzept skizziert, Stand: Planung) — Granularität (Wort vs. Muster),
  Aktiv/Passiv-Verhältnis, Eignung von TTS vs. menschlicher Aufnahme als Sprachvorbild —
  Grundschulpädagogik/Leseforschung/Logopädie.
- Abgrenzung zu LRS/Legasthenie-Diagnostik — LRS-Fachkraft/Schulpsychologie.
- `SpecialistFeedback`-Workflow und Berufsrecht bei Ferndiagnose/-beratung —
  Logopäde/Ergotherapeut. Konkret zu klären, bevor Meilenstein 9 real genutzt wird:
  - Reicht ein textbasierter Notizaustausch berufsrechtlich aus, oder braucht ein
    „echtes" Fachkräfte-Feedback zwingend andere Formate/Dokumentationspflichten?
  - Welcher Nachweis (Berufszulassung, Registernummer o.ä.) ist für die
    Admin-Verifizierung eines `SpecialistProfile` tatsächlich ausreichend und wie wird
    er geprüft — die aktuelle Admin-Demo (ein Klick) ist ausdrücklich **keine** solche
    Prüfung (siehe docs/SECURITY.md, Produktionsanforderungen).
  - Haftungsfragen: Wer trägt Verantwortung, wenn Eltern eine Fachkräfte-Notiz als
    medizinischen Rat missverstehen, obwohl das Produkt das ausdrücklich ausschließt?
  - Dokumentationspflichten/Aufbewahrungsfristen für `SpecialistFeedback`-Einträge nach
    Berufsrecht der jeweiligen Fachrichtung.
- E-Book-Bibliothek (oben als Konzept skizziert, Stand: für spätere
  Entwicklungsschritte notiert) — Alters-/Themenpassung eines deutlich größeren
  Content-Bestands, Eignung freien (unbegleiteten) Lesens für die Zielgruppe 7–10 —
  Grundschulpädagogik/Leseforschung.
- Dieselben Fragen gelten analog für `TeacherFeedback`/`TeacherProfile` — plus zusätzlich:
  schulrechtliche Einordnung eines außerschulischen Fortschritts-Tools (Elternrecht auf
  Information vs. schulische Beurteilungshoheit), und ob der generische Assessment-Bogen
  (siehe oben) an ein an der jeweiligen Schule tatsächlich genutztes Beobachtungs-/
  Förderplan-Format angepasst werden müsste, bevor Lehrkräfte ihn im echten Schulalltag
  verwenden — Grundschulpädagogik/Schulverwaltung.
