import { describe, expect, it } from 'vitest';
import { deriveExpectedWords } from '@/lib/content/deriveExpectedWords';

describe('deriveExpectedWords', () => {
  it('zerlegt einen einfachen Satz in Wörter mit fortlaufendem Index', () => {
    const words = deriveExpectedWords('Der Hund läuft.');
    expect(words).toEqual([
      { index: 0, word: 'Der', acceptedVariants: [] },
      { index: 1, word: 'Hund', acceptedVariants: [] },
      { index: 2, word: 'läuft', acceptedVariants: [] },
    ]);
  });

  it('entfernt deutsche Anführungszeichen um wörtliche Rede', () => {
    const words = deriveExpectedWords('Oma fragt: „Willst du?"');
    expect(words.map((w) => w.word)).toEqual(['Oma', 'fragt', 'Willst', 'du']);
  });

  it('behandelt mehrfache Leerzeichen wie ein einzelnes', () => {
    const words = deriveExpectedWords('Hallo   Welt');
    expect(words).toHaveLength(2);
  });

  it('gibt eine leere Liste für leeren Text zurück', () => {
    expect(deriveExpectedWords('   ')).toEqual([]);
  });
});
