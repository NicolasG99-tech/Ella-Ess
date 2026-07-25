import type {
  ComprehensionQuestionType,
  EvaluationState,
  ExerciseType,
} from '@/generated/prisma/enums';

// Pure Berechnungen für den Assessment-Bogen (Fachkräfte & Lehrkräfte) — von
// der DB-Orchestrierung getrennt (assessmentService.ts), damit sie ohne
// Next.js-/DB-Kontext direkt testbar sind (siehe masteryCalculation.ts für
// dasselbe Muster). Bewusst generisch aus vorhandenen Übungsdaten abgeleitet,
// ohne Anspruch auf ein konkretes externes Diagnostikverfahren — siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Grenzen automatischer Auswertung".

export const EVALUATION_STATE_LABELS: Record<EvaluationState, string> = {
  correct: 'Richtig gelesen',
  likely_correct: 'Wahrscheinlich richtig',
  possible_error: 'Möglicher Lesefehler',
  unclear_audio: 'Unklare Aufnahme',
  self_corrected: 'Selbst korrigiert',
  skipped: 'Übersprungen',
  unavailable: 'Nicht auswertbar',
};

export interface ErrorTypeBreakdownEntry {
  state: EvaluationState;
  label: string;
  count: number;
}

// Reihenfolge bewusst fest (nicht nach Häufigkeit sortiert) — "Richtig
// gelesen" immer zuerst, damit der Bogen nicht wie eine Fehlerliste wirkt.
const EVALUATION_STATE_ORDER: EvaluationState[] = [
  'correct',
  'likely_correct',
  'possible_error',
  'self_corrected',
  'skipped',
  'unclear_audio',
  'unavailable',
];

export function buildErrorTypeBreakdown(
  counts: Partial<Record<EvaluationState, number>>,
): ErrorTypeBreakdownEntry[] {
  return EVALUATION_STATE_ORDER.map((state) => ({
    state,
    label: EVALUATION_STATE_LABELS[state],
    count: counts[state] ?? 0,
  })).filter((entry) => entry.count > 0);
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  word_reading: 'Wortübung',
  spelling_gap_fill: 'Lückentext',
  letter_order: 'Buchstaben ordnen',
  syllable_build: 'Wort aus Silben',
  dictation: 'Diktat',
};

export interface SpellingAttemptForAccuracy {
  exerciseItemId: string;
  exerciseType: ExerciseType;
  attemptNumber: number;
  isCorrect: boolean;
}

export interface ExerciseTypeAccuracyEntry {
  exerciseType: ExerciseType;
  label: string;
  completedCount: number;
  correctFirstTryCount: number;
}

// "Abgeschlossen" = richtig gelöst ODER maximale Versuchszahl erreicht
// (dieselbe Definition wie im Eltern-Dashboard, siehe parentDashboardService.ts),
// damit beide Ansichten konsistent bleiben.
export function summarizeExerciseAccuracyByType(
  attempts: SpellingAttemptForAccuracy[],
  maxAttempts: number,
): ExerciseTypeAccuracyEntry[] {
  const byType = new Map<ExerciseType, { completed: Set<string>; correctFirstTry: number }>();

  for (const attempt of attempts) {
    const entry = byType.get(attempt.exerciseType) ?? {
      completed: new Set<string>(),
      correctFirstTry: 0,
    };
    if (attempt.isCorrect || attempt.attemptNumber >= maxAttempts) {
      entry.completed.add(attempt.exerciseItemId);
    }
    if (attempt.attemptNumber === 1 && attempt.isCorrect) {
      entry.correctFirstTry += 1;
    }
    byType.set(attempt.exerciseType, entry);
  }

  return Array.from(byType.entries()).map(([exerciseType, data]) => ({
    exerciseType,
    label: EXERCISE_TYPE_LABELS[exerciseType],
    completedCount: data.completed.size,
    correctFirstTryCount: data.correctFirstTry,
  }));
}

export const COMPREHENSION_TYPE_LABELS: Record<ComprehensionQuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  ordering: 'Reihenfolge bringen',
  statement: 'Aussage bewerten',
  inference: 'Schlussfolgern',
};

export interface ComprehensionAttemptForAccuracy {
  questionType: ComprehensionQuestionType;
  attemptNumber: number;
  isCorrect: boolean;
}

export interface ComprehensionTypeAccuracyEntry {
  questionType: ComprehensionQuestionType;
  label: string;
  correct: number;
  total: number;
}

// Nur erste Versuche zählen (wie summarizeFirstTryAccuracy in
// comprehensionSummary.ts) — ein unterstützter zweiter Versuch soll die
// Genauigkeit nicht beschönigen.
export function summarizeComprehensionAccuracyByType(
  attempts: ComprehensionAttemptForAccuracy[],
): ComprehensionTypeAccuracyEntry[] {
  const byType = new Map<ComprehensionQuestionType, { correct: number; total: number }>();

  for (const attempt of attempts) {
    if (attempt.attemptNumber !== 1) continue;
    const entry = byType.get(attempt.questionType) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.isCorrect) entry.correct += 1;
    byType.set(attempt.questionType, entry);
  }

  return Array.from(byType.entries()).map(([questionType, data]) => ({
    questionType,
    label: COMPREHENSION_TYPE_LABELS[questionType],
    correct: data.correct,
    total: data.total,
  }));
}
