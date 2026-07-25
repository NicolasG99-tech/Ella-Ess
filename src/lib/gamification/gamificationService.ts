import { db } from '@/lib/server/db';
import { MAX_ATTEMPTS } from '@/lib/exercises/constants';
import { countDistinctPracticeDays, reachesMilestone } from '@/lib/gamification/milestones';
import type { RewardSourceType, RewardType } from '@/generated/prisma/enums';

// Orchestrierungsschicht der Belohnungsvergabe, getrennt von den reinen
// Meilenstein-Funktionen (milestones.ts) und von den aufrufenden Services
// (readingSessionService.ts, exerciseService.ts) — siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Gamification ohne Dark Patterns".

const REGULAR_PRACTICE_DAYS_THRESHOLD = 3;
const FIRST_STORY_THRESHOLD = 1;
const FIVE_STORIES_THRESHOLD = 5;
const FIRST_EXERCISE_THRESHOLD = 1;
const TEN_EXERCISES_THRESHOLD = 10;

export interface GrantedReward {
  code: string;
  type: RewardType;
  name: string;
  description: string;
  xpValue: number;
}

async function grantRepeatable(
  childProfileId: string,
  rewardCode: string,
  sourceType: RewardSourceType,
  readingSessionId?: string,
): Promise<GrantedReward> {
  const reward = await db.reward.findUniqueOrThrow({ where: { code: rewardCode } });
  await db.earnedReward.create({
    data: { childProfileId, rewardId: reward.id, sourceType, readingSessionId },
  });
  return {
    code: reward.code,
    type: reward.type,
    name: reward.name,
    description: reward.description,
    xpValue: reward.xpValue,
  };
}

// Vergibt eine Belohnung genau einmal pro Kind (Meilenstein-Abzeichen) — prüft
// vor dem Anlegen, ob bereits ein EarnedReward für diesen Code existiert.
async function grantIfNotYetEarned(
  childProfileId: string,
  rewardCode: string,
  sourceType: RewardSourceType,
  readingSessionId?: string,
): Promise<GrantedReward | null> {
  const reward = await db.reward.findUniqueOrThrow({ where: { code: rewardCode } });
  const existing = await db.earnedReward.findFirst({
    where: { childProfileId, rewardId: reward.id },
  });
  if (existing) return null;

  await db.earnedReward.create({
    data: { childProfileId, rewardId: reward.id, sourceType, readingSessionId },
  });
  return {
    code: reward.code,
    type: reward.type,
    name: reward.name,
    description: reward.description,
    xpValue: reward.xpValue,
  };
}

async function checkRegularPracticeBadge(
  childProfileId: string,
  sourceType: RewardSourceType,
): Promise<GrantedReward | null> {
  const [sessions, attempts] = await Promise.all([
    db.readingSession.findMany({
      where: { childProfileId, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    db.spellingAttempt.findMany({
      where: {
        childProfileId,
        OR: [{ isCorrect: true }, { attemptNumber: { gte: MAX_ATTEMPTS } }],
      },
      select: { createdAt: true },
    }),
  ]);

  const practiceDates = [
    ...sessions.map((session) => session.completedAt as Date),
    ...attempts.map((attempt) => attempt.createdAt),
  ];

  if (
    !reachesMilestone(countDistinctPracticeDays(practiceDates), REGULAR_PRACTICE_DAYS_THRESHOLD)
  ) {
    return null;
  }
  return grantIfNotYetEarned(childProfileId, 'badge_regular_practice', sourceType);
}

export async function awardRewardsForCompletedReadingSession(
  childProfileId: string,
  readingSessionId: string,
): Promise<GrantedReward[]> {
  const rewards: (GrantedReward | null)[] = [
    await grantRepeatable(
      childProfileId,
      'star_reading_session',
      'reading_session',
      readingSessionId,
    ),
  ];

  const completedSessionCount = await db.readingSession.count({
    where: { childProfileId, status: 'completed' },
  });

  if (reachesMilestone(completedSessionCount, FIRST_STORY_THRESHOLD)) {
    rewards.push(
      await grantIfNotYetEarned(
        childProfileId,
        'badge_first_story',
        'reading_session',
        readingSessionId,
      ),
    );
  }
  if (reachesMilestone(completedSessionCount, FIVE_STORIES_THRESHOLD)) {
    rewards.push(
      await grantIfNotYetEarned(
        childProfileId,
        'badge_five_stories',
        'reading_session',
        readingSessionId,
      ),
    );
  }
  rewards.push(await checkRegularPracticeBadge(childProfileId, 'reading_session'));

  return rewards.filter((reward): reward is GrantedReward => reward !== null);
}

export async function awardRewardsForCompletedExercise(
  childProfileId: string,
): Promise<GrantedReward[]> {
  const rewards: (GrantedReward | null)[] = [
    await grantRepeatable(childProfileId, 'star_exercise', 'exercise'),
  ];

  const completedExerciseCount = await db.spellingAttempt.count({
    where: {
      childProfileId,
      OR: [{ isCorrect: true }, { attemptNumber: { gte: MAX_ATTEMPTS } }],
    },
  });

  if (reachesMilestone(completedExerciseCount, FIRST_EXERCISE_THRESHOLD)) {
    rewards.push(await grantIfNotYetEarned(childProfileId, 'badge_first_exercise', 'exercise'));
  }
  if (reachesMilestone(completedExerciseCount, TEN_EXERCISES_THRESHOLD)) {
    rewards.push(await grantIfNotYetEarned(childProfileId, 'badge_ten_exercises', 'exercise'));
  }
  rewards.push(await checkRegularPracticeBadge(childProfileId, 'exercise'));

  return rewards.filter((reward): reward is GrantedReward => reward !== null);
}

export interface RewardsOverview {
  totalXp: number;
  starCount: number;
  badges: { code: string; name: string; description: string; earnedAt: Date }[];
}

// Für die Belohnungsübersicht (`/belohnungen/[childId]`): aggregiert alle
// bisher verdienten Belohnungen. Keine Rangliste, kein Vergleich mit anderen
// Kindern — ausschließlich der eigene Verlauf.
export async function getRewardsOverview(childProfileId: string): Promise<RewardsOverview> {
  const earned = await db.earnedReward.findMany({
    where: { childProfileId },
    include: { reward: true },
    orderBy: { earnedAt: 'asc' },
  });

  const totalXp = earned.reduce((sum, entry) => sum + entry.reward.xpValue, 0);
  const starCount = earned.filter((entry) => entry.reward.type === 'star').length;
  const badges = earned
    .filter((entry) => entry.reward.type === 'xp_badge')
    .map((entry) => ({
      code: entry.reward.code,
      name: entry.reward.name,
      description: entry.reward.description,
      earnedAt: entry.earnedAt,
    }));

  return { totalXp, starCount, badges };
}
