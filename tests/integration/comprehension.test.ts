import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { submitComprehensionAnswer } from '@/lib/comprehension/comprehensionService';

describe('Verständnisfragen (comprehensionService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let readingSessionId: string;
  let multipleChoiceQuestionId: string;
  let statementQuestionId: string;
  let orderingQuestionId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-comprehension-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const pieksStory = await db.story.findFirstOrThrow({
      where: { slug: 'pieks-sucht-ein-zuhause' },
      include: { comprehensionQuestions: { orderBy: { order: 'asc' } } },
    });
    multipleChoiceQuestionId = pieksStory.comprehensionQuestions[0].id;
    statementQuestionId = pieksStory.comprehensionQuestions[1].id;

    const miaStory = await db.story.findFirstOrThrow({
      where: { slug: 'mia-und-der-verlorene-schluessel' },
      include: { comprehensionQuestions: { orderBy: { order: 'asc' } } },
    });
    orderingQuestionId = miaStory.comprehensionQuestions[1].id;
  });

  afterAll(async () => {
    await db.comprehensionAttempt.deleteMany({
      where: { readingSession: { childProfileId } },
    });
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

    const story = await db.story.findUniqueOrThrow({ where: { slug: 'pieks-sucht-ein-zuhause' } });
    const session = await db.readingSession.create({
      data: { childProfileId, storyId: story.id, status: 'completed', currentSectionOrder: 0 },
    });
    readingSessionId = session.id;
  });

  it('bewertet eine richtige Multiple-Choice-Antwort beim ersten Versuch als korrekt', async () => {
    const result = await submitComprehensionAnswer({
      readingSessionId,
      questionId: multipleChoiceQuestionId,
      submittedAnswer: 'Ein Igel',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.canRetry).toBe(false);
    expect(result.hintText).toBeNull();
  });

  it('bietet bei einer falschen Antwort eine Textstelle als Hilfe und einen zweiten Versuch an', async () => {
    const first = await submitComprehensionAnswer({
      readingSessionId,
      questionId: statementQuestionId,
      submittedAnswer: true, // richtig wäre false
    });

    expect(first.isCorrect).toBe(false);
    expect(first.canRetry).toBe(true);
    expect(first.hintText).toBeTruthy();
    expect(first.correctAnswer).toBeNull();
  });

  it('erlaubt maximal zwei Versuche und deckt danach die richtige Antwort auf', async () => {
    await submitComprehensionAnswer({
      readingSessionId,
      questionId: statementQuestionId,
      submittedAnswer: true,
    });
    const second = await submitComprehensionAnswer({
      readingSessionId,
      questionId: statementQuestionId,
      submittedAnswer: true,
    });

    expect(second.isCorrect).toBe(false);
    expect(second.canRetry).toBe(false);
    expect(second.correctAnswer).toBe(false);

    const attempts = await db.comprehensionAttempt.count({
      where: { readingSessionId, comprehensionQuestionId: statementQuestionId },
    });
    expect(attempts).toBe(2);
  });

  it('bewertet ordering-Antworten anhand der exakten Reihenfolge', async () => {
    const wrongOrder = await submitComprehensionAnswer({
      readingSessionId,
      questionId: orderingQuestionId,
      submittedAnswer: ['Mia findet Minka im Garten', 'Mia sucht den Schlüssel in ihrer Tasche'],
    });
    expect(wrongOrder.isCorrect).toBe(false);

    const correctOrder = await submitComprehensionAnswer({
      readingSessionId,
      questionId: orderingQuestionId,
      submittedAnswer: [
        'Mia sucht den Schlüssel in ihrer Tasche',
        'Mia findet Minka im Garten',
        'Mia schließt die Tür auf',
      ],
    });
    expect(correctOrder.isCorrect).toBe(true);
  });

  it('speichert jeden Versuch als ComprehensionAttempt', async () => {
    await submitComprehensionAnswer({
      readingSessionId,
      questionId: multipleChoiceQuestionId,
      submittedAnswer: 'Ein Igel',
    });

    const attempts = await db.comprehensionAttempt.findMany({ where: { readingSessionId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].isCorrect).toBe(true);
  });
});
