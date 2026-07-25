import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { markWordReadingComplete, submitSpellingAttempt } from '@/lib/exercises/exerciseService';

describe('Übungen (exerciseService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let gapFillItemId: string;
  let gapFillSolution: string;
  let spellingLearningProfileId: string;
  let wordReadingItemId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-exercises-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const gapFillExercise = await db.exercise.findFirstOrThrow({
      where: { type: 'spelling_gap_fill' },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    gapFillItemId = gapFillExercise.items[0].id;
    gapFillSolution = gapFillExercise.items[0].solution;
    spellingLearningProfileId = gapFillExercise.learningProfileId!;

    const wordReadingExercise = await db.exercise.findFirstOrThrow({
      where: { type: 'word_reading' },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    wordReadingItemId = wordReadingExercise.items[0].id;
  });

  afterAll(async () => {
    await db.spellingAttempt.deleteMany({ where: { childProfileId } });
    await db.skillProgress.deleteMany({ where: { childProfileId } });
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

  it('akzeptiert die richtige Lösung beim ersten Versuch', async () => {
    const result = await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: gapFillSolution,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.canRetry).toBe(false);
  });

  it('erlaubt einen zweiten Versuch nach einer falschen Antwort und deckt danach die Lösung auf', async () => {
    const first = await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: 'komplettFalsch',
    });
    expect(first.isCorrect).toBe(false);
    expect(first.canRetry).toBe(true);
    expect(first.solution).toBeNull();

    const second = await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: 'immerNochFalsch',
    });
    expect(second.isCorrect).toBe(false);
    expect(second.canRetry).toBe(false);
    expect(second.solution).toBe(gapFillSolution);

    const attempts = await db.spellingAttempt.count({
      where: { childProfileId, exerciseItemId: gapFillItemId },
    });
    expect(attempts).toBe(2);
  });

  it('aktualisiert den Beherrschungsgrad erst nach dem finalen Versuch, nicht bei einem noch wiederholbaren', async () => {
    await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: 'falsch',
    });

    const afterFirstAttempt = await db.skillProgress.findMany({ where: { childProfileId } });
    expect(afterFirstAttempt).toHaveLength(0);

    await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: gapFillSolution,
    });

    const afterSecondAttempt = await db.skillProgress.findMany({ where: { childProfileId } });
    expect(afterSecondAttempt.length).toBeGreaterThan(0);
    for (const progress of afterSecondAttempt) {
      expect(progress.masteryLevel).toBeGreaterThan(0);
    }
  });

  it('markiert eine Wortübung als gelesen und aktualisiert den Fortschritt', async () => {
    await markWordReadingComplete(childProfileId, wordReadingItemId);

    const attempt = await db.spellingAttempt.findFirst({
      where: { childProfileId, exerciseItemId: wordReadingItemId },
    });
    expect(attempt?.isCorrect).toBe(true);

    const progress = await db.skillProgress.findMany({ where: { childProfileId } });
    expect(progress.length).toBeGreaterThan(0);
  });

  it('verlangt exakt die hinterlegte Lösung ohne Toleranz für Tippfehler', async () => {
    const result = await submitSpellingAttempt({
      childProfileId,
      exerciseItemId: gapFillItemId,
      submittedAnswer: gapFillSolution.slice(0, -1),
    });
    expect(result.isCorrect).toBe(false);
  });

  it('lädt ein gültiges spelling_basics-Lernprofil aus dem Seed', () => {
    expect(spellingLearningProfileId).toBeTruthy();
  });
});
