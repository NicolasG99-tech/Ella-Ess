import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { getChildProgressOverview } from '@/lib/progress/parentDashboardService';

describe('Eltern-Dashboard (parentDashboardService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let storyId: string;
  let storyTitle: string;
  let multipleChoiceQuestionId: string;
  let readingBasicsSkillId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-parent-dashboard-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const story = await db.story.findUniqueOrThrow({
      where: { slug: 'pieks-sucht-ein-zuhause' },
      include: { comprehensionQuestions: { orderBy: { order: 'asc' } } },
    });
    storyId = story.id;
    storyTitle = story.title;
    multipleChoiceQuestionId = story.comprehensionQuestions[0].id;

    const skill = await db.literacySkill.findFirstOrThrow({
      where: { learningProfile: { code: 'reading_basics' } },
    });
    readingBasicsSkillId = skill.id;
  });

  afterAll(async () => {
    await db.comprehensionAttempt.deleteMany({ where: { readingSession: { childProfileId } } });
    await db.skillProgress.deleteMany({ where: { childProfileId } });
    await db.readingSession.deleteMany({ where: { childProfileId } });
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

  it('liefert leere Werte für ein Kind ohne jegliche Aktivität', async () => {
    const overview = await getChildProgressOverview(childProfileId);

    expect(overview.completedSessionCount).toBe(0);
    expect(overview.completedExerciseCount).toBe(0);
    expect(overview.distinctPracticeDays).toBe(0);
    expect(overview.masteryGroups).toEqual([]);
    expect(overview.recentSessions).toEqual([]);
    expect(overview.comprehensionFirstTryTotal).toBe(0);
  });

  it('zählt abgeschlossene Geschichten und zeigt sie in "Zuletzt gelesen"', async () => {
    await db.readingSession.create({
      data: { childProfileId, storyId, status: 'completed', completedAt: new Date() },
    });

    const overview = await getChildProgressOverview(childProfileId);

    expect(overview.completedSessionCount).toBe(1);
    expect(overview.recentSessions).toHaveLength(1);
    expect(overview.recentSessions[0].storyTitle).toBe(storyTitle);
    expect(overview.recentSessions[0].sectionCount).toBeGreaterThan(0);
  });

  it('gruppiert Fähigkeiten nach Lernprofil und übersetzt den Beherrschungsgrad', async () => {
    await db.skillProgress.create({
      data: { childProfileId, literacySkillId: readingBasicsSkillId, masteryLevel: 0.8 },
    });

    const overview = await getChildProgressOverview(childProfileId);

    expect(overview.masteryGroups).toHaveLength(1);
    expect(overview.masteryGroups[0].learningProfileName).toBe('Lesegrundlagen');
    expect(overview.masteryGroups[0].skills[0].label).toBe('Sicher');
  });

  it('zählt nur den ersten Versuch bei Verständnisfragen für die Trefferquote', async () => {
    const session = await db.readingSession.create({
      data: { childProfileId, storyId, status: 'completed', completedAt: new Date() },
    });
    await db.comprehensionAttempt.create({
      data: {
        readingSessionId: session.id,
        comprehensionQuestionId: multipleChoiceQuestionId,
        attemptNumber: 1,
        submittedAnswer: 'Ein Igel',
        isCorrect: true,
      },
    });

    const overview = await getChildProgressOverview(childProfileId);

    expect(overview.comprehensionFirstTryTotal).toBe(1);
    expect(overview.comprehensionFirstTryCorrect).toBe(1);
  });
});
