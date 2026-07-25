import { listActiveGrantsForChild } from '@/lib/teacher/teacherService';
import { revokeTeacherAccessAction } from '@/features/teacher/actions';
import { GrantTeacherAccessForm } from '@/features/teacher/GrantTeacherAccessForm';
import { TeacherFeedbackRequestForm } from '@/features/teacher/TeacherFeedbackRequestForm';

// Verwaltung von Lehrkräfte-Zugriffen — auf der Kinderprofil-Bearbeiten-Seite,
// analog zu SpecialistAccessManager.tsx, da es sich um eine
// Berechtigungsverwaltung handelt, nicht um Inhalte.
export async function TeacherAccessManager({ childProfileId }: { childProfileId: string }) {
  const grants = await listActiveGrantsForChild(childProfileId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-600">
        Gib einer verifizierten Lehrkraft Einblick in die Übungsdaten deines Kindes. Der Zugriff ist
        jederzeit widerrufbar und umfasst ausschließlich den Assessment-Bogen (keine Rohaudiodaten).
      </p>

      <GrantTeacherAccessForm childProfileId={childProfileId} />

      {grants.length === 0 ? (
        <p className="text-sm text-stone-600">Aktuell hat keine Lehrkraft Zugriff.</p>
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
                    {grant.teacherName ?? grant.teacherEmail}
                  </p>
                  <p className="text-sm text-stone-600">{grant.teacherEmail}</p>
                  {grant.schoolName && <p className="text-sm text-stone-600">{grant.schoolName}</p>}
                </div>
                <form action={revokeTeacherAccessAction.bind(null, childProfileId, grant.id)}>
                  <button type="submit" className="text-sm font-medium text-red-700 underline">
                    Zugriff entziehen
                  </button>
                </form>
              </div>
              <TeacherFeedbackRequestForm
                childProfileId={childProfileId}
                teacherAccessGrantId={grant.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
