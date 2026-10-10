'use server';

import { requireOwnChildProfile } from '@/lib/server/authz';
import { checkChildContentRateLimit } from '@/lib/server/rate-limit';
import { markWordReadingComplete, submitSpellingAttempt } from '@/lib/exercises/exerciseService';
import type { GrantedReward } from '@/lib/gamification/gamificationService';

export interface SubmitSpellingAttemptInput {
  childProfileId: string;
  exerciseItemId: string;
  submittedAnswer: string;
}

// Um `rateLimited` erweitert, analog zu SubmitComprehensionAnswerResult
// (features/comprehension/actions.ts) — siehe dortiger Kommentar.
export interface SubmitSpellingAttemptResult {
  isCorrect: boolean;
  attemptNumber: number;
  canRetry: boolean;
  solution: string | null;
  newlyEarnedRewards: GrantedReward[];
  rateLimited?: boolean;
}

/**
 * Wertet die getippte Antwort eines Kindes bei einer Rechtschreib-/Diktat-
 * übung aus (Toleranz für akzeptierte Varianten, siehe
 * evaluateSpellingAnswer), max. 2 Versuche.
 *
 * @param input - Kinderprofil-, Übungsaufgaben-ID und die eingegebene Antwort.
 * @returns Bewertung, Versuchsnummer, ob ein weiterer Versuch erlaubt ist,
 *   (nur beim letzten Versuch) die korrekte Schreibweise sowie neu
 *   vergebene Belohnungen.
 * @sideeffect Legt einen SpellingAttempt-Datensatz an und aktualisiert bei
 *   Abschluss den Skill-Fortschritt. Bei Rate-Limit-Sperre
 *   (checkChildContentRateLimit) wird ein synthetisches
 *   `rateLimited: true`-Ergebnis zurückgegeben, ohne einen Versuch zu zählen.
 */
export async function submitSpellingAttemptAction(
  input: SubmitSpellingAttemptInput,
): Promise<SubmitSpellingAttemptResult> {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  if (!(await checkChildContentRateLimit(childProfile.id))) {
    return {
      isCorrect: false,
      attemptNumber: 0,
      canRetry: true,
      solution: null,
      newlyEarnedRewards: [],
      rateLimited: true,
    };
  }

  return submitSpellingAttempt({
    childProfileId: childProfile.id,
    exerciseItemId: input.exerciseItemId,
    submittedAnswer: input.submittedAnswer,
  });
}

export interface MarkWordReadingCompleteInput {
  childProfileId: string;
  exerciseItemId: string;
}

export interface MarkWordReadingCompleteResult {
  newlyEarnedRewards: GrantedReward[];
  rateLimited?: boolean;
}

/**
 * Meldet, dass ein Kind eine Wortlese-Übung (kein getipptes Ergebnis, kein
 * Mikrofon nötig) abgeschlossen hat.
 *
 * @param input - Kinderprofil- und Übungsaufgaben-ID.
 * @returns Neu vergebene Belohnungen für den Übungsabschluss.
 * @sideeffect Legt einen SpellingAttempt-Datensatz (immer korrekt) an und
 *   aktualisiert den Skill-Fortschritt. Bei Rate-Limit-Sperre wird
 *   `{ newlyEarnedRewards: [], rateLimited: true }` zurückgegeben, ohne dass
 *   die Übung als abgeschlossen gilt (siehe ExercisePractice.tsx,
 *   handleWordReadDone: setzt den optimistischen UI-Status zurück).
 */
export async function markWordReadingCompleteAction(
  input: MarkWordReadingCompleteInput,
): Promise<MarkWordReadingCompleteResult> {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  if (!(await checkChildContentRateLimit(childProfile.id))) {
    return { newlyEarnedRewards: [], rateLimited: true };
  }

  return markWordReadingComplete(childProfile.id, input.exerciseItemId);
}
