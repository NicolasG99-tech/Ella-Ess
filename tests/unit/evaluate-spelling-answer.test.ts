import { describe, expect, it } from 'vitest';
import { evaluateSpellingAnswer } from '@/lib/exercises/evaluateSpellingAnswer';

describe('evaluateSpellingAnswer', () => {
  it('akzeptiert die exakte Lösung', () => {
    expect(evaluateSpellingAnswer('Hund', 'Hund')).toBe(true);
  });

  it('ist tolerant gegenüber Groß-/Kleinschreibung und umgebenden Leerzeichen', () => {
    expect(evaluateSpellingAnswer('  hund  ', 'Hund')).toBe(true);
  });

  it('lehnt eine falsche Antwort ab', () => {
    expect(evaluateSpellingAnswer('Katze', 'Hund')).toBe(false);
  });

  it('akzeptiert definierte zulässige Varianten', () => {
    expect(evaluateSpellingAnswer('Fahrad', 'Fahrrad', ['Fahrad'])).toBe(true);
  });

  it('toleriert keine Tippfehler, die nicht als Variante hinterlegt sind', () => {
    expect(evaluateSpellingAnswer('Fahradd', 'Fahrrad', ['Fahrad'])).toBe(false);
  });
});
