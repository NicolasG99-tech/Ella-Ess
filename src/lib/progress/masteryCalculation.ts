// Fortschrittsberechnung (Meilenstein 6): aktualisiert den Beherrschungsgrad
// (SkillProgress.masteryLevel, 0..1) einer Fähigkeit nach jedem Versuch als
// gleitenden Durchschnitt in Richtung eines Zielwerts. Bewusst sanft (kleine
// Lernrate) und nie als harte Diagnose zu verstehen — siehe
// docs/EDUCATIONAL_MODEL.md.

export type AttemptOutcome = 'correct_first_try' | 'correct_second_try' | 'incorrect';

const LEARNING_RATE = 0.25;

const TARGET_SCORE: Record<AttemptOutcome, number> = {
  correct_first_try: 1,
  correct_second_try: 0.6,
  incorrect: 0.2,
};

export function computeUpdatedMastery(currentMastery: number, outcome: AttemptOutcome): number {
  const target = TARGET_SCORE[outcome];
  const updated = currentMastery + LEARNING_RATE * (target - currentMastery);
  return Math.max(0, Math.min(1, updated));
}

export function attemptOutcomeFrom(isCorrect: boolean, attemptNumber: number): AttemptOutcome {
  if (!isCorrect) return 'incorrect';
  return attemptNumber <= 1 ? 'correct_first_try' : 'correct_second_try';
}
