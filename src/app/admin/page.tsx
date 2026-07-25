import type { Metadata } from 'next';
import { db } from '@/lib/server/db';
import {
  toggleStoryPublishedAction,
  toggleSpecialistVerifiedAction,
  toggleTeacherVerifiedAction,
} from '@/features/admin/actions';

export const metadata: Metadata = { title: 'Admin-Demo — Lese-Abenteuer' };

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  word_reading: 'Wortübung',
  spelling_gap_fill: 'Lückentext',
  letter_order: 'Buchstaben ordnen',
  syllable_build: 'Wort aus Silben',
  dictation: 'Diktat',
};

export default async function AdminPage() {
  const [stories, exercises, specialistProfiles, teacherProfiles] = await Promise.all([
    db.story.findMany({
      orderBy: { difficultyLevel: 'asc' },
      select: {
        id: true,
        title: true,
        difficultyLevel: true,
        isPublished: true,
        _count: {
          select: { sections: true, illustrationLayers: true, comprehensionQuestions: true },
        },
      },
    }),
    db.exercise.findMany({
      orderBy: { type: 'asc' },
      select: {
        id: true,
        type: true,
        title: true,
        difficultyLevel: true,
        _count: { select: { items: true } },
      },
    }),
    db.specialistProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true, name: true } } },
    }),
    db.teacherProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  const totalComprehensionQuestions = stories.reduce(
    (sum, story) => sum + story._count.comprehensionQuestions,
    0,
  );
  const totalExerciseItems = exercises.reduce((sum, exercise) => sum + exercise._count.items, 0);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Content-Übersicht</h1>
        <p className="mt-1 text-sm text-stone-600">
          Lokale Admin-Demo (Meilenstein 3): zeigt die per Seed eingespielten Inhalte und erlaubt,
          Geschichten zu veröffentlichen oder zu verbergen. Inhalte selbst werden nicht über die UI
          erstellt, sondern kuratiert in <code>src/content/</code> gepflegt.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">
          Geschichten ({stories.length}, {totalComprehensionQuestions} Verständnisfragen gesamt)
        </h2>
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-stone-100 text-stone-700">
              <tr>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Stufe</th>
                <th className="px-3 py-2">Abschnitte</th>
                <th className="px-3 py-2">Illustrationen</th>
                <th className="px-3 py-2">Fragen</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr key={story.id} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-medium text-stone-900">{story.title}</td>
                  <td className="px-3 py-2">{story.difficultyLevel}</td>
                  <td className="px-3 py-2">{story._count.sections}</td>
                  <td className="px-3 py-2">{story._count.illustrationLayers}</td>
                  <td className="px-3 py-2">{story._count.comprehensionQuestions}</td>
                  <td className="px-3 py-2">
                    {story.isPublished ? (
                      <span className="text-green-700">veröffentlicht</span>
                    ) : (
                      <span className="text-stone-500">verborgen</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <form action={toggleStoryPublishedAction.bind(null, story.id)}>
                      <button type="submit" className="text-sm font-medium underline">
                        {story.isPublished ? 'Verbergen' : 'Veröffentlichen'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">
          Übungen ({exercises.length} Sammlungen, {totalExerciseItems} Einzelübungen gesamt)
        </h2>
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-stone-100 text-stone-700">
              <tr>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Typ</th>
                <th className="px-3 py-2">Stufe</th>
                <th className="px-3 py-2">Einzelübungen</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.id} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-medium text-stone-900">{exercise.title}</td>
                  <td className="px-3 py-2">
                    {EXERCISE_TYPE_LABELS[exercise.type] ?? exercise.type}
                  </td>
                  <td className="px-3 py-2">{exercise.difficultyLevel}</td>
                  <td className="px-3 py-2">{exercise._count.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">
          Fachkräfte ({specialistProfiles.length})
        </h2>
        <p className="text-sm text-stone-600">
          Nur verifizierte Fachkräfte können von Eltern Zugriff auf ein Kinderprofil erhalten. Diese
          Prüfung ersetzt keine echte Qualifikationsprüfung — siehe docs/EDUCATIONAL_MODEL.md.
        </p>
        {specialistProfiles.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Fachkraft registriert.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">E-Mail</th>
                  <th className="px-3 py-2">Qualifikation</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {specialistProfiles.map((profile) => (
                  <tr key={profile.id} className="border-t border-stone-200">
                    <td className="px-3 py-2 font-medium text-stone-900">
                      {profile.user.name ?? '—'}
                    </td>
                    <td className="px-3 py-2">{profile.user.email}</td>
                    <td className="px-3 py-2">{profile.credentials ?? '—'}</td>
                    <td className="px-3 py-2">
                      {profile.verifiedAt ? (
                        <span className="text-green-700">verifiziert</span>
                      ) : (
                        <span className="text-stone-500">nicht verifiziert</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <form action={toggleSpecialistVerifiedAction.bind(null, profile.id)}>
                        <button type="submit" className="text-sm font-medium underline">
                          {profile.verifiedAt ? 'Verifizierung entziehen' : 'Verifizieren'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">
          Lehrkräfte ({teacherProfiles.length})
        </h2>
        <p className="text-sm text-stone-600">
          Nur verifizierte Lehrkräfte können von Eltern Zugriff auf ein Kinderprofil erhalten. Diese
          Prüfung ersetzt keine echte Qualifikationsprüfung — siehe docs/EDUCATIONAL_MODEL.md.
        </p>
        {teacherProfiles.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Lehrkraft registriert.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">E-Mail</th>
                  <th className="px-3 py-2">Schule/Einrichtung</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {teacherProfiles.map((profile) => (
                  <tr key={profile.id} className="border-t border-stone-200">
                    <td className="px-3 py-2 font-medium text-stone-900">
                      {profile.user.name ?? '—'}
                    </td>
                    <td className="px-3 py-2">{profile.user.email}</td>
                    <td className="px-3 py-2">{profile.schoolName ?? '—'}</td>
                    <td className="px-3 py-2">
                      {profile.verifiedAt ? (
                        <span className="text-green-700">verifiziert</span>
                      ) : (
                        <span className="text-stone-500">nicht verifiziert</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <form action={toggleTeacherVerifiedAction.bind(null, profile.id)}>
                        <button type="submit" className="text-sm font-medium underline">
                          {profile.verifiedAt ? 'Verifizierung entziehen' : 'Verifizieren'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
