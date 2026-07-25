import { describe, expect, it } from 'vitest';
import { summarizeFirstTryAccuracy } from '@/lib/progress/comprehensionSummary';

describe('summarizeFirstTryAccuracy', () => {
  it('zählt nur Versuche mit attemptNumber 1', () => {
    const result = summarizeFirstTryAccuracy([
      { attemptNumber: 1, isCorrect: true },
      { attemptNumber: 2, isCorrect: true },
      { attemptNumber: 1, isCorrect: false },
    ]);
    expect(result).toEqual({ firstTryCorrect: 1, totalFirstAttempts: 2 });
  });

  it('liefert 0/0 für eine leere Liste', () => {
    expect(summarizeFirstTryAccuracy([])).toEqual({ firstTryCorrect: 0, totalFirstAttempts: 0 });
  });

  it('zählt alle korrekten Erstversuche, auch wenn alle richtig sind', () => {
    const result = summarizeFirstTryAccuracy([
      { attemptNumber: 1, isCorrect: true },
      { attemptNumber: 1, isCorrect: true },
    ]);
    expect(result).toEqual({ firstTryCorrect: 2, totalFirstAttempts: 2 });
  });
});
