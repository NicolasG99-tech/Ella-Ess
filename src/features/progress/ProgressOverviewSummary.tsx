import type { ChildProgressOverview } from '@/lib/progress/parentDashboardService';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Gemeinsame Darstellung der Fortschrittsübersicht — genutzt sowohl auf der
// Eltern-Fortschrittsseite (`/dashboard/children/[childId]`) als auch in der
// (rein lesenden) Fachkräfte-Ansicht (`/fachkraft/[grantId]`), damit beide
// exakt dieselben, nicht-diagnostischen Formulierungen zeigen.
export function ProgressOverviewSummary({ overview }: { overview: ChildProgressOverview }) {
  return (
    <>
      {overview.comprehensionFirstTryTotal > 0 && (
        <p className="text-sm text-stone-700">
          {overview.comprehensionFirstTryCorrect} von {overview.comprehensionFirstTryTotal}{' '}
          Verständnisfragen wurden beim ersten Versuch richtig beantwortet.
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Fähigkeiten</h2>
        {overview.masteryGroups.length === 0 ? (
          <p className="text-sm text-stone-600">
            Noch keine Übungsdaten — die Übersicht füllt sich nach den ersten Geschichten und
            Übungen.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {overview.masteryGroups.map((group) => (
              <div key={group.learningProfileName}>
                <h3 className="mb-2 text-sm font-semibold text-stone-700">
                  {group.learningProfileName}
                </h3>
                <ul className="flex flex-col gap-3">
                  {group.skills.map((skill) => (
                    <li key={skill.skillName}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-stone-800">{skill.skillName}</span>
                        <span className="text-stone-600">{skill.label}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-stone-200">
                        <div
                          className="h-2 rounded-full bg-amber-600"
                          style={{ width: `${Math.round(skill.masteryLevel * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Zuletzt gelesen</h2>
        {overview.recentSessions.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Geschichte zu Ende gelesen.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.recentSessions.map((session, index) => (
              <li
                key={`${session.storyTitle}-${index}`}
                className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-2 text-sm"
              >
                <span className="font-medium text-stone-900">{session.storyTitle}</span>
                <span className="text-stone-600">{DATE_FORMAT.format(session.completedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
