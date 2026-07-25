# Security

Dieses Dokument wird mit jedem Meilenstein erweitert. Stand: Meilenstein 10.

## Bedrohungsmodell (Kurzform)

Die App verarbeitet Daten von Kindern (Audio, Lernfortschritt, Kontaktdaten der
Eltern). Hauptrisiken:

- Unbefugter Zugriff auf Kinderdaten durch andere Nutzer (IDOR, fehlende
  Autorisierung).
- Unbefugter oder überschießender Zugriff durch Fachkräfte oder Lehrkräfte
  (Meilenstein 9 bzw. später ergänzt): Zugriff ohne echte Elterneinwilligung, Zugriff, der
  über den Assessment-Bogen hinausgeht, oder eine unzureichend geprüfte „Verifizierung".
- Kompromittierung von Elternkonten (schwache Passwörter, fehlender Session-Schutz).
- Ungewolltes Persistieren oder Leaken von Rohaudio.
- Bei optional aktiviertem echten Spracherkennungs-Provider (`SPEECH_PROVIDER=azure`):
  Übertragung von Kinderaudio an einen Drittanbieter ohne ausreichende
  vertragliche/rechtliche Absicherung, sowie die Frage, ob Sprachaudio in
  diesem Kontext als biometrisches Datum (DSGVO Art. 9) einzustufen ist —
  ungeklärt, siehe „Produktionsanforderungen" unten.
- Cross-Site-Scripting/-Request-Forgery über Formulareingaben oder Server Actions.
- Fehlkonfiguration, die interne Daten (Stack Traces, DB-Fehler) an den Client
  durchreicht.

## Sensible Daten

| Datenart                            | Sensibilität | Umgang                                                                                                                        |
| ----------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Rohaudio (Kinderstimme)             | sehr hoch    | verlässt bei Standard-Konfiguration (`SPEECH_PROVIDER=mock`) nie den Browser — der Mock-Provider verarbeitet keine echten Audiodaten, nichts wird an den Server übertragen. Bei optional aktiviertem `SPEECH_PROVIDER=azure` (siehe unten) wird Audio zur Verarbeitung an Azure AI Speech übertragen — dort laut Anbieterangabe bei Echtzeit-Anfragen nicht gespeichert/für Training genutzt (vertraglich über AVV abzusichern, nicht nur Marketingaussage), EU-Datenzone (z.B. Deutschland West-Central) konfigurierbar. Client-seitig optional zusätzlich leicht tonhöhenverschoben (Defense-in-Depth, siehe ARCHITECTURE.md — keine verlässliche Anonymisierung als biometrisches Merkmal). |
| Lernfortschritt/Bewertungen         | hoch         | nur für Elternteil/berechtigte Fachkraft/Lehrkraft sichtbar                                                                   |
| E-Mail/Passwort-Hash (Eltern)       | hoch         | Argon2id-Hash, nie im Klartext geloggt                                                                                        |
| Kindprofil (Spitzname, Geburtsjahr) | mittel       | minimal gehalten, kein echter Name/keine E-Mail erforderlich                                                                  |
| Consent-Log                         | mittel       | Nachweis, kein sensibler Inhalt selbst                                                                                        |

## Rollen

`parent`, `specialist` (eigenes Onboarding seit Meilenstein 9: Registrierung →
Admin-Verifizierung → elterliche Freigabe pro Kind), `teacher` (eigenständige, strukturell
identische Rolle mit eigenem Datenmodell — `TeacherProfile`/`TeacherAccessGrant`/
`TeacherFeedback` statt Wiederverwendung der `Specialist*`-Tabellen), `admin`. Details und
Zugriffsregeln siehe [ARCHITECTURE.md](ARCHITECTURE.md), Abschnitt „Authentifizierung &
Autorisierung" bzw. „Fachkräfte-Zusammenarbeit"/„Lehrkräfte-Rolle", sowie das Rollen-Enum
in `prisma/schema.prisma`.

## Bereits getroffene Schutzmaßnahmen (Stand Meilenstein 10)

- TypeScript strict Mode, keine unbegründeten `any`.
- Passwort-Hashing mit Argon2id (`@node-rs/argon2`, OWASP-Parameter: 19 MiB Speicher,
  2 Iterationen), nie im Klartext gespeichert oder geloggt.
- Zentrale Autorisierung in `src/lib/server/authz.ts`: `requireUser()`/`requireRole()`
  für Server Actions (werfen `AuthzError`), `requireUserForPage()` für Seiten
  (leitet zu `/login` um statt zu werfen — Next.js kann Seiten spekulativ
  vor-rendern/prefetchen, auch während eines Logouts; ein Wurf dort würde als
  ungefangener Serverfehler geloggt, siehe `git log` zu `LogoutButton.tsx` für den
  konkreten Vorfall). `requireOwnChildProfile()` verhindert IDOR: ein Elternteil
  erhält ausschließlich eigene Kinderprofile zurück (`parentId`-Filter direkt in der
  Query, nicht nachträglich geprüft).
- `src/proxy.ts` (Next.js 16, vormals `middleware.ts`) leitet unauthentifizierten
  Zugriff auf `/dashboard/*`, `/admin/*`, `/lesen/*`, `/uebungen/*` und `/belohnungen/*`
  bereits auf HTTP-Ebene um (307 zu `/login?callbackUrl=…`) — läuft seit Next 16 im Node.js- statt
  Edge-Runtime. **Wichtiger Fundort in Meilenstein 6**: Die Datei muss bei einem
  `src/`-Layout unter `src/proxy.ts` liegen, nicht im Projekt-Root — Next.js hat sie am
  Root sonst stillschweigend ignoriert (kein Build-Fehler, keine Warnung, keine
  „ƒ Proxy (Middleware)“-Zeile im Build-Log), wodurch die Umleitung nur zufällig über die
  seiten-eigenen `requireUserForPage()`/`requireRoleForPage()`-Aufrufe funktionierte.
  `/lesen/*` und `/uebungen/*` riefen `requireOwnChildProfile()` direkt auf (wirft bei
  fehlender Session `AuthzError`, von der Seite als `notFound()` behandelt) und hatten
  keinen solchen Seiten-Fallback — unauthentifizierte Zugriffe dorthin lieferten daher
  404 statt eines Login-Redirects, bis die Datei an den richtigen Ort verschoben wurde.
  Kein Sicherheitsloch (der Zugriff wurde weiterhin korrekt verweigert), aber eine
  UX-Inkonsistenz und ein Beleg dafür, den Build-Log auf die „ƒ Proxy“-Zeile zu prüfen,
  statt nur den HTTP-Statuscode zu testen.
- Session-Strategie: JWT (von Auth.js für Credentials-Provider vorgeschrieben),
  30 Tage Gültigkeit, signiert mit `AUTH_SECRET`.
- Logout läuft bewusst über den next-auth/react-Client (nicht als Server Action),
  um die oben beschriebene Race Condition beim Cookie-Löschen zu vermeiden.
- Rate Limiting (In-Memory, siehe `src/lib/server/rate-limit.ts`) für Login,
  Registrierung und Passwort-Reset-Anfragen.
- Passwort-Reset ohne User-Enumeration: identische Antwort unabhängig davon, ob die
  E-Mail-Adresse registriert ist; Token laufen nach 30 Minuten ab und werden nach
  Nutzung sofort gelöscht.
- Audit-Log (`AuditEvent`) für Registrierung, Login-relevante Passwort-Änderungen,
  Kinderprofil-Erstellung/-Änderung/-Löschung.
- `.env*` ist per `.gitignore` von Commits ausgeschlossen (außer `.env.example` als
  dokumentierte Vorlage ohne echte Geheimnisse).
- Next.js Server Actions bieten eingebauten CSRF-Schutz (Origin/Host-Abgleich) und
  Dead-Code-Elimination nicht genutzter Actions aus dem Client-Bundle.
- Next Telemetry ist deaktiviert.
- Datenbank-Zugriff ausschließlich über Prisma (parametrisierte Queries, kein
  Roh-SQL) — schützt vor SQL-Injection.
- Integrationstest (`tests/integration/child-profile-ownership.test.ts`) prüft die
  IDOR-schützende Datenbankabfrage direkt; E2E-Test
  (`tests/e2e/auth-and-children.spec.ts`) prüft Registrierung → Login → Kinderprofil
  → Logout → Session-Invalidierung → 404 bei fremdem/nicht-existentem Kinderprofil.
- **Audio-Löschung**: Rohaudio wird im Mock-Modus gar nicht erst an den Server
  übertragen (siehe ARCHITECTURE.md, Abschnitt „Audioverarbeitung") — stärker als
  „nach Verarbeitung löschen", da nichts zu löschen bleibt. Ein echter
  Spracherkennungs-Anbieter müsste diese Garantie beim Hochladen aktiv umsetzen
  (kurzlebiger Serverspeicher, sofortiges Verwerfen nach Transkription).
- Lesesitzungs-Autorisierung folgt demselben Muster wie Kinderprofile:
  `requireOwnChildProfile()` in jeder Server Action, IDOR-geprüft per Integrationstest
  (`tests/integration/reading-session.test.ts`) und E2E-404-Tests für fremde/nicht
  existente Kinderprofile bzw. Geschichten.
- Verständnisfragen- und Übungs-Aktionen (`submitComprehensionAnswerAction`,
  `submitSpellingAttemptAction`, `markWordReadingCompleteAction`) prüfen zuerst
  `requireOwnChildProfile()` und laden bei Verständnisfragen die Lesesitzung zusätzlich
  gefiltert nach `childProfileId` (`db.readingSession.findFirstOrThrow({ where: { id,
childProfileId } })`), sodass eine fremde `sessionId`/`questionId`-Kombination nicht
  auf ein anderes Kinderprofil durchgreifen kann.
- Die Belohnungsübersicht (`/belohnungen/[childId]`) folgt demselben Muster wie
  `/lesen` und `/uebungen`: `requireOwnChildProfile()` in der Seite, `AuthzError` wird
  zu `notFound()`, Zugriff auf ein fremdes/nicht existentes Kinderprofil liefert 404
  (E2E-abgedeckt in `tests/e2e/gamification.spec.ts`). `getRewardsOverview()` selbst
  filtert serverseitig immer nach der bereits geprüften `childProfileId`.
- Die neue Fortschrittsseite (`/dashboard/children/[childId]`, Meilenstein 8) verwendet
  dasselbe Muster wie die bereits bestehende Bearbeiten-Seite
  (`/dashboard/children/[childId]/edit`): `requireOwnChildProfile()` +
  `notFound()` bei `AuthzError`, zusätzlich per `/dashboard/*` bereits über
  `src/proxy.ts` und `dashboard/layout.tsx` sitzungsgeschützt. `getChildProgressOverview()`
  filtert alle vier zugrundeliegenden Abfragen (SkillProgress, ReadingSession,
  SpellingAttempt, ComprehensionAttempt) ausschließlich nach der bereits geprüften
  `childProfileId` — E2E-abgedeckt in `tests/e2e/parent-dashboard.spec.ts` (404 bei
  fremdem/nicht existentem Kinderprofil).
- **Fachkräfte-Zugriff (Meilenstein 9)** ist dreifach eingeschränkt: (1) nur
  verifizierte Fachkräfte (`SpecialistProfile.verifiedAt`) können überhaupt eine
  Freigabe erhalten — `grantSpecialistAccess()` prüft Rolle, Profil und Verifizierung
  in einem Schritt und liefert bei jedem Fehlschlag dieselbe generische Meldung; (2)
  `requireOwnActiveGrant()` verifiziert für jede Fachkräfte-Aktion, dass die
  `ChildAccessGrant`-ID zum eigenen `SpecialistProfile` gehört, nicht widerrufen und
  nicht abgelaufen ist (IDOR-Schutz, analog zu `requireOwnChildProfile()`); (3) Zugriff
  ist strikt lesend + Freitextnotizen — keine Möglichkeit, über die Fortschrittsübersicht
  hinaus auf Kinddaten (insbesondere keine Rohaudiodaten, da diese ohnehin nie den
  Browser des Kindes verlassen) zuzugreifen.
- **Nachträglich behobene IDOR-Lücke**: `createFeedbackRequestAction` prüfte
  ursprünglich nur `requireOwnChildProfile(childProfileId)`, nicht aber, ob die
  übergebene `childAccessGrantId` tatsächlich zu diesem Kind gehört — ein Elternteil
  hätte (bei Kenntnis einer fremden Grant-ID) eine Anfrage gegen die Freigabe eines
  fremden Kindes erstellen können. Der Zugehörigkeitscheck wurde in die testbare
  Service-Funktion `createFeedbackRequest()` verschoben (statt inline in der Server
  Action) und per Integrationstest abgesichert
  (`tests/integration/specialist.test.ts`, „IDOR"-Testfall) — Beleg dafür, bei jeder
  neuen Aktion mit zwei zusammengehörigen IDs explizit zu prüfen, dass beide wirklich
  zueinander gehören, nicht nur, dass der Aufrufer die äußere ID besitzt.
- E2E-Test (`tests/e2e/specialist.spec.ts`) deckt den kompletten Vertrauenspfad ab:
  Registrierung → Zugriffsversuch vor Verifizierung schlägt fehl → Admin-Verifizierung →
  Freigabe → Fachkraft sieht Fortschritt und sendet Rückmeldung → Eltern sehen die
  Rückmeldung → Widerruf entfernt den Zugriff sofort → 404 bei fremder/nicht
  existenter Freigabe → Redirect bei fehlender Anmeldung.
- **Lehrkräfte-Zugriff** ist strukturell identisch abgesichert — eigenes, paralleles
  Modell (`TeacherProfile`/`TeacherAccessGrant`/`TeacherFeedback`) mit derselben
  Dreifach-Prüfung, eigener `requireOwnActiveTeacherGrant()`-Funktion und eigenem
  IDOR-Testfall (`tests/integration/teacher.test.ts`) sowie eigenem End-to-End-Test
  (`tests/e2e/teacher.spec.ts`, deckt denselben Vertrauenspfad ab). Da beide Rollen
  unabhängige Tabellen nutzen, kann eine Fachkraft nicht versehentlich oder böswillig auf
  eine für eine Lehrkraft erteilte Freigabe zugreifen (oder umgekehrt) — es gibt keine
  gemeinsame ID-Namensräume zwischen `ChildAccessGrant` und `TeacherAccessGrant`.
- **Security Headers (Meilenstein 10)**, gesetzt in `src/proxy.ts` für praktisch jede
  Route (nicht mehr nur die geschützten Prefixes): `Content-Security-Policy`
  (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'` u.a.),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (Mikrofon nur für die eigene Origin erlaubt, Kamera/Standort/Zahlung gesperrt).
  **Ein nonce-basiertes `script-src` (statt `'unsafe-inline'`) wurde ausprobiert und
  mit einem echten E2E-Test wieder verworfen**: ein pro Request zufällig generierter
  Nonce funktioniert korrekt für den ersten vollständigen Seitenaufruf (per `curl`
  verifiziert), aber sobald Next.js' Client-Router im selben Tab weiternavigiert oder
  Links prefetcht, entstehen weitere Proxy-Aufrufe mit jeweils neuem Nonce, der nicht
  mehr zum bereits vom Browser durchgesetzten CSP-Header passt — das führte zu echten
  „Refused to execute/load script"-Fehlern, aufgedeckt vom bestehenden Konsolenfehler-
  Check in `tests/e2e/auth-and-children.spec.ts`. Dokumentierter Nachbesserungsbedarf,
  siehe „Produktionsanforderungen" unten. `style-src` erlaubt `'unsafe-inline'`, da die
  App bewusst echte Inline-Styles nutzt (Fortschrittsbalken, Schriftgrößen-Skalierung).
- **Datenexport & Kontolöschung (Meilenstein 10)**: `GET /api/account/export` (eigener
  Route Handler statt Server Action, damit der Browser eine echte Datei mit
  `Content-Disposition: attachment` herunterlädt) liefert alle einem Konto zugeordneten
  Daten als JSON — rollenunabhängig über `gatherAccountData()`
  (`src/lib/account/accountService.ts`), immer gefiltert nach der bereits per `auth()`
  geprüften `userId`. `deleteOwnAccountAction()` löscht die eigene `User`-Zeile; alle
  abhängigen Daten (Kinderprofile inkl. Lesesitzungen/Übungsversuche/Fortschritt/
  Belohnungen, `SpecialistProfile` inkl. erteilter Zugriffe/Rückmeldungen) kaskadieren
  auf Datenbankebene (`onDelete: Cascade`, siehe `prisma/schema.prisma`) — keine
  manuelle Lösch-Logik nötig. `AuditEvent.actorUserId` nutzt bewusst `onDelete: SetNull`
  statt `Cascade`, damit der Prüfpfad nach einer Kontolöschung erhalten bleibt.
  Löschung erfordert Eintippen der eigenen E-Mail-Adresse zur Bestätigung
  (`DeleteAccountButton.tsx`) — höhere Hürde als beim Löschen eines einzelnen
  Kinderprofils, da hier zusätzlich der Zugang selbst betroffen ist. Nach dem Löschen
  meldet der Client explizit ab (`signOut()`), da die serverseitige Löschung allein das
  bereits ausgestellte JWT-Session-Cookie nicht ungültig macht.
- **Barrierefreiheits-Regressionstest (Meilenstein 10)**: `tests/e2e/accessibility.spec.ts`
  scannt die wichtigsten Seiten mit `@axe-core/playwright`. Fand zwei echte, jetzt
  behobene Probleme: (1) `(auth)/layout.tsx` und `(child)/layout.tsx` umschlossen ihren
  Inhalt mit einem einfachen `<div>` statt `<main>` — kein Landmark, wodurch
  Screenreader-Nutzer:innen den Hauptinhalt nicht gezielt ansteuern konnten (betraf
  Login, Registrierung, Lesesitzung, Übungen, Belohnungen); (2) die Aktionsspalten der
  Admin-Tabellen hatten leere `<th>`-Kopfzellen ohne für Screenreader wahrnehmbaren
  Text (behoben mit `sr-only`-Text „Aktionen").

## Optionaler echter Spracherkennungs-Provider (Azure)

`SPEECH_PROVIDER=azure` (`AzureSpeechRecognitionProvider.ts`) ist implementiert,
aber **nicht standardmäßig aktiv** (Standard bleibt `mock`). Vor Aktivierung in
einer echten Umgebung mit echten Kindern zwingend zu klären/umzusetzen:

- Auftragsverarbeitungsvertrag (AVV) mit Microsoft für Azure AI Speech, mit
  expliziter Zusicherung zu Nicht-Speicherung/Nicht-Training bei
  Echtzeit-Anfragen (nicht nur allgemeine Produktdokumentation).
- **Entschieden**: Azure-Ressource in einer EU- bzw. deutschen Datenzone anlegen
  (Deutschland West-Central bevorzugt, alternativ eine andere EU-Region), nicht
  in einer Standard-/Global-Region. Nicht-persistente Verarbeitung (kein
  Speichern/Training bei Echtzeit-Anfragen, siehe AVV-Punkt oben) plus
  EU-/deutsche Datenzone ist die primäre, festgelegte Schutzmaßnahme für
  dieses Risiko — nicht eine inhaltliche Verschleierung der Stimme selbst.
- Rechtliche Einordnung, ob die Übertragung von Sprachaudio in diesem
  Anwendungsfall „biometrische Daten" im Sinne von DSGVO Art. 9 darstellt
  (hängt u.a. davon ab, ob der Zweck die eindeutige Identifizierung einer
  Person ist — hier: nein, Zweck ist Aussprachebewertung gegen bekannten
  Referenztext, keine Sprechererkennung/-verifizierung) — **Klärung durch
  Jurist, nicht durch Code-Annahme**.
- Einwilligungstexte aktualisieren: die bisherige Einwilligung deckt
  vermutlich keine Übertragung von Audiodaten an einen Drittanbieter ab.
- Die client-seitige, optionale Tonhöhenverschiebung
  (`SPEECH_PRIVACY_PITCH_SHIFT_RATE`, siehe ARCHITECTURE.md) ist eine
  zusätzliche Defense-in-Depth-Maßnahme, **kein Ersatz** für die drei
  vorstehenden Punkte — sie bietet laut Voice-Anonymisierungsforschung nur
  schwachen Schutz gegen gezielte Sprechererkennung, da diese überwiegend auf
  Formantstruktur, nicht auf der Tonhöhe beruht.
- **Formant-Verschiebung (z. B. McAdams-Koeffizient) wurde geprüft und bewusst
  verworfen**, nicht nur als "vorerst nicht umgesetzt": Gegen einen
  informierten Angreifer mit mehreren Aufnahmen desselben (anonymisierten)
  Kindes über Zeit — der realistische Fall bei einem echten Datenleck, da pro
  Kind viele Lesesitzungen anfallen — fällt der Sprecher-Ebene-Schutz laut
  VoicePrivacy-Challenge-Forschung nur moderat aus, nicht stark. Zusätzlich
  überschneidet sich die für Formant-Verschiebung nötige Verzerrung mit genau
  dem Merkmalsraum, auf dem die Aussprachebewertung selbst beruht (Formanten
  kodieren Vokal-/Konsonantenidentität) — ein Zielkonflikt mit der
  Kernfunktion, den die Tonhöhenverschiebung nicht hat. Stattdessen gilt
  nicht-persistente Verarbeitung auf EU-/deutschen Servern (siehe oben) als
  primäre Schutzmaßnahme für dieses Risiko.
- `next.config.ts` hebt `serverActions.bodySizeLimit` auf `4mb` an, damit
  Audio-Uploads nicht am Standardlimit (1 MB) scheitern.

## Noch zu implementieren (kommende Meilensteine)

- Nonce-basiertes `script-src` für die CSP (siehe oben — aktuell `'unsafe-inline'` als
  dokumentierte, getestete Abschwächung).

## Bekannte Einschränkungen

- Dieses Dokument beschreibt den MVP-Stand für lokale Entwicklung. Es ersetzt keinen
  Penetrationstest und keine rechtliche Prüfung.
- ~~Rate Limiting ist In-Memory und pro Node-Prozess~~ — **erledigt**: zentraler,
  DB-gestützter Rate-Limiter über `RateLimitBucket` (Postgres/Prisma, siehe
  `src/lib/server/rate-limit.ts`), übersteht Neustarts und wirkt über mehrere
  Instanzen hinweg. Trade-off gegenüber Redis: kleines Race-Window bei sehr hoher
  Gleichzeitigkeit für denselben Schlüssel — für den aktuellen Traffic-Umfang
  akzeptabel, bei deutlich höherem Volumen auf Redis migrieren.
- Ein vollständiges Audit-Log für alle sensiblen Aktionen (aktuell nur
  Auth/Kinderprofile/Content-Verwaltung/Fachkräfte-Zugriff) fehlt noch.
- ~~Passwort-Reset-E-Mail-Versand ist gemockt~~ — **erledigt**: echter Versand über
  Brevo (EU-Anbieter, passt zur EU-Datenresidenz-Linie), siehe
  `src/lib/server/email.ts`. Ohne konfigurierten `BREVO_API_KEY` weiterhin
  Fallback auf Server-Log (unverändertes Verhalten für lokale Entwicklung).
- Der automatisierte Barrierefreiheits-Scan (`@axe-core/playwright`) deckt nur
  automatisiert erkennbare, strukturelle Probleme ab — keine manuelle Prüfung mit
  echten Screenreadern/Tastaturnavigation über den gesamten Funktionsumfang, kein
  Farbkontrast-Audit über alle Zustände (Hover/Fokus/Fehler) hinweg.
- `npm audit` meldet 5 moderate, transitive Schwachstellen (in `prisma`s optionalem
  Dev-Tooling bzw. Next.js' gebündeltem `postcss`) — beide nur über ein breaking
  Downgrade (`prisma@6.19`, `next@9.3.3`) automatisch behebbar und daher hier bewusst
  nicht per `npm audit fix --force` „gelöst"; vor Produktion erneut prüfen, ob
  aktualisierte, nicht-breaking Patches verfügbar sind.

## Produktionsanforderungen (vor echtem Launch)

- Professionelle Prüfung: Datenschutzrecht, Einwilligung für Kinderdaten (DSGVO Art. 8),
  Nutzungsbedingungen (**Jurist**).
- Echter Verifizierungsprozess für Fachkräfte- und Lehrkräfte-Konten (z.B. Nachweis der
  Berufszulassung/-registrierung bzw. Schulzugehörigkeit) statt des aktuellen
  Admin-Demo-Klicks — siehe docs/EDUCATIONAL_MODEL.md, Abschnitt „Später von Fachpersonal
  zu prüfen" (**Berufsrechtliche/schulrechtliche/rechtliche Prüfung**).
- Nonce-basiertes `script-src` für die CSP sauber mit Next.js' Client-Router-Prefetching
  vereinbar machen (z.B. sitzungsstabiler statt pro-Request-zufälliger Nonce), statt der
  aktuellen `'unsafe-inline'`-Abschwächung.
- Penetrationstest.
- **App-Hosting: entschieden — Hetzner (deutscher Standort, Falkenstein/Nürnberg) +
  Coolify**, siehe docs/DEPLOYMENT.md für Einrichtungsschritte, `Dockerfile` im
  Repo-Root. Begründung: deutsches Unternehmen/deutsche Rechenzentren (kein
  US-CLOUD-Act-Risiko), niedrige Kosten. Für den Hetzner-Server selbst zusätzlich
  zu den DB-Backups (siehe unten) einen Hetzner-Snapshot einplanen.
- Datenbank-Hosting-Entscheidung mit Backup- und Wiederherstellungskonzept. Supabase steht als
  vorbereitete, gehostete PostgreSQL-Option zur Verfügung (`DATABASE_URL` gepoolt für
  Laufzeit-Queries, `DIRECT_URL` direkt für Migrationen, siehe README.md und
  `.env.example`) — ausschließlich als Postgres-Hosting genutzt, nicht als Auth-/RLS-
  Ersatz für die bestehende Auth.js-Schicht. Supabases automatische Backups decken
  einen Teil des Wiederherstellungskonzepts ab; Point-in-Time-Recovery ist je nach
  Tarif ein kostenpflichtiges Add-on und daher **nicht automatisch enthalten** — vor
  Produktivbetrieb den gewählten Supabase-Plan und die tatsächliche
  Wiederherstellungs-SLA explizit prüfen und dokumentieren, statt dies stillschweigend
  als „erledigt" zu betrachten.
- Barrierefreiheitsprüfung durch externe Stelle (über automatisierte Checks hinaus) —
  insbesondere manuelle Tastatur-/Screenreader-Tests durch Betroffene.
- ~~Härtung der Passwort-Reset- und E-Mail-Versand-Struktur~~ — **erledigt** (Brevo,
  siehe oben). Weiterhin zu prüfen: Absender-Domain per SPF/DKIM/DMARC verifizieren,
  damit Reset-Mails nicht im Spam landen.
- Prüfung, ob Argon2id-Parameter (Memory/Iterations) für die Zielinfrastruktur passend
  konfiguriert sind.
- Erneute `npm audit`-Prüfung auf nicht-breaking Patches für die aktuell bekannten
  transitiven Schwachstellen.
- Falls `SPEECH_PROVIDER=azure` produktiv genutzt werden soll: siehe Abschnitt
  „Optionaler echter Spracherkennungs-Provider (Azure)" oben — AVV, EU-Datenzone,
  rechtliche Einordnung als biometrisches Datum, aktualisierte Einwilligung.
