import { describe, expect, it } from 'vitest';
import { evaluateComprehensionAnswer } from '@/lib/comprehension/evaluateAnswer';

describe('evaluateComprehensionAnswer', () => {
  it('vergleicht multiple_choice/inference-Antworten als normalisierte Strings', () => {
    expect(evaluateComprehensionAnswer('Ein Igel', 'Ein Igel')).toBe(true);
    expect(evaluateComprehensionAnswer('Ein Igel', '  ein igel  ')).toBe(true);
    expect(evaluateComprehensionAnswer('Ein Igel', 'Ein Hund')).toBe(false);
  });

  it('vergleicht statement-Antworten als Booleans', () => {
    expect(evaluateComprehensionAnswer(false, false)).toBe(true);
    expect(evaluateComprehensionAnswer(false, true)).toBe(false);
    expect(evaluateComprehensionAnswer(true, 'true')).toBe(false);
  });

  it('vergleicht ordering-Antworten als Arrays in exakter Reihenfolge', () => {
    expect(evaluateComprehensionAnswer(['A', 'B', 'C'], ['A', 'B', 'C'])).toBe(true);
    expect(evaluateComprehensionAnswer(['A', 'B', 'C'], ['B', 'A', 'C'])).toBe(false);
    expect(evaluateComprehensionAnswer(['A', 'B'], ['A', 'B', 'C'])).toBe(false);
  });

  it('ist bei ordering-Antworten tolerant gegenüber Groß-/Kleinschreibung', () => {
    expect(
      evaluateComprehensionAnswer(['Mia sucht', 'Mia findet'], ['mia sucht', 'MIA FINDET']),
    ).toBe(true);
  });
});
