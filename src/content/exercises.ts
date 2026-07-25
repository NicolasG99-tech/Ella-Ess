import type { ExerciseContent } from '@/content/types';

// Wortübungen: einzelne Wörter zum lauten Lesen, sortiert nach Schwierigkeit.
const wordReadingExercises: ExerciseContent[] = [
  {
    type: 'word_reading',
    title: 'Wortübung: Kurze Wörter',
    difficultyLevel: 1,
    learningProfileCode: 'reading_basics',
    items: [
      { order: 0, prompt: 'Hund', solution: 'Hund' },
      { order: 1, prompt: 'Katze', solution: 'Katze' },
      { order: 2, prompt: 'Ball', solution: 'Ball' },
      { order: 3, prompt: 'Baum', solution: 'Baum' },
      { order: 4, prompt: 'Sonne', solution: 'Sonne' },
      { order: 5, prompt: 'Haus', solution: 'Haus' },
      { order: 6, prompt: 'Buch', solution: 'Buch' },
      { order: 7, prompt: 'Fisch', solution: 'Fisch' },
      { order: 8, prompt: 'Mond', solution: 'Mond' },
      { order: 9, prompt: 'Stern', solution: 'Stern' },
    ],
  },
  {
    type: 'word_reading',
    title: 'Wortübung: Längere Wörter',
    difficultyLevel: 2,
    learningProfileCode: 'fluency',
    items: [
      { order: 0, prompt: 'Schokolade', solution: 'Schokolade' },
      { order: 1, prompt: 'Blumenwiese', solution: 'Blumenwiese' },
      { order: 2, prompt: 'Feuerwehr', solution: 'Feuerwehr' },
      { order: 3, prompt: 'Krankenwagen', solution: 'Krankenwagen' },
      { order: 4, prompt: 'Wasserfall', solution: 'Wasserfall' },
      { order: 5, prompt: 'Sonnenschein', solution: 'Sonnenschein' },
      { order: 6, prompt: 'Marienkäfer', solution: 'Marienkäfer' },
      { order: 7, prompt: 'Kartoffel', solution: 'Kartoffel' },
      { order: 8, prompt: 'Fußballspiel', solution: 'Fußballspiel' },
      { order: 9, prompt: 'Abenteuer', solution: 'Abenteuer' },
    ],
  },
];

// Rechtschreibübungen: alle vier im Lastenheft geforderten Übungstypen.
const spellingExercises: ExerciseContent[] = [
  {
    type: 'spelling_gap_fill',
    title: 'Lückentext: Fehlenden Buchstaben einsetzen',
    difficultyLevel: 1,
    learningProfileCode: 'spelling_basics',
    items: [
      { order: 0, prompt: 'H_nd', solution: 'Hund', acceptedVariants: [] },
      { order: 1, prompt: 'M_nd', solution: 'Mond', acceptedVariants: [] },
      { order: 2, prompt: 'B_ll', solution: 'Ball', acceptedVariants: [] },
    ],
  },
  {
    type: 'letter_order',
    title: 'Buchstaben ordnen',
    difficultyLevel: 1,
    learningProfileCode: 'spelling_basics',
    items: [
      { order: 0, prompt: 'N-D-H-U', solution: 'HUND' },
      { order: 1, prompt: 'A-T-K-Z-E', solution: 'KATZE' },
      { order: 2, prompt: 'U-B-A-M', solution: 'BAUM' },
    ],
  },
  {
    type: 'syllable_build',
    title: 'Wort aus Silben zusammensetzen',
    difficultyLevel: 2,
    learningProfileCode: 'spelling_basics',
    items: [
      { order: 0, prompt: 'SON-NE', solution: 'SONNE' },
      { order: 1, prompt: 'GAR-TEN', solution: 'GARTEN' },
    ],
  },
  {
    type: 'dictation',
    title: 'Kurzes Diktat',
    difficultyLevel: 2,
    learningProfileCode: 'spelling_basics',
    items: [
      {
        order: 0,
        prompt: '',
        solution: 'Die Katze schläft.',
        audioText: 'Die Katze schläft.',
      },
      {
        order: 1,
        prompt: '',
        solution: 'Ich mag Kuchen.',
        audioText: 'Ich mag Kuchen.',
      },
    ],
  },
];

export const exercises: ExerciseContent[] = [...wordReadingExercises, ...spellingExercises];
