import type { LiteracySkillContent } from '@/content/types';

export const literacySkills: LiteracySkillContent[] = [
  {
    code: 'buchstaben_laut_beziehungen',
    name: 'Buchstaben-Laut-Beziehungen',
    description: 'Erkennt, welcher Laut zu welchem Buchstaben gehört.',
    learningProfileCode: 'reading_basics',
  },
  {
    code: 'silben_erkennen',
    name: 'Silben erkennen',
    description: 'Kann Wörter in Silben zerlegen und wieder zusammensetzen.',
    learningProfileCode: 'reading_basics',
  },
  {
    code: 'lesegenauigkeit',
    name: 'Lesegenauigkeit',
    description: 'Liest kurze Wörter und Sätze genau, ohne Wörter auszulassen oder zu vertauschen.',
    learningProfileCode: 'reading_basics',
  },
  {
    code: 'satzgrenzen_erkennen',
    name: 'Satzgrenzen erkennen',
    description: 'Macht beim Lesen an Satzenden eine angemessene Pause.',
    learningProfileCode: 'fluency',
  },
  {
    code: 'selbstkorrektur',
    name: 'Selbstkorrektur',
    description: 'Bemerkt eigene Lesefehler und verbessert sich selbstständig.',
    learningProfileCode: 'fluency',
  },
  {
    code: 'laut_buchstaben_zuordnung',
    name: 'Laut-Buchstaben-Zuordnung',
    description: 'Ordnet gehörte Laute den passenden Buchstaben beim Schreiben zu.',
    learningProfileCode: 'spelling_basics',
  },
  {
    code: 'wortmuster_erkennen',
    name: 'Wortmuster erkennen',
    description: 'Erkennt wiederkehrende Rechtschreibmuster in häufigen Wörtern.',
    learningProfileCode: 'spelling_basics',
  },
];
