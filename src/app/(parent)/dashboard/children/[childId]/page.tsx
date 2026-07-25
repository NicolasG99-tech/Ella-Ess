import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { getChildProgressOverview } from '@/lib/progress/parentDashboardService';
import { getRewardsOverview } from '@/lib/gamification/gamificationService';
import { listFeedbackForChild as listSpecialistFeedbackForChild } from '@/lib/specialist/specialistService';
import { listFeedbackForChild as listTeacherFeedbackForChild } from '@/lib/teacher/teacherService';
import { ProgressOverviewSummary } from '@/features/progress/ProgressOverviewSummary';
import { ParentFriendlySummaryCard } from '@/features/progress/ParentFriendlySummaryCard';

export const metadata: Metadata = { title: 'Fortschritt — Lese-Abenteuer' };

interface ChildProgressPageProps {
  params: Promise<{ childId: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default async function ChildProgressPage({ params }: ChildProgressPageProps) {
  const { childId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const [overview, rewards, specialistFeedback, teacherFeedback] = await Promise.all([
    getChildProgressOverview(childProfile.id),
    getRewardsOverview(childProfile.id),
    listSpecialistFeedbackForChild(childProfile.id),
    listTeacherFeedbackForChild(childProfile.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Fortschritt von {childProfile.displayName}
        </h1>
      </div>

      <p className="rounded-md border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-700">
        Diese Auswertung ist eine grobe Orientierung, keine exakte Messung — automatische
        Spracherkennung kann ungenau sein. Es gibt bewusst kein „Lesealter“ und keinen Vergleich mit
        anderen Kindern. Details siehe <span className="italic">Pädagogisches Modell</span> in der
        Projektdokumentation.
      </p>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-2xl font-bold text-amber-800">{overview.completedSessionCount}</p>
          <p className="text-sm text-stone-600">Geschichten gelesen</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-2xl font-bold text-amber-800">{overview.completedExerciseCount}</p>
          <p className="text-sm text-stone-600">Übungen geschafft</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-2xl font-bold text-amber-800">{overview.distinctPracticeDays}</p>
          <p className="text-sm text-stone-600">Tage geübt</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-2xl font-bold text-amber-800">
            {rewards.starCount}
            <span aria-hidden="true"> ⭐</span>
          </p>
          <p className="text-sm text-stone-600">{rewards.badges.length} Abzeichen</p>
        </div>
      </section>

      <ParentFriendlySummaryCard childDisplayName={childProfile.displayName} overview={overview} />

      <ProgressOverviewSummary overview={overview} />

      {specialistFeedback.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-stone-900">Rückmeldungen von Fachkräften</h2>
          <p className="text-sm text-stone-600">
            Persönliche Einschätzungen einer von dir freigegebenen Fachkraft — keine Diagnose und
            kein Ersatz für eine reguläre Untersuchung.
          </p>
          <ul className="flex flex-col gap-3">
            {specialistFeedback.map((entry) => (
              <li key={entry.id} className="rounded-md border border-stone-200 bg-white p-4">
                <p className="text-sm text-stone-800">{entry.note}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {entry.authorName ?? 'Fachkraft'}
                  {entry.authorCredentials ? ` · ${entry.authorCredentials}` : ''} ·{' '}
                  {DATE_FORMAT.format(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {teacherFeedback.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-stone-900">Rückmeldungen von Lehrkräften</h2>
          <p className="text-sm text-stone-600">
            Persönliche Einschätzungen einer von dir freigegebenen Lehrkraft — keine Note und kein
            Ersatz für die reguläre schulische Einschätzung.
          </p>
          <ul className="flex flex-col gap-3">
            {teacherFeedback.map((entry) => (
              <li key={entry.id} className="rounded-md border border-stone-200 bg-white p-4">
                <p className="text-sm text-stone-800">{entry.note}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {entry.authorName ?? 'Lehrkraft'}
                  {entry.authorSchoolName ? ` · ${entry.authorSchoolName}` : ''} ·{' '}
                  {DATE_FORMAT.format(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-4">
        <Link href={`/belohnungen/${childId}`} className="text-sm text-amber-800 underline">
          Alle Belohnungen ansehen
        </Link>
        <Link
          href={`/dashboard/children/${childId}/edit`}
          className="text-sm text-amber-800 underline"
        >
          Zugriff für Fachkräfte &amp; Lehrkräfte verwalten
        </Link>
        <Link href="/dashboard" className="text-sm text-amber-800 underline">
          Zurück zur Übersicht
        </Link>
      </div>
    </div>
  );
}
