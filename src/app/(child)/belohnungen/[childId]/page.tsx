import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { getRewardsOverview } from '@/lib/gamification/gamificationService';

export const metadata: Metadata = { title: 'Belohnungen — Lese-Abenteuer' };

interface RewardsPageProps {
  params: Promise<{ childId: string }>;
}

export default async function RewardsPage({ params }: RewardsPageProps) {
  const { childId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const overview = await getRewardsOverview(childProfile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">
          Belohnungen von {childProfile.displayName}
        </h1>
        <p className="mt-1 text-lg text-amber-800">
          {overview.starCount} {overview.starCount === 1 ? 'Stern' : 'Sterne'} gesammelt.
        </p>
      </div>

      {overview.badges.length === 0 ? (
        <p className="text-stone-600">
          Noch keine Abzeichen — die ersten gibt es nach der ersten Geschichte oder Übung.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {overview.badges.map((badge) => (
            <li
              key={badge.code}
              className="flex items-center gap-3 rounded-xl border-2 border-amber-200 bg-white p-4"
            >
              <span aria-hidden="true" className="text-3xl">
                🏅
              </span>
              <div>
                <p className="font-bold text-stone-900">{badge.name}</p>
                <p className="text-sm text-stone-600">{badge.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dashboard" className="text-sm text-amber-800 underline">
        Zurück zum Elternbereich
      </Link>
    </div>
  );
}
