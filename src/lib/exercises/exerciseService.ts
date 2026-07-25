import { db } from '@/lib/server/db';
import { evaluateSpellingAnswer } from '@/lib/exercises/evaluateSpellingAnswer';
import { attemptOutcomeFrom, computeUpdatedMastery } from '@/lib/progress/masteryCalculation';
import { MAX_ATTEMPTS } from '@/lib/exercises/constants';
import {
  awardRewardsForCompletedExercise,
  type GrantedReward,
} from '@/lib/gamification/gamificationService';

async function updateSkillProgressForProfile(
  childProfileId: string,
  learningProfileId: string | null,
  isCorrect: boolean,
  attemptNumber: number,
) {
  if (!learningProfileId) return;

  const outcome = attemptOutcomeFrom(isCorrect, attemptNumber);
  const skills = await db.literacySkill.findMany({ where: { learningProfileId } });

  for (const skill of skills) {
    const existing = await db.skillProgress.findUnique({
      where: { childProfileId_literacySkillId: { childProfileId, literacySkillId: skill.id } },
    });
    const updatedMastery = computeUpdatedMastery(existing?.masteryLevel ?? 0, outcome);

    await db.skillProgress.upsert({
      where: { childProfileId_literacySkillId: { childProfileId, literacySkillId: skill.id } },
      update: { masteryLevel: updatedMastery, lastPracticedAt: new Date() },
      create: {
        childProfileId,
        literacySkillId: skill.id,
        masteryLevel: updatedMastery,
        lastPracticedAt: new Date(),
      },
    });
  }
}

export interface SubmitSpellingAttemptParams {
  childProfileId: string;
  exerciseItemId: string;
  submittedAnswer: string;
}

export async function submitSpellingAttempt(params: SubmitSpellingAttemptParams) {
  const item = await db.exerciseItem.findUniqueOrThrow({
    where: { id: params.exerciseItemId },
    include: { exercise: true },
  });

  const previousAttempts = await db.spellingAttempt.count({
    where: { childProfileId: params.childProfileId, exerciseItemId: params.exerciseItemId },
  });
  const attemptNumber = previousAttempts + 1;
  const acceptedVariants = (item.acceptedVariants as unknown as string[] | null) ?? [];
  const isCorrect = evaluateSpellingAnswer(params.submittedAnswer, item.solution, acceptedVariants);

  await db.spellingAttempt.create({
    data: {
      childProfileId: params.childProfileId,
      exerciseItemId: params.exerciseItemId,
      attemptNumber,
      submittedAnswer: params.submittedAnswer,
      isCorrect,
    },
  });

  const canRetry = !isCorrect && attemptNumber < MAX_ATTEMPTS;
  let newlyEarnedRewards: GrantedReward[] = [];

  if (!canRetry) {
    await updateSkillProgressForProfile(
      params.childProfileId,
      item.exercise.learningProfileId,
      isCorrect,
      attemptNumber,
    );
    newlyEarnedRewards = await awardRewardsForCompletedExercise(params.childProfileId);
  }

  return {
    isCorrect,
    attemptNumber,
    canRetry,
    solution: !canRetry ? item.solution : null,
    newlyEarnedRewards,
  };
}

// Wortübungen (word_reading) haben keine getippte Antwort — das Kind meldet
// selbst, dass es das Wort gelesen hat (kein Mikrofon nötig, siehe
// docs/ARCHITECTURE.md zur Sandbox-Einschränkung bei Audioaufnahmen).
export async function markWordReadingComplete(
  childProfileId: string,
  exerciseItemId: string,
): Promise<{ newlyEarnedRewards: GrantedReward[] }> {
  const item = await db.exerciseItem.findUniqueOrThrow({
    where: { id: exerciseItemId },
    include: { exercise: true },
  });

  await db.spellingAttempt.create({
    data: {
      childProfileId,
      exerciseItemId,
      attemptNumber: 1,
      submittedAnswer: item.solution,
      isCorrect: true,
    },
  });

  await updateSkillProgressForProfile(childProfileId, item.exercise.learningProfileId, true, 1);
  const newlyEarnedRewards = await awardRewardsForCompletedExercise(childProfileId);
  return { newlyEarnedRewards };
}
