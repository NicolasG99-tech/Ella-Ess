import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { ChildProfileForm } from '@/features/children/ChildProfileForm';
import { ChildProfileSettingsForm } from '@/features/children/ChildProfileSettingsForm';
import { SpecialistAccessManager } from '@/features/specialist/SpecialistAccessManager';
import { TeacherAccessManager } from '@/features/teacher/TeacherAccessManager';
import { updateChildProfileAction } from '@/features/children/actions';
import { db } from '@/lib/server/db';

export const metadata: Metadata = { title: 'Kinderprofil bearbeiten — Lese-Abenteuer' };

interface EditChildProfilePageProps {
  params: Promise<{ childId: string }>;
}

export default async function EditChildProfilePage({ params }: EditChildProfilePageProps) {
  const { childId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) {
      notFound();
    }
    throw error;
  }

  const learningProfile = childProfile.currentLearningProfileId
    ? await db.learningProfile.findUnique({ where: { id: childProfile.currentLearningProfileId } })
    : null;

  const action = updateChildProfileAction.bind(null, childId);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Kinderprofil bearbeiten: {childProfile.displayName}
        </h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-stone-900">Stammdaten</h2>
        <ChildProfileForm
          action={action}
          submitLabel="Änderungen speichern"
          defaultValues={{
            displayName: childProfile.displayName,
            birthYear: childProfile.birthYear,
            avatarKey: childProfile.avatarKey,
            currentLearningProfileCode: learningProfile?.code,
          }}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-stone-200 pt-8">
        <h2 className="text-lg font-semibold text-stone-900">Barrierefreiheit &amp; Anzeige</h2>
        <ChildProfileSettingsForm
          childProfileId={childId}
          defaultValues={{
            fontScale: childProfile.fontScale,
            lineSpacingScale: childProfile.lineSpacingScale,
            reducedMotion: childProfile.reducedMotion,
            audioHintsEnabled: childProfile.audioHintsEnabled,
          }}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-stone-200 pt-8">
        <h2 className="text-lg font-semibold text-stone-900">Zugriff für Fachkräfte</h2>
        <SpecialistAccessManager childProfileId={childId} />
      </section>

      <section className="flex flex-col gap-4 border-t border-stone-200 pt-8">
        <h2 className="text-lg font-semibold text-stone-900">Zugriff für Lehrkräfte</h2>
        <TeacherAccessManager childProfileId={childId} />
      </section>
    </div>
  );
}
