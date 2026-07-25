import { db } from '@/lib/server/db';
import { logAuditEvent } from '@/lib/server/audit';
import { getSpeechRecognitionProvider } from '@/lib/providers/speech';
import { computeSessionStep, resolveHelpOffered } from '@/lib/reading/sessionStateMachine';
import {
  getUnlockedIllustrations,
  unlockIllustrationsForCompletedSection,
  unlockIllustrationsForWordCheckpoint,
  type UnlockedIllustrationInfo,
} from '@/lib/reading/illustrationUnlockService';
import {
  awardRewardsForCompletedReadingSession,
  type GrantedReward,
} from '@/lib/gamification/gamificationService';
import type { MockScenario, RecognizedWord } from '@/lib/providers/speech/types';

// Orchestrierungslogik der Lesesitzung, getrennt von der Server-Action-Hülle
// (`features/reading/actions.ts`), damit sie ohne Next.js-Request-Kontext
// (auth()/cookies()) direkt integrationstestbar ist. Die Autorisierung
// (requireOwnChildProfile) erfolgt ausschließlich in den Server Actions,
// bevor diese Funktionen mit einer bereits geprüften childProfileId
// aufgerufen werden.

interface ExpectedWordJson {
  index: number;
  word: string;
  acceptedVariants: string[];
}

function wordsOf(expectedWords: unknown): string[] {
  return (expectedWords as ExpectedWordJson[]).map((entry) => entry.word);
}

export async function startOrResumeReadingSession(
  childProfileId: string,
  storySlug: string,
  actorUserId: string,
) {
  const story = await db.story.findUniqueOrThrow({
    where: { slug: storySlug },
    include: { sections: { orderBy: { order: 'asc' } } },
  });

  let session = await db.readingSession.findFirst({
    where: { childProfileId, storyId: story.id, status: 'active' },
    orderBy: { startedAt: 'desc' },
  });

  if (!session) {
    session = await db.readingSession.create({
      data: { childProfileId, storyId: story.id, status: 'active', currentSectionOrder: 0 },
    });
    await logAuditEvent({
      actorUserId,
      action: 'reading_session.start',
      targetType: 'ReadingSession',
      targetId: session.id,
      metadata: { storySlug },
    });
  }

  const unlockedIllustrations = await getUnlockedIllustrations(session.id);

  return {
    sessionId: session.id,
    currentSectionOrder: session.currentSectionOrder,
    status: session.status,
    story: {
      id: story.id,
      slug: story.slug,
      title: story.title,
      sections: story.sections.map((section) => ({
        order: section.order,
        text: section.text,
        words: wordsOf(section.expectedWords),
      })),
    },
    unlockedIllustrations,
  };
}

export interface SubmitReadingAttemptParams {
  sessionId: string;
  childProfileId: string;
  sectionOrder: number;
  localPosition: number;
  retryCount: number;
  /** Nur im Mock-Modus: erzwingt ein Testszenario statt zufälliger Simulation. */
  forcedScenario?: MockScenario;
  /** Nur bei echtem Provider gesetzt (siehe TranscribeAudioInput.audio). */
  audio?: Blob;
}

interface AdvanceSectionResult {
  sectionComplete: boolean;
  sessionComplete: boolean;
  newlyUnlockedIllustrations: UnlockedIllustrationInfo[];
  newlyEarnedRewards: GrantedReward[];
}

async function advanceSectionIfNeeded(
  sessionId: string,
  childProfileId: string,
  storyId: string,
  sectionOrder: number,
  reachedEndOfSection: boolean,
): Promise<AdvanceSectionResult> {
  if (!reachedEndOfSection) {
    return {
      sectionComplete: false,
      sessionComplete: false,
      newlyUnlockedIllustrations: [],
      newlyEarnedRewards: [],
    };
  }

  const newlyUnlockedIllustrations = await unlockIllustrationsForCompletedSection(
    sessionId,
    storyId,
    sectionOrder,
  );

  const nextSection = await db.storySection.findFirst({
    where: { storyId, order: sectionOrder + 1 },
  });

  if (nextSection) {
    await db.readingSession.update({
      where: { id: sessionId },
      data: { currentSectionOrder: nextSection.order },
    });
    return {
      sectionComplete: true,
      sessionComplete: false,
      newlyUnlockedIllustrations,
      newlyEarnedRewards: [],
    };
  }

  await db.readingSession.update({
    where: { id: sessionId },
    data: { status: 'completed', completedAt: new Date() },
  });
  const newlyEarnedRewards = await awardRewardsForCompletedReadingSession(
    childProfileId,
    sessionId,
  );
  return {
    sectionComplete: true,
    sessionComplete: true,
    newlyUnlockedIllustrations,
    newlyEarnedRewards,
  };
}

export async function submitReadingAttempt(input: SubmitReadingAttemptParams) {
  const session = await db.readingSession.findFirstOrThrow({
    where: { id: input.sessionId, childProfileId: input.childProfileId },
  });
  const section = await db.storySection.findFirstOrThrow({
    where: { storyId: session.storyId, order: input.sectionOrder },
  });

  const sectionWords = wordsOf(section.expectedWords);
  const remainingWords = sectionWords.slice(input.localPosition);

  const provider = getSpeechRecognitionProvider();
  const transcription = await provider.transcribeAudio({
    targetWords: remainingWords,
    forcedScenario: input.forcedScenario,
    audio: input.audio,
  });

  const recognizedWords: RecognizedWord[] = transcription.recognizedWords;
  const alignment = provider.alignToTargetText(recognizedWords, sectionWords, input.localPosition);
  const evaluation = provider.evaluateReadingAttempt({
    alignment,
    retryCount: input.retryCount,
    providerAvailable: transcription.available,
  });
  const sessionStep = computeSessionStep({
    evaluationState: evaluation.state,
    retryCount: input.retryCount,
  });

  const attempt = await db.readingAttempt.create({
    data: {
      readingSessionId: session.id,
      sectionOrder: input.sectionOrder,
      attemptNumber: input.retryCount + 1,
      state: evaluation.state,
      retryCount: input.retryCount,
      positionConfidence: alignment.confidence,
    },
  });

  const coveredIndices = Array.from(
    { length: Math.max(0, alignment.position - input.localPosition) },
    (_, i) => input.localPosition + i,
  );
  if (coveredIndices.length > 0) {
    const lastIndex = coveredIndices[coveredIndices.length - 1];
    await db.wordEvaluation.createMany({
      data: coveredIndices.map((wordIndex) => ({
        readingAttemptId: attempt.id,
        wordIndex,
        expectedWord: sectionWords[wordIndex],
        recognizedWord:
          alignment.flags.omission && wordIndex === lastIndex ? null : sectionWords[wordIndex],
        confidence: alignment.confidence,
        state: alignment.flags.omission && wordIndex === lastIndex ? 'skipped' : evaluation.state,
      })),
    });
  }

  const newLocalPosition = sessionStep.shouldAdvance ? alignment.position : input.localPosition;
  const {
    sectionComplete,
    sessionComplete,
    newlyUnlockedIllustrations: unlockedBySectionCompletion,
    newlyEarnedRewards,
  } = await advanceSectionIfNeeded(
    session.id,
    input.childProfileId,
    session.storyId,
    input.sectionOrder,
    sessionStep.shouldAdvance && newLocalPosition >= sectionWords.length,
  );

  // Wort-Checkpoints (siehe [[unlock:...]]-Marker, docs/ARCHITECTURE.md
  // "Illustrationsfreischaltung") innerhalb des aktuellen Abschnitts prüfen —
  // unabhängig davon, ob der Abschnitt in diesem Zug abgeschlossen wurde.
  // Idempotent, daher unproblematisch, wenn advanceSectionIfNeeded eine Ebene
  // bereits (weil der Abschnitt komplett ist) freigeschaltet hat.
  const unlockedByWordCheckpoint = await unlockIllustrationsForWordCheckpoint(
    session.id,
    session.storyId,
    input.sectionOrder,
    newLocalPosition,
  );
  const newlyUnlockedIllustrations = [...unlockedBySectionCompletion, ...unlockedByWordCheckpoint];

  return {
    evaluationState: evaluation.state,
    uiState: sessionStep.uiState,
    message: sessionStep.message,
    retryCount: sessionStep.retryCount,
    newLocalPosition,
    sectionWordCount: sectionWords.length,
    sectionComplete,
    sessionComplete,
    newlyUnlockedIllustrations,
    newlyEarnedRewards,
  };
}

export interface ResolveHelpParams {
  sessionId: string;
  childProfileId: string;
  sectionOrder: number;
  localPosition: number;
}

export async function resolveHelp(input: ResolveHelpParams) {
  const session = await db.readingSession.findFirstOrThrow({
    where: { id: input.sessionId, childProfileId: input.childProfileId },
  });
  const section = await db.storySection.findFirstOrThrow({
    where: { storyId: session.storyId, order: input.sectionOrder },
  });
  const sectionWords = wordsOf(section.expectedWords);

  const attempt = await db.readingAttempt.create({
    data: {
      readingSessionId: session.id,
      sectionOrder: input.sectionOrder,
      attemptNumber: 0,
      state: 'skipped',
      retryCount: 0,
      positionConfidence: 0,
    },
  });

  if (input.localPosition < sectionWords.length) {
    await db.wordEvaluation.create({
      data: {
        readingAttemptId: attempt.id,
        wordIndex: input.localPosition,
        expectedWord: sectionWords[input.localPosition],
        recognizedWord: null,
        confidence: 0,
        state: 'skipped',
      },
    });
  }

  const step = resolveHelpOffered();
  const newLocalPosition = input.localPosition + 1;
  const { sectionComplete, sessionComplete, newlyUnlockedIllustrations, newlyEarnedRewards } =
    await advanceSectionIfNeeded(
      session.id,
      input.childProfileId,
      session.storyId,
      input.sectionOrder,
      newLocalPosition >= sectionWords.length,
    );

  return {
    uiState: step.uiState,
    message: step.message,
    retryCount: step.retryCount,
    newLocalPosition,
    sectionWordCount: sectionWords.length,
    sectionComplete,
    sessionComplete,
    newlyUnlockedIllustrations,
    newlyEarnedRewards,
  };
}
