import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { db } from '@/lib/server/db';

export const metadata: Metadata = { title: 'Geschichte wählen — Lese-Abenteuer' };

interface StoryPickerPageProps {
  params: Promise<{ childId: string }>;
}

export default async function StoryPickerPage({ params }: StoryPickerPageProps) {
  const { childId } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const stories = await db.story.findMany({
    where: { isPublished: true },
    orderBy: { difficultyLevel: 'asc' },
    select: {
      slug: true,
      title: true,
      description: true,
      difficultyLevel: true,
      ageRange: true,
      illustrationLayers: {
        where: { name: 'background' },
        select: { assetKey: true },
        take: 1,
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-amber-900">Hallo {childProfile.displayName}!</h1>
        <p className="mt-1 text-lg text-amber-800">Welche Geschichte möchtest du heute lesen?</p>
      </div>

      {stories.length === 0 ? (
        <p className="text-amber-800">Es gibt gerade noch keine Geschichten.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <li key={story.slug}>
              <Link
                href={`/lesen/${childId}/${story.slug}`}
                className="flex h-full flex-col gap-2 overflow-hidden rounded-xl border-2 border-amber-200 bg-white shadow-sm hover:border-amber-400"
              >
                {story.illustrationLayers[0] && (
                  <div className="relative aspect-[16/9] w-full bg-amber-100">
                    <Image
                      src={story.illustrationLayers[0].assetKey}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <span className="text-xl font-bold text-stone-900">{story.title}</span>
                  <span className="text-sm text-stone-600">{story.description}</span>
                  <span className="mt-auto text-xs font-medium text-amber-700">
                    Für {story.ageRange} Jahre
                  </span>
                </div>
              </Link>
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
