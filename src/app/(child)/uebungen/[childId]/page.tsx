import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { db } from '@/lib/server/db';

export const metadata: Metadata = { title: 'Übungen — Lese-Abenteuer' };

interface ExercisePickerPageProps {
  params: Promise<{ childId: string }>;
}

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  word_reading: 'Wortübung',
  spelling_gap_fill: 'Lückentext',
  letter_order: 'Buchstaben ordnen',
  syllable_build: 'Wort aus Silben',
  dictation: 'Diktat',
};

export default async function ExercisePickerPage({ params }: ExercisePickerPageProps) {
  const { childId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const exercises = await db.exercise.findMany({
    orderBy: [{ type: 'asc' }, { difficultyLevel: 'asc' }],
    select: {
      id: true,
      type: true,
      title: true,
      difficultyLevel: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">
          Übungen für {childProfile.displayName}
        </h1>
        <p className="mt-1 text-lg text-amber-800">Wähle eine Übung zum Üben aus.</p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exercises.map((exercise) => (
          <li key={exercise.id}>
            <Link
              href={`/uebungen/${childId}/${exercise.id}`}
              className="flex h-full flex-col gap-2 rounded-xl border-2 border-amber-200 bg-white p-5 shadow-sm hover:border-amber-400"
            >
              <span className="text-lg font-bold text-stone-900">{exercise.title}</span>
              <span className="text-sm text-stone-600">
                {EXERCISE_TYPE_LABELS[exercise.type] ?? exercise.type} · {exercise._count.items}{' '}
                Aufgaben
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/dashboard" className="text-sm text-amber-800 underline">
        Zurück zum Elternbereich
      </Link>
    </div>
  );
}
