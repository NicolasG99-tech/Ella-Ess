import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserForPage } from '@/lib/server/authz';
import { DeleteAccountButton } from '@/features/account/DeleteAccountButton';

export const metadata: Metadata = { title: 'Mein Konto — Lese-Abenteuer' };

export default async function SpecialistAccountPage() {
  const user = await requireUserForPage('/fachkraft/konto');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Mein Konto</h1>
        <p className="mt-1 text-sm text-stone-600">{user.email}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">Eigene Daten herunterladen</h2>
        <p className="text-sm text-stone-600">
          Lädt alle zu deinem Konto gespeicherten Daten als JSON-Datei herunter — inklusive
          erteilter Zugriffe und abgegebener Rückmeldungen.
        </p>
        <a
          href="/api/account/export"
          download
          className="self-start rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
        >
          Daten exportieren
        </a>
      </section>

      <section className="flex flex-col gap-3 border-t border-stone-200 pt-8">
        <h2 className="text-lg font-semibold text-stone-900">Konto löschen</h2>
        <DeleteAccountButton email={user.email} hasChildProfiles={false} />
      </section>

      <Link href="/fachkraft" className="text-sm text-amber-800 underline">
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
