import { listActiveGrantsForChild } from '@/lib/specialist/specialistService';
import { revokeSpecialistAccessAction } from '@/features/specialist/actions';
import { GrantSpecialistAccessForm } from '@/features/specialist/GrantSpecialistAccessForm';
import { FeedbackRequestForm } from '@/features/specialist/FeedbackRequestForm';

// Verwaltung von Fachkräfte-Zugriffen (Meilenstein 9) — auf der
// Kinderprofil-Bearbeiten-Seite, da es sich um eine Berechtigungsverwaltung
// handelt (analog zu Stammdaten/Barrierefreiheit dort), nicht um Inhalte.
export async function SpecialistAccessManager({ childProfileId }: { childProfileId: string }) {
  const grants = await listActiveGrantsForChild(childProfileId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-600">
        Gib einer verifizierten Fachkraft (z.B. Logopädie, Ergotherapie) Einblick in die Übungsdaten
        deines Kindes. Der Zugriff ist jederzeit widerrufbar und umfasst ausschließlich die
        Fortschrittsübersicht (keine Rohaudiodaten).
      </p>

      <GrantSpecialistAccessForm childProfileId={childProfileId} />

      {grants.length === 0 ? (
        <p className="text-sm text-stone-600">Aktuell hat keine Fachkraft Zugriff.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grants.map((grant) => (
            <li
              key={grant.id}
              className="flex flex-col gap-2 rounded-md border border-stone-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-900">
                    {grant.specialistName ?? grant.specialistEmail}
                  </p>
                  <p className="text-sm text-stone-600">{grant.specialistEmail}</p>
                  {grant.credentials && (
                    <p className="text-sm text-stone-600">{grant.credentials}</p>
                  )}
                </div>
                <form action={revokeSpecialistAccessAction.bind(null, childProfileId, grant.id)}>
                  <button type="submit" className="text-sm font-medium text-red-700 underline">
                    Zugriff entziehen
                  </button>
                </form>
              </div>
              <FeedbackRequestForm childProfileId={childProfileId} childAccessGrantId={grant.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
