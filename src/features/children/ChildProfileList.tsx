import Link from 'next/link';
import { DeleteChildProfileButton } from '@/features/children/DeleteChildProfileButton';

interface ChildProfileListItem {
  id: string;
  displayName: string;
  birthYear: number;
  avatarKey: string;
  currentLearningProfile: { name: string } | null;
}

export function ChildProfileList({ childProfiles }: { childProfiles: ChildProfileListItem[] }) {
  if (childProfiles.length === 0) {
    return (
      <p className="text-stone-600">
        Noch kein Kinderprofil angelegt. Lege das erste Profil an, um mit dem Lesen zu starten.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {childProfiles.map((child) => (
        <li
          key={child.id}
          className="flex flex-col gap-2 rounded-lg border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-lg font-semibold text-stone-900">{child.displayName}</p>
            <p className="text-sm text-stone-600">
              Geburtsjahr {child.birthYear}
              {child.currentLearningProfile ? ` · ${child.currentLearningProfile.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/lesen/${child.id}`}
              className="rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white"
            >
              Lesen starten
            </Link>
            <Link
              href={`/uebungen/${child.id}`}
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-800"
            >
              Übungen
            </Link>
            <Link
              href={`/belohnungen/${child.id}`}
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-800"
            >
              Belohnungen
            </Link>
            <Link
              href={`/dashboard/children/${child.id}`}
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-800"
            >
              Fortschritt
            </Link>
            <Link
              href={`/dashboard/children/${child.id}/edit`}
              className="text-sm font-medium underline"
            >
              Bearbeiten
            </Link>
            <DeleteChildProfileButton childProfileId={child.id} displayName={child.displayName} />
          </div>
        </li>
      ))}
    </ul>
  );
}
