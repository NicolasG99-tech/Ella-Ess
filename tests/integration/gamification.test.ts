import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import {
  awardRewardsForCompletedExercise,
  awardRewardsForCompletedReadingSession,
  getRewardsOverview,
} from '@/lib/gamification/gamificationService';

describe('Gamification (gamificationService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let storyId: string;
  let gapFillItemId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-gamification-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const story = await db.story.findUniqueOrThrow({ where: { slug: 'pieks-sucht-ein-zuhause' } });
    storyId = story.id;

    const gapFillExercise = await db.exercise.findFirstOrThrow({
      where: { type: 'spelling_gap_fill' },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    gapFillItemId = gapFillExercise.items[0].id;
  });

  afterAll(async () => {
    await db.earnedReward.deleteMany({ where: { childProfile: { parentId } } });
    await db.spellingAttempt.deleteMany({ where: { childProfile: { parentId } } });
    await db.readingSession.deleteMany({ where: { childProfile: { parentId } } });
    await db.childProfile.deleteMany({ where: { parentId } });
    await db.user.deleteMany({ where: { id: parentId } });
  });

  beforeEach(async () => {
    const child = await db.childProfile.create({
      data: {
        parentId,
        displayName: `IT-Kind-${Math.random().toString(36).slice(2)}`,
        birthYear: 2017,
      },
    });
    childProfileId = child.id;
  });

  async function createCompletedSession() {
    return db.readingSession.create({
      data: { childProfileId, storyId, status: 'completed', completedAt: new Date() },
    });
  }

  it('vergibt einen Lesestern und das Erste-Geschichte-Abzeichen bei der ersten abgeschlossenen Sitzung', async () => {
    const session = await createCompletedSession();
    const rewards = await awardRewardsForCompletedReadingSession(childProfileId, session.id);
    const codes = rewards.map((reward) => reward.code);

    expect(codes).toContain('star_reading_session');
    expect(codes).toContain('badge_first_story');
  });

  it('vergibt das Bücherwurm-Abzeichen erst bei der 5. Geschichte und danach nicht erneut', async () => {
    for (let i = 0; i < 4; i += 1) {
      const session = await createCompletedSession();
      const rewards = await awardRewardsForCompletedReadingSession(childProfileId, session.id);
      expect(rewards.some((reward) => reward.code === 'badge_five_stories')).toBe(false);
    }

    const fifthSession = await createCompletedSession();
    const rewardsAtFive = await awardRewardsForCompletedReadingSession(
      childProfileId,
      fifthSession.id,
    );
    expect(rewardsAtFive.some((reward) => reward.code === 'badge_five_stories')).toBe(true);

    const sixthSession = await createCompletedSession();
    const rewardsAtSix = await awardRewardsForCompletedReadingSession(
      childProfileId,
      sixthSession.id,
    );
    expect(rewardsAtSix.some((reward) => reward.code === 'badge_five_stories')).toBe(false);
  });

  it('vergibt das Übungsprofi-Abzeichen erst bei der 10. abgeschlossenen Übung', async () => {
    for (let i = 0; i < 9; i += 1) {
      await db.spellingAttempt.create({
        data: {
          childProfileId,
          exerciseItemId: gapFillItemId,
          attemptNumber: 1,
          submittedAnswer: 'x',
          isCorrect: true,
        },
      });
      const rewards = await awardRewardsForCompletedExercise(childProfileId);
      expect(rewards.some((reward) => reward.code === 'badge_ten_exercises')).toBe(false);
    }

    await db.spellingAttempt.create({
      data: {
        childProfileId,
        exerciseItemId: gapFillItemId,
        attemptNumber: 1,
        submittedAnswer: 'x',
        isCorrect: true,
      },
    });
    const rewardsAtTen = await awardRewardsForCompletedExercise(childProfileId);
    expect(rewardsAtTen.some((reward) => reward.code === 'badge_ten_exercises')).toBe(true);
  });

  it('vergibt "Regelmäßig dabei" erst nach Übungen an 3 verschiedenen Tagen', async () => {
    const days = [
      '2026-07-01T08:00:00.000Z',
      '2026-07-02T08:00:00.000Z',
      '2026-07-03T08:00:00.000Z',
    ];

    for (let i = 0; i < days.length; i += 1) {
      await db.spellingAttempt.create({
        data: {
          childProfileId,
          exerciseItemId: gapFillItemId,
          attemptNumber: 1,
          submittedAnswer: 'x',
          isCorrect: true,
          createdAt: new Date(days[i]),
        },
      });
      const rewards = await awardRewardsForCompletedExercise(childProfileId);
      const hasRegularPracticeBadge = rewards.some(
        (reward) => reward.code === 'badge_regular_practice',
      );
      if (i < days.length - 1) {
        expect(hasRegularPracticeBadge).toBe(false);
      } else {
        expect(hasRegularPracticeBadge).toBe(true);
      }
    }
  });

  it('getRewardsOverview aggregiert Sterne, Abzeichen und Gesamt-XP', async () => {
    const session = await createCompletedSession();
    await awardRewardsForCompletedReadingSession(childProfileId, session.id);

    const overview = await getRewardsOverview(childProfileId);

    expect(overview.starCount).toBe(1);
    expect(overview.badges.map((badge) => badge.code)).toContain('badge_first_story');
    expect(overview.totalXp).toBeGreaterThan(0);
  });
});
