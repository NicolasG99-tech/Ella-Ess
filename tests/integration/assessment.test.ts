import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { getChildAssessment } from '@/lib/progress/assessmentService';

// Integrationstest für den generischen Assessment-Bogen (Fachkräfte &
// Lehrkräfte) — prüft die DB-Orchestrierung; die reine Aggregationslogik ist
// in tests/unit/assessment-calculations.test.ts getrennt getestet.
describe('Assessment-Bogen (assessmentService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let storyId: string;
  let readingBasicsSkillId: string;
  let flunecySkillId: string;
  let wordReadingExerciseItemId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-assessment-parent-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const story = await db.story.findUniqueOrThrow({
      where: { slug: 'pieks-sucht-ein-zuhause' },
    });
    storyId = story.id;

    const readingBasics = await db.literacySkill.findFirstOrThrow({
      where: { learningProfile: { code: 'reading_basics' } },
    });
    readingBasicsSkillId = readingBasics.id;

    const fluency = await db.literacySkill.findFirstOrThrow({
      where: { learningProfile: { code: 'fluency' } },
    });
    flunecySkillId = fluency.id;

    const exercise = await db.exercise.findFirstOrThrow({ where: { type: 'word_reading' } });
    const item = await db.exerciseItem.findFirstOrThrow({ where: { exerciseId: exercise.id } });
    wordReadingExerciseItemId = item.id;
  });

  afterAll(async () => {
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
    const assessment = await getChildAssessment(childProfileId);

    expect(assessment.completedSessionCount).toBe(0);
    expect(assessment.firstActivityAt).toBeNull();
    expect(assessment.lastActivityAt).toBeNull();
    expect(assessment.skills).toEqual([]);
    expect(assessment.wordErrorBreakdown).toEqual([]);
  });

  it('sortiert Fähigkeitsbereiche nach Übungsbedarf (geringster Beherrschungsgrad zuerst)', async () => {
    await db.skillProgress.create({
      data: { childProfileId, literacySkillId: readingBasicsSkillId, masteryLevel: 0.9 },
    });
    await db.skillProgress.create({
      data: { childProfileId, literacySkillId: flunecySkillId, masteryLevel: 0.2 },
    });

    const assessment = await getChildAssessment(childProfileId);

    expect(assessment.skills).toHaveLength(2);
    expect(assessment.skills[0].masteryLevel).toBeLessThan(assessment.skills[1].masteryLevel);
  });

  it('gruppiert Worteinordnungen über alle Lesesitzungen hinweg', async () => {
    const session = await db.readingSession.create({
      data: { childProfileId, storyId, status: 'completed', completedAt: new Date() },
    });
    const attempt = await db.readingAttempt.create({
      data: {
        readingSessionId: session.id,
        sectionOrder: 0,
        attemptNumber: 1,
        state: 'correct',
        positionConfidence: 0.9,
      },
    });
    await db.wordEvaluation.createMany({
      data: [
        {
          readingAttemptId: attempt.id,
          wordIndex: 0,
          expectedWord: 'Igel',
          recognizedWord: 'Igel',
          confidence: 0.9,
          state: 'correct',
        },
        {
          readingAttemptId: attempt.id,
          wordIndex: 1,
          expectedWord: 'Wald',
          recognizedWord: 'Wald',
          confidence: 0.9,
          state: 'correct',
        },
        {
          readingAttemptId: attempt.id,
          wordIndex: 2,
          expectedWord: 'Baum',
          recognizedWord: 'Baun',
          confidence: 0.6,
          state: 'possible_error',
        },
      ],
    });

    const assessment = await getChildAssessment(childProfileId);

    const correctEntry = assessment.wordErrorBreakdown.find((entry) => entry.state === 'correct');
    const errorEntry = assessment.wordErrorBreakdown.find(
      (entry) => entry.state === 'possible_error',
    );
    expect(correctEntry?.count).toBe(2);
    expect(errorEntry?.count).toBe(1);
    expect(assessment.firstActivityAt).not.toBeNull();
    expect(assessment.lastActivityAt).not.toBeNull();
  });

  it('fasst Rechtschreibgenauigkeit nach Aufgabentyp zusammen', async () => {
    await db.spellingAttempt.create({
      data: {
        childProfileId,
        exerciseItemId: wordReadingExerciseItemId,
        attemptNumber: 1,
        submittedAnswer: 'richtig',
        isCorrect: true,
      },
    });

    const assessment = await getChildAssessment(childProfileId);

    const wordReadingEntry = assessment.exerciseAccuracyByType.find(
      (entry) => entry.exerciseType === 'word_reading',
    );
    expect(wordReadingEntry?.completedCount).toBe(1);
    expect(wordReadingEntry?.correctFirstTryCount).toBe(1);
  });
});
