import { buildParentFriendlySummary } from '@/lib/progress/parentSummary';
import type { ChildProgressOverview } from '@/lib/progress/parentDashboardService';

// Laienverständliche Einordnung, oberhalb der bestehenden
// <ProgressOverviewSummary> auf der Eltern-Kind-Seite — Eltern sollen zuerst
// eine kurze Einschätzung in eigenen Worten sehen, bevor die Detail-Balken
// folgen. Siehe parentSummary.ts für die zugrunde liegende Logik.
export function ParentFriendlySummaryCard({
  childDisplayName,
  overview,
}: {
  childDisplayName: string;
  overview: ChildProgressOverview;
}) {
  const summary = buildParentFriendlySummary(childDisplayName, overview);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Wie hat {childDisplayName} begonnen?
        </h2>
        <p className="mt-1 text-sm text-stone-700">
          {summary.startedText ?? `${childDisplayName} hat noch keine Geschichte begonnen.`}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Wo steht {childDisplayName} jetzt?</h2>
        <p className="mt-1 text-sm text-stone-700">{summary.nowText}</p>
      </div>

      {summary.attentionFlags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Worauf du achten kannst</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {summary.attentionFlags.map((flag) => (
              <li
                key={flag.skillName}
                className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-stone-900">{flag.skillName}: </span>
                <span className="text-stone-700">{flag.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
