-- Aktiviert Row Level Security (RLS) auf allen Tabellen, OHNE eigene Policies
-- anzulegen — Ergebnis der Supabase-Sicherheitswarnungen "Table publicly
-- accessible" (rls_disabled_in_public) und "Sensitive data publicly
-- accessible" (sensitive_columns_exposed), gemeldet am 2026-07-28.
--
-- WICHTIG, warum das die bewusste Entscheidung "keine Supabase-RLS-Policies,
-- Autorisierung ausschließlich in src/lib/server/authz.ts" (siehe
-- docs/SECURITY.md, Abschnitt "Bereits getroffene Schutzmaßnahmen") NICHT
-- widerspricht, sondern ergänzt:
--
-- Supabase generiert für JEDE Tabelle im "public"-Schema automatisch eine
-- REST-API (PostgREST) unter <project-url>/rest/v1/<Tabelle> — unabhängig
-- davon, ob die App diese API überhaupt nutzt. Diese App verbindet sich NIE
-- über PostgREST/den Supabase-Client, sondern ausschließlich über Prisma mit
-- einer direkten Postgres-Verbindung als Tabellenbesitzer (siehe
-- DATABASE_URL/DIRECT_URL, Rolle "postgres.<project-ref>" bzw. lokal
-- "lese_app"). Ohne RLS ist diese ungenutzte PostgREST-API trotzdem
-- öffentlich erreichbar — mit dem Datenbank-Passwort hat man ohnehin
-- vollen Zugriff, aber der (weit weniger schützenswerte) "anon"-Schlüssel
-- reicht ohne RLS ebenfalls für Lese-/Schreibzugriff auf ALLE Zeilen jeder
-- Tabelle über die REST-API, inklusive User.passwordHash.
--
-- Die Aktivierung von RLS OHNE Policies bedeutet: Postgres verweigert per
-- Default jeden Zugriff für Rollen, die nicht Tabellenbesitzer sind (also
-- "anon"/"authenticated", die PostgREST nutzt) — genau das gewünschte
-- Verhalten, da diese App über PostgREST ohnehin nie zugreifen soll.
-- Der Tabellenbesitzer (die Rolle, mit der Prisma verbindet) BLEIBT von RLS
-- unberührt, da kein "FORCE ROW LEVEL SECURITY" gesetzt wird — die App
-- funktioniert dadurch unverändert weiter, es werden bewusst KEINE
-- SQL-Policies angelegt (die eigentliche Autorisierungslogik bleibt
-- vollständig in src/lib/server/authz.ts, siehe dortige Begründung gegen
-- doppelt gepflegte Autorisierung).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiteracySkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorySection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IllustrationLayer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComprehensionQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComprehensionAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exercise" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExerciseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReadingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReadingAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WordEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnlockedIllustration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpellingAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EarnedReward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialistProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildAccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialistFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherAccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeacherFeedbackRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;

-- Hinweis: "Subscription" steht hier bewusst NICHT — die Tabelle existiert zu
-- diesem Zeitpunkt noch nicht (sie wird erst von der Migration angelegt, die
-- auf diese folgt). RLS für "Subscription" wird dort direkt nach dem
-- CREATE TABLE ergänzt.
