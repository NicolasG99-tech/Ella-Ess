import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnChildProfile } from '@/lib/server/authz';
import { db } from '@/lib/server/db';
import { getPitchShiftRate, isMockSpeechProviderActive } from '@/lib/providers/speech';
import { ReadingView } from '@/features/reading/ReadingView';

export const metadata: Metadata = { title: 'Lesen — Lese-Abenteuer' };

interface ReadingPageProps {
  params: Promise<{ childId: string; storySlug: string }>;
}

interface ExpectedWordJson {
  index: number;
  word: string;
  acceptedVariants: string[];
}

export default async function ReadingPage({ params }: ReadingPageProps) {
  const { childId, storySlug } = await params;

  let childProfile;
  try {
    ({ childProfile } = await requireOwnChildProfile(childId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const story = await db.story.findUnique({
    where: { slug: storySlug },
    include: {
      sections: { orderBy: { order: 'asc' } },
      illustrationLayers: { orderBy: { renderOrder: 'asc' } },
      comprehensionQuestions: { orderBy: { order: 'asc' } },
    },
  });

  if (!story || !story.isPublished) {
    notFound();
  }

  return (
    <ReadingView
      childProfileId={childProfile.id}
      story={{
        slug: story.slug,
        title: story.title,
        sections: story.sections.map((section) => ({
          order: section.order,
          text: section.text,
          words: (section.expectedWords as unknown as ExpectedWordJson[]).map(
            (entry) => entry.word,
          ),
        })),
        totalIllustrationLayers: story.illustrationLayers.length,
        comprehensionQuestions: story.comprehensionQuestions.map((question) => ({
          id: question.id,
          order: question.order,
          type: question.type,
          prompt: question.prompt,
          options: (question.options as unknown as string[] | null) ?? null,
        })),
      }}
      childSettings={{
        fontScale: childProfile.fontScale,
        lineSpacingScale: childProfile.lineSpacingScale,
        reducedMotion: childProfile.reducedMotion,
        audioHintsEnabled: childProfile.audioHintsEnabled,
      }}
      isMockProvider={isMockSpeechProviderActive()}
      pitchShiftRate={getPitchShiftRate()}
      backHref={`/lesen/${childId}`}
    />
  );
}
