export interface ComprehensionAttemptSummaryInput {
  attemptNumber: number;
  isCorrect: boolean;
}

export interface ComprehensionAccuracySummary {
  firstTryCorrect: number;
  totalFirstAttempts: number;
}

// Zählt, wie viele Verständnisfragen beim ersten Versuch richtig beantwortet
// wurden — bewusst nur der erste Versuch, damit ein zweiter (unterstützter)
// Versuch die Zahl nicht verwässert oder beschönigt.
export function summarizeFirstTryAccuracy(
  attempts: ComprehensionAttemptSummaryInput[],
): ComprehensionAccuracySummary {
  const firstAttempts = attempts.filter((attempt) => attempt.attemptNumber === 1);
  return {
    firstTryCorrect: firstAttempts.filter((attempt) => attempt.isCorrect).length,
    totalFirstAttempts: firstAttempts.length,
  };
}
