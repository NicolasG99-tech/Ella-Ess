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

- **Autorisierung: App-eigene Schicht statt Supabase Row Level Security (RLS) —
  bewusste Entscheidung, siehe Frage in der Sicherheitsprüfung 2026-07-28.** RLS setzt
  auf Datenbankebene an (SQL-Policies direkt an den Tabellen) und ist die richtige Wahl,
  wenn der Browser direkt mit Supabase spricht (Supabase-Auth + Client-SDK/PostgREST) —
  dort gibt es sonst keine andere Instanz, die eine Anfrage vor der Datenbank abfängt.
  In dieser App ist das nicht der Fall: Der Browser hat **nie** direkten DB-Zugriff,
  jede Anfrage läuft ausschließlich über Next.js Server Actions/Route Handler, die
  zuerst `requireUser()`/`requireRole()`/`requireOwnChildProfile()` (siehe
  `src/lib/server/authz.ts`) durchlaufen — der Eigentümerschafts-Filter (z. B.
  `parentId: user.id`) steckt direkt in der Prisma-Query. Zusätzliche RLS-Policies
  würden dieselbe Logik ein zweites Mal, in SQL statt TypeScript, pflegen — mit
  echtem Risiko, dass beide Fassungen mit der Zeit auseinanderlaufen, und schwerer
  durch dieselben Integrationstests abzudecken wie der bestehende
  `authz.ts`-Weg (siehe `tests/integration/*-ownership.test.ts`). Fairer Gegenpunkt für
  RLS: Sie schützt zusätzlich vor dem Fall, dass eine künftige Server Action versehentlich
  `requireOwnChildProfile()` vergisst — ein reines Entwicklerfehler-Risiko, das mit
  wachsendem Team wieder relevanter werden kann und bei Bedarf neu bewertet werden
  sollte. Supabase wird entsprechend ausschließlich als PostgreSQL-Hosting genutzt,
  nicht als Auth-/RLS-Schicht (siehe auch ARCHITECTURE.md).
  **Präzisierung vom 2026-07-28** (Supabase-Sicherheitswarnungen
  `rls_disabled_in_public`/`sensitive_columns_exposed`): "keine RLS" bezog sich auf
  fehlende Autorisierungs-*Policies* in SQL — nicht darauf, dass RLS als Schalter
  komplett aus bleiben sollte. Ohne RLS ist nämlich zusätzlich Supabases automatisch
  generierte PostgREST-API (`<project-url>/rest/v1/<Tabelle>`) für **jede** Tabelle
  öffentlich erreichbar, obwohl diese App sie nie nutzt — ein ungenutzter, aber
  trotzdem offener Zugriffsweg, über den z.B. `User.passwordHash` ohne jede
  Prüfung lesbar gewesen wäre. Fix (Migration
  `20260728120000_enable_row_level_security`): RLS auf allen Tabellen aktiviert,
  weiterhin bewusst **ohne** eigene Policies. Das ist kein Widerspruch zur obigen
  Begründung: Ohne `FORCE ROW LEVEL SECURITY` bleibt der Tabellenbesitzer (die Rolle,
  über die Prisma verbindet) von RLS unberührt — die App funktioniert unverändert,
  die Autorisierungslogik bleibt vollständig und einzig in `authz.ts`. RLS dient hier
  ausschließlich als Default-Deny-Schalter gegen die ungenutzte PostgREST-API, nicht
  als zweite Autorisierungsebene für die eigentliche App-Logik.
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
  signiert mit `AUTH_SECRET`. **Sitzungs-Timeout (Ergebnis der Sicherheitsprüfung
  2026-07-28, Punkt 5)**: gleitendes Idle-Timeout von standardmäßig 20 Minuten
  (`SESSION_TIMEOUT_MINUTES`, siehe `.env.example`, `src/lib/server/auth.ts`) statt
  der vorherigen festen 30 Tage — ersetzt durch kurze `maxAge` + kurzes `updateAge`
  (ein Zehntel der `maxAge`, mind. 60s), sodass NextAuth das Session-Cookie bei
  fortlaufender Nutzung automatisch verlängert, es aber nach
  `SESSION_TIMEOUT_MINUTES` Minuten Inaktivität abläuft. 45 Minuten für eine mögliche
  künftige Schulkonfiguration vorgesehen (siehe „Produktionsanforderungen" unten) —
  aktuell ohne eigenes Schul-/Organisationsdatenmodell nur manuell per Env-Variable
  umsetzbar, keine automatische Umschaltung nach Kontoart.
- Logout läuft bewusst über den next-auth/react-Client (nicht als Server Action),
  um die oben beschriebene Race Condition beim Cookie-Löschen zu vermeiden.
- Rate Limiting (In-Memory, siehe `src/lib/server/rate-limit.ts`) für Login,
  Registrierung und Passwort-Reset-Anfragen.
- **E-Mail-Benachrichtigungssystem (Ergebnis der Sicherheitsprüfung 2026-07-28,
  Punkte 7+8)**: `src/lib/server/email.ts` ist als generisches Template-System
  aufgebaut (gemeinsamer HTML-/Text-Rahmen + eine `build*Template`-Funktion pro
  Anlass) statt eines einzelnen Spezialfalls für Passwort-Reset. Bereits aktiv:
  Login-Benachrichtigung bei jeder tatsächlichen Anmeldung (`events.signIn`-Hook in
  `src/lib/server/auth.ts` — feuert nur bei echten Login-Vorgängen, nicht bei
  Session-Aktualisierungen, daher kein Spam) und Datenschutz-Bestätigung bei
  Kontolöschung (`deleteOwnAccountAction`). Als Vorlage vorbereitet, aber noch ohne
  Aufrufer: generischer Auth-Code-Versand (künftige E-Mail-Verifizierung/2FA) und
  Zahlungsmodus-Änderung (wartet auf das künftige Bezahlsystem, siehe
  „Produktionsanforderungen").
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

## Cookie-Einwilligung (§ 25 TDDDG)

Ergebnis der Sicherheitsprüfung 2026-07-28, Punkt 10. `src/lib/consent/cookieConsent.ts`
(reine Logik, SSR-sicher) + `src/features/consent/CookieConsentBanner.tsx`
(Client-Komponente, global im Root-Layout gemountet, `src/app/layout.tsx`) fragen beim
ersten Besuch granular vier Kategorien ab: Notwendig (immer aktiv, nicht abwählbar),
Funktional, Statistik/Analyse, Marketing/externe Medien. Entscheidung wird in
`localStorage` gespeichert (`hasConsent(category)` zum Auslesen), jederzeit über den
dauerhaft eingeblendeten „Cookie-Einstellungen"-Button widerrufbar/änderbar.

**Wichtig — Stand heute**: Die App setzt aktuell **keine** nicht-notwendigen Cookies
(kein Analytics-Tool, kein Tracking-Pixel, keine eingebetteten Drittanbieter-Medien,
keine Werbung). Das Banner wurde trotzdem bereits jetzt vollständig aufgebaut statt erst
bei Einführung eines solchen Features — "privacy by default" (ohne Entscheidung gilt
nichts außer "necessary" als erlaubt) und ein bereits fertiges Fundament, das ein
künftiges Feature nur noch per `hasConsent('analytics')` (o. Ä.) abfragen muss. **Jeder
künftige Code, der ein nicht-notwendiges Skript lädt oder ein nicht-notwendiges Cookie
setzt, MUSS vorher `hasConsent()` prüfen** — sonst wird diese Konformität faktisch
wieder gebrochen, auch wenn das Banner selbst weiter angezeigt wird.

## Rechtlicher Rahmen für ein künftiges Bezahlsystem (unverbindliche Orientierung)

**Keine Rechtsberatung** — dient nur als grobe Richtung für die Planung, bis zur
Umsetzung eines echten Bezahlsystems zwingend durch Jurist:innen zu prüfen (siehe
„Produktionsanforderungen" unten). Ergebnis der Recherche zur Sicherheitsprüfung
2026-07-28, Punkt 9. Stand: Juli 2026, deutsches Recht.

- **Button-Lösung (§ 312j BGB)**: Ein Bestellbutton, der eine Zahlungspflicht auslöst,
  muss eindeutig mit „zahlungspflichtig bestellen" oder einer vergleichbar klaren
  Formulierung beschriftet sein. Bei einer kostenlosen Testphase, die automatisch in
  ein kostenpflichtiges Abo übergeht, reicht eine Beschriftung wie „Jetzt kostenlos
  testen" für den ursprünglichen Button — sobald aber der Übergang zur
  Zahlungspflicht ansteht, muss dieser Schritt erneut denselben Anforderungen
  genügen. Ein Verstoß führt dazu, dass gar kein wirksamer Vertrag zustande kommt.
- **Kündigungsbutton (§ 312k BGB, seit 1.7.2022 Pflicht)**: Für online
  abschließbare, entgeltliche Dauerschuldverhältnisse (ein Abo fällt darunter) muss
  eine ständig verfügbare, leicht zugängliche Kündigungsfunktion mit dem Wortlaut
  „Verträge hier kündigen" (oder einer entsprechend eindeutigen Formulierung)
  bereitgestellt werden, erreichbar ohne vorherigen Login. Fehlt der Button, können
  Verbraucher:innen jederzeit fristlos kündigen — zusätzlich drohen wettbewerbsrechtliche
  Abmahnungen.
- **Widerrufsrecht bei digitalen Inhalten/Abos (§ 356 BGB)**: Grundsätzlich 14 Tage
  Widerrufsfrist ab Vertragsschluss bei Fernabsatzverträgen. Bei einem Abo mit
  kostenloser Testphase besteht das Widerrufsrecht in der Regel nur einmal (für den
  Gesamtvertrag, nicht erneut bei jeder Verlängerung). Das Widerrufsrecht kann bei
  sofort nutzbaren digitalen Inhalten vorzeitig erlöschen, aber NUR nach
  ordnungsgemäßer vorheriger Widerrufsbelehrung und ausdrücklicher Zustimmung der
  Nutzer:in zur sofortigen Ausführung — ohne diese explizite Belehrung/Zustimmung
  bleibt das Widerrufsrecht bestehen.
- **Taschengeldparagraph (§ 110 BGB) — hier voraussichtlich NICHT einschlägig**: Er
  deckt nur vollständig mit eigenen Mitteln bar erfüllte Käufe ab, nicht wiederkehrende
  Zahlungsverpflichtungen (Abos). Ein Kind kann demnach kein wirksames Abo
  abschließen — in diesem Produkt ohnehin unstrittig, da ausschließlich Eltern
  (Erwachsene) den Account/die Zahlung verantworten, Kinder nutzen nur ihr
  zugewiesenes Profil.
- **DSGVO Art. 8 (Einwilligung bei Kindern)**: Für „Dienste der
  Informationsgesellschaft" ist die Einwilligung eines Kindes unter 16 Jahren
  (Deutschland hat die Altersgrenze bei 16 belassen, nicht auf das EU-Minimum von 13
  abgesenkt) nur mit Zustimmung der Erziehungsberechtigten wirksam — passt zum
  bereits bestehenden Modell (Eltern registrieren sich, legen Kinderprofile an,
  Consent-Log). Bei Einführung von Zahlungen/Zahlungsdaten diese Zuordnung
  (Vertragspartner = Elternteil, nicht das Kind) explizit in AGB/Datenschutzerklärung
  festhalten.
- **Bereits vorhandene Baustelle**: `src/app/nutzungsbedingungen/page.tsx` ist laut
  eigenem Text ein „Platzhaltertext für den MVP, kein rechtlich geprüfter Text" und
  deckt bisher nur nicht-diagnostische/elterliche Verantwortungs-Hinweise ab, keine
  Zahlungs-/Widerrufs-/Kündigungsregelungen — muss vor Einführung eines Bezahlsystems
  vollständig überarbeitet werden.

## Produktionsanforderungen (vor echtem Launch)

- Professionelle Prüfung: Datenschutzrecht, Einwilligung für Kinderdaten (DSGVO Art. 8),
  Nutzungsbedingungen (**Jurist**).
- Vor Einführung eines Bezahlsystems: vollständige AGB inkl. Widerrufsbelehrung,
  Kündigungsbutton (§ 312k BGB) und zahlungspflicht-konforme Bestellbuttons (§ 312j
  BGB) durch Jurist:in erstellen/prüfen lassen — siehe Abschnitt „Rechtlicher Rahmen
  für ein künftiges Bezahlsystem" oben für eine erste, unverbindliche Orientierung.
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
- Sitzungs-Timeout, Schulkonfiguration (45 statt 20 Min): sobald ein echtes
  Schul-/Organisationskonzept existiert (eigenes Datenmodell für Schulen/Klassen,
  siehe docs/EDUCATIONAL_MODEL.md), `SESSION_TIMEOUT_MINUTES` automatisch anhand der
  Kontoart setzen statt der aktuellen, global per Umgebungsvariable konfigurierten
  Lösung.
- ~~Billing-Notifications~~ — **teilweise erledigt**: Seit der Einführung des
  Bezahlsystems (2026-07-28, siehe Abschnitt „Bezahlsystem (Stripe)" unten) löst der
  Stripe-Webhook-Handler bei jeder Statusänderung eine E-Mail über
  `sendPaymentMethodChangedEmail()` aus (Tarifwechsel, fehlgeschlagene Zahlung,
  Kündigung). Noch offen: eine gesonderte, im Voraus versendete Erinnerung vor der
  nächsten automatischen Verlängerung (aktuell nur reaktiv bei bereits eingetretenen
  Ereignissen) — dafür bräuchte es einen geplanten Job statt eines reinen
  Webhook-Reflexes.
- Vor Produktivschaltung des Bezahlsystems: echtes Stripe-Konto (nicht Test-Modus),
  Produkte/Preise im Dashboard anlegen, Stripe Tax aktivieren oder alternative
  USt-Abwicklung klären, Webhook-Endpunkt auf die echte Domain zeigen lassen (siehe
  .env.example).

## Bezahlsystem (Stripe)

Ergebnis der Produktentscheidung "Jetzt Zahlungsmodell" (2026-07-28, im Anschluss an
Punkt 6 der Sicherheitsprüfung vom selben Tag). Stripe als Zahlungsanbieter,
gestaffelte Tarife (Basic/Familie/Schule, siehe `src/lib/billing/plans.ts`), vorerst
ohne kostenlose Testphase.

- **Architektur**: `Subscription`-Modell (1:1 zu `User`, siehe `prisma/schema.prisma`)
  wird AUSSCHLIESSLICH vom Stripe-Webhook-Handler
  (`src/app/api/webhooks/stripe/route.ts`) geschrieben
  (`syncSubscriptionFromStripe()`/`deleteLocalSubscription()` in
  `src/lib/billing/subscriptionService.ts`) — nie direkt aus einer Server Action.
  Grund: Der einzige verlässliche Zeitpunkt, zu dem der tatsächliche
  Abrechnungsstatus feststeht, ist ein von Stripe zugestelltes, signiert geprüftes
  Event, nicht die Rückkehr von einer Checkout-Weiterleitung (die kann der Nutzer
  abbrechen, oder das Event trifft verzögert ein).
- **Kündigungsbutton (§ 312k BGB)**: `/dashboard/abo` zeigt einen dauerhaft
  sichtbaren „Verträge hier kündigen"-Button (`CancelSubscriptionButton.tsx`,
  Wortlaut wörtlich aus dem Gesetzestext übernommen), der ohne erneute
  Zugangsdaten-Eingabe zum Stripe-Kundenportal führt — dort erfolgt die eigentliche
  Kündigung.
- **Buttonlösung (§ 312j BGB)**: Der rechtlich bindende Bestell-Klick findet auf der
  von Stripe gehosteten Checkout-Seite statt (Stripes eigener Bezahlen-Button ist
  bereits konform beschriftet). Der eigene Auslöse-Button auf `/preise`
  (`CheckoutButton.tsx`) ist zusätzlich klar als "kostenpflichtig" beschriftet, auch
  wenn das rechtlich nicht zwingend an dieser Stelle nötig wäre — Transparenz soll
  nicht erst auf der zweiten Seite beginnen.
- **Preisangaben (Stand 2026-10-12)**: `/preise` nennt pro Tarif den monatlichen
  Endpreis inkl. MwSt. (PAngV) — Basic 15 €, Familie 22 €, Schule „auf Anfrage“.
  Quelle der Anzeige ist `monthlyPriceCents` in `plans.ts`, abgerechnet wird der
  Stripe-Preis; ein Auseinanderlaufen beider Werte wäre ein Transparenzmangel und
  ist vor jeder Preisänderung manuell abzugleichen. Tarife ohne Listenpreis sind
  serverseitig vom Checkout ausgeschlossen (`getStripePriceId()`).
- **Kein Zugriff auf Zahlungsdaten**: Kreditkarten-/SEPA-Daten werden ausschließlich
  von Stripe erfasst und verarbeitet (gehostete Checkout-/Portal-Seiten) — die App
  selbst sieht und speichert niemals Zahlungsdetails, nur Stripes Kunden-/
  Subscription-IDs und den Abrechnungsstatus.
- **Feature-Gating NOCH NICHT scharf geschaltet**: `requireActiveSubscription()`
  (`src/lib/server/authz.ts`) steht als Baustein bereit, wird aber aktuell von
  keiner Server Action aufgerufen — welche Funktionen tatsächlich hinter ein Abo
  wandern, ist eine noch zu treffende Produktentscheidung (u.a. Umgang mit
  Bestandskonten/Demo-Zugang). Ebenso ist `maxChildProfiles` pro Tarif (siehe
  `plans.ts`) aktuell nur dokumentiert, nicht bei `createChildProfileAction()`
  durchgesetzt (dort gilt weiterhin nur der plan-unabhängige, feste Deckel
  `MAX_CHILD_PROFILES_PER_PARENT`).
- **"school"-Tarif ist Vorbereitung, kein vollständiges Schulprodukt**: Es gibt noch
  kein eigenes Schul-/Organisationsdatenmodell (Kinderprofile hängen weiterhin an
  genau einem Elternkonto) — siehe `plans.ts` für die ausführliche Begründung und den
  bereits an anderer Stelle dokumentierten Zusammenhang mit dem geplanten
  45-Minuten-Sitzungs-Timeout für Schulen.
- **Nicht Bestandteil dieser Umsetzung** (aus dem Sandbox-Environment heraus nicht
  möglich, siehe README/CHANGELOG): Anlegen eines echten Stripe-Kontos, der drei
  Produkte/Preise im Stripe-Dashboard, Ausführen der Datenbank-Migration sowie
  `npm install` zum Nachziehen des `stripe`-Pakets — siehe .env.example für die
  genauen manuellen Schritte.
