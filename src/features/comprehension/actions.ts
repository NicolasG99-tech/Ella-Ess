'use server';

import { db } from '@/lib/server/db';
import { requireOwnChildProfile } from '@/lib/server/authz';
import { checkChildContentRateLimit } from '@/lib/server/rate-limit';
import { submitComprehensionAnswer } from '@/lib/comprehension/comprehensionService';

export interface SubmitComprehensionAnswerInput {
  childProfileId: string;
  sessionId: string;
  questionId: string;
  submittedAnswer: unknown;
}

// Rückgabeform um ein optionales `rateLimited`-Flag erweitert (siehe
// checkChildContentRateLimit in rate-limit.ts), damit ComprehensionQuiz.tsx
// die Sperre von einer echten falschen Antwort unterscheiden und einen
// eigenen, nicht wertenden Hinweis anzeigen kann — kein neuer Frage-Versuch
// wird dabei gezählt (submitComprehensionAnswer wird gar nicht erst gerufen).
export interface SubmitComprehensionAnswerResult {
  isCorrect: boolean;
  attemptNumber: number;
  canRetry: boolean;
  hintText: string | null;
  correctAnswer: unknown;
  rateLimited?: boolean;
}

/**
 * Nimmt die Antwort eines Kindes auf eine Verständnisfrage entgegen, wertet
 * sie aus und liefert bei falscher Antwort ggf. einen Hinweistext (max. 2
 * Versuche, siehe MAX_ATTEMPTS in comprehensionService.ts).
 *
 * @param input - Kinderprofil-, Sitzungs- und Fragen-ID sowie die gegebene
 *   Antwort (Form abhängig vom Fragetyp: string/boolean/string[]).
 * @returns Bewertung, Versuchsnummer, ob ein weiterer Versuch erlaubt ist,
 *   optionaler Hinweistext und (nur beim letzten Versuch) die korrekte
 *   Antwort.
 * @sideeffect Legt einen ComprehensionAttempt-Datensatz an. Bei
 *   Rate-Limit-Sperre (checkChildContentRateLimit, 10/Min pro Kinderprofil)
 *   wird ein synthetisches `rateLimited: true`-Ergebnis zurückgegeben, ohne
 *   dass ein Versuch gezählt oder gespeichert wird.
 */
export async function submitComprehensionAnswerAction(
  input: SubmitComprehensionAnswerInput,
): Promise<SubmitComprehensionAnswerResult> {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  if (!(await checkChildContentRateLimit(childProfile.id))) {
    return {
      isCorrect: false,
      attemptNumber: 0,
      canRetry: true,
      hintText: null,
      correctAnswer: null,
      rateLimited: true,
    };
  }

  await db.readingSession.findFirstOrThrow({
    where: { id: input.sessionId, childProfileId: childProfile.id },
  });

  return submitComprehensionAnswer({
    readingSessionId: input.sessionId,
    questionId: input.questionId,
    submittedAnswer: input.submittedAnswer,
  });
}
