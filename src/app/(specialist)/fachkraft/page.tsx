import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnSpecialistProfile } from '@/lib/server/authz';
import { listActiveGrantsForSpecialist } from '@/lib/specialist/specialistService';

export const metadata: Metadata = { title: 'Fachkräfte-Bereich — Lese-Abenteuer' };

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default async function SpecialistHomePage() {
  let specialistProfile;
  try {
    ({ specialistProfile } = await requireOwnSpecialistProfile());
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const grants = await listActiveGrantsForSpecialist(specialistProfile.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Freigegebene Kinderprofile</h1>
        <p className="mt-1 text-sm text-stone-600">
          Nur Eltern können dir Zugriff geben und ihn jederzeit widerrufen. Du siehst ausschließlich
          die Fortschrittsübersicht, keine Rohaudiodaten.
        </p>
      </div>

      {grants.length === 0 ? (
        <p className="text-sm text-stone-600">
          Noch kein Kinderprofil freigegeben. Bitte die Eltern, dir über das Kinderprofil Zugriff zu
          geben (deine E-Mail-Adresse: teile sie den Eltern mit).
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grants.map((grant) => (
            <li
              key={grant.id}
              className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-stone-900">{grant.childDisplayName}</p>
                <p className="text-sm text-stone-600">
                  Zugriff seit {DATE_FORMAT.format(grant.createdAt)}
                </p>
              </div>
              <Link
                href={`/fachkraft/${grant.id}`}
                className="rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white"
              >
                Ansehen
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
