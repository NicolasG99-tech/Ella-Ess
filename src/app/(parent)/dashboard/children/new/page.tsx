import type { Metadata } from 'next';
import { requireUserForPage } from '@/lib/server/authz';
import { db } from '@/lib/server/db';
import { ChildProfileForm } from '@/features/children/ChildProfileForm';
import { createChildProfileAction } from '@/features/children/actions';
import { MAX_CHILD_PROFILES_PER_PARENT } from '@/lib/validation/child-profile';

export const metadata: Metadata = { title: 'Kind hinzufügen — Lese-Abenteuer' };

export default async function NewChildProfilePage() {
  const user = await requireUserForPage('/dashboard/children/new');
  const existingCount = await db.childProfile.count({ where: { parentId: user.id } });

  if (existingCount >= MAX_CHILD_PROFILES_PER_PARENT) {
    return (
      <p className="text-stone-700">
        Es sind maximal {MAX_CHILD_PROFILES_PER_PARENT} Kinderprofile pro Konto möglich.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-stone-900">Kinderprofil anlegen</h1>
      <ChildProfileForm action={createChildProfileAction} submitLabel="Profil anlegen" />
    </div>
  );
}
