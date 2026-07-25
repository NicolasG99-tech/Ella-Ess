import { describe, expect, it } from 'vitest';
import {
  buildErrorTypeBreakdown,
  summarizeComprehensionAccuracyByType,
  summarizeExerciseAccuracyByType,
} from '@/lib/progress/assessmentCalculations';

describe('buildErrorTypeBreakdown', () => {
  it('lässt Einordnungen ohne Treffer weg und behält eine feste Reihenfolge', () => {
    const result = buildErrorTypeBreakdown({ correct: 5, possible_error: 2 });

    expect(result).toEqual([
      { state: 'correct', label: 'Richtig gelesen', count: 5 },
      { state: 'possible_error', label: 'Möglicher Lesefehler', count: 2 },
    ]);
  });

  it('liefert eine leere Liste ohne Wortauswertungen', () => {
    expect(buildErrorTypeBreakdown({})).toEqual([]);
  });
});

describe('summarizeExerciseAccuracyByType', () => {
  it('zählt abgeschlossene Aufgaben (richtig oder Maximalversuche) pro Typ getrennt', () => {
    const result = summarizeExerciseAccuracyByType(
      [
        { exerciseItemId: 'a', exerciseType: 'word_reading', attemptNumber: 1, isCorrect: true },
        { exerciseItemId: 'b', exerciseType: 'word_reading', attemptNumber: 1, isCorrect: false },
        { exerciseItemId: 'b', exerciseType: 'word_reading', attemptNumber: 2, isCorrect: false },
        {
          exerciseItemId: 'c',
          exerciseType: 'spelling_gap_fill',
          attemptNumber: 1,
          isCorrect: true,
        },
      ],
      2,
    );

    const wordReading = result.find((entry) => entry.exerciseType === 'word_reading');
    expect(wordReading?.completedCount).toBe(2); // a (richtig) + b (Maximalversuche erreicht)
    expect(wordReading?.correctFirstTryCount).toBe(1); // nur a

    const spelling = result.find((entry) => entry.exerciseType === 'spelling_gap_fill');
    expect(spelling?.completedCount).toBe(1);
    expect(spelling?.correctFirstTryCount).toBe(1);
  });

  it('zählt eine noch nicht abgeschlossene Aufgabe nicht mit', () => {
    const result = summarizeExerciseAccuracyByType(
      [{ exerciseItemId: 'a', exerciseType: 'dictation', attemptNumber: 1, isCorrect: false }],
      3,
    );

    expect(result[0].completedCount).toBe(0);
  });
});

describe('summarizeComprehensionAccuracyByType', () => {
  it('zählt ausschließlich erste Versuche', () => {
    const result = summarizeComprehensionAccuracyByType([
      { questionType: 'multiple_choice', attemptNumber: 1, isCorrect: true },
      { questionType: 'multiple_choice', attemptNumber: 1, isCorrect: false },
      { questionType: 'multiple_choice', attemptNumber: 2, isCorrect: true },
      { questionType: 'inference', attemptNumber: 1, isCorrect: true },
    ]);

    const multipleChoice = result.find((entry) => entry.questionType === 'multiple_choice');
    expect(multipleChoice).toEqual({
      questionType: 'multiple_choice',
      label: 'Multiple Choice',
      correct: 1,
      total: 2,
    });

    const inference = result.find((entry) => entry.questionType === 'inference');
    expect(inference?.correct).toBe(1);
    expect(inference?.total).toBe(1);
  });
});
