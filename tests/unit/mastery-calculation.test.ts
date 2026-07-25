import { describe, expect, it } from 'vitest';
import { attemptOutcomeFrom, computeUpdatedMastery } from '@/lib/progress/masteryCalculation';

describe('computeUpdatedMastery', () => {
  it('erhöht die Beherrschung bei einem korrekten ersten Versuch', () => {
    const updated = computeUpdatedMastery(0.5, 'correct_first_try');
    expect(updated).toBeGreaterThan(0.5);
  });

  it('erhöht die Beherrschung bei einem korrekten zweiten Versuch weniger stark als beim ersten', () => {
    const first = computeUpdatedMastery(0.5, 'correct_first_try');
    const second = computeUpdatedMastery(0.5, 'correct_second_try');
    expect(second).toBeLessThan(first);
    expect(second).toBeGreaterThan(0.5);
  });

  it('senkt die Beherrschung bei einer falschen Antwort leicht, aber nie unter 0', () => {
    const updated = computeUpdatedMastery(0.1, 'incorrect');
    expect(updated).toBeGreaterThanOrEqual(0);
    expect(updated).toBeLessThan(0.5);
  });

  it('bleibt innerhalb von [0, 1]', () => {
    expect(computeUpdatedMastery(1, 'correct_first_try')).toBeLessThanOrEqual(1);
    expect(computeUpdatedMastery(0, 'incorrect')).toBeGreaterThanOrEqual(0);
  });
});

describe('attemptOutcomeFrom', () => {
  it('ordnet einen korrekten ersten Versuch richtig zu', () => {
    expect(attemptOutcomeFrom(true, 1)).toBe('correct_first_try');
  });

  it('ordnet einen korrekten zweiten Versuch richtig zu', () => {
    expect(attemptOutcomeFrom(true, 2)).toBe('correct_second_try');
  });

  it('ordnet eine falsche Antwort unabhängig von der Versuchsnummer als "incorrect" zu', () => {
    expect(attemptOutcomeFrom(false, 1)).toBe('incorrect');
    expect(attemptOutcomeFrom(false, 2)).toBe('incorrect');
  });
});
