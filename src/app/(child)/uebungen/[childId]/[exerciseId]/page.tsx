import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { db } from '@/lib/server/db';
import { ExercisePractice } from '@/features/exercises/ExercisePractice';

export const metadata: Metadata = { title: 'Übung — Lese-Abenteuer' };

interface ExercisePracticePageProps {
  params: Promise<{ childId: string; exerciseId: string }>;
}

export default async function ExercisePracticePage({ params }: ExercisePracticePageProps) {
  const { childId, exerciseId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const exercise = await db.exercise.findUnique({
    where: { id: exerciseId },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  if (!exercise) {
    notFound();
  }

  return (
    <ExercisePractice
      childProfileId={childProfile.id}
      exercise={{
        id: exercise.id,
        type: exercise.type,
        title: exercise.title,
        items: exercise.items.map((item) => ({
          id: item.id,
          order: item.order,
          prompt: item.prompt,
          audioText: item.audioText,
        })),
      }}
      backHref={`/uebungen/${childId}`}
    />
  );
}
