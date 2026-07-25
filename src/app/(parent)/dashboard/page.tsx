import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserForPage } from '@/lib/server/authz';
import { db } from '@/lib/server/db';
import { ChildProfileList } from '@/features/children/ChildProfileList';
import { MAX_CHILD_PROFILES_PER_PARENT } from '@/lib/validation/child-profile';

export const metadata: Metadata = { title: 'Übersicht — Lese-Abenteuer' };

export default async function DashboardPage() {
  const user = await requireUserForPage('/dashboard');

  const childProfiles = await db.childProfile.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      displayName: true,
      birthYear: true,
      avatarKey: true,
      currentLearningProfile: { select: { name: true } },
    },
  });

  const canAddMore = childProfiles.length < MAX_CHILD_PROFILES_PER_PARENT;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Kinderprofile</h1>
        {canAddMore && (
          <Link
            href="/dashboard/children/new"
            className="rounded-md bg-amber-800 px-4 py-2 text-sm font-medium text-white"
          >
            Kind hinzufügen
          </Link>
        )}
      </div>

      {!canAddMore && (
        <p className="text-sm text-stone-600">
          Du hast bereits {MAX_CHILD_PROFILES_PER_PARENT} Kinderprofile angelegt — mehr sind im MVP
          nicht möglich.
        </p>
      )}

      <ChildProfileList childProfiles={childProfiles} />
    </div>
  );
}
