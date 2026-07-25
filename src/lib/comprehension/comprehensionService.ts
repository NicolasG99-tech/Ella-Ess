import { db } from '@/lib/server/db';
import type { Prisma } from '@/generated/prisma/client';
import { evaluateComprehensionAnswer } from '@/lib/comprehension/evaluateAnswer';

// Maximal zwei Versuche pro Verständnisfrage (siehe Lastenheft 4.11).
const MAX_ATTEMPTS = 2;

export interface SubmitComprehensionAnswerParams {
  readingSessionId: string;
  questionId: string;
  submittedAnswer: unknown;
}

export async function submitComprehensionAnswer(params: SubmitComprehensionAnswerParams) {
  const question = await db.comprehensionQuestion.findUniqueOrThrow({
    where: { id: params.questionId },
  });

  const previousAttempts = await db.comprehensionAttempt.count({
    where: {
      readingSessionId: params.readingSessionId,
      comprehensionQuestionId: params.questionId,
    },
  });
  const attemptNumber = previousAttempts + 1;
  const isCorrect = evaluateComprehensionAnswer(question.correctAnswer, params.submittedAnswer);

  await db.comprehensionAttempt.create({
    data: {
      readingSessionId: params.readingSessionId,
      comprehensionQuestionId: params.questionId,
      attemptNumber,
      submittedAnswer: params.submittedAnswer as Prisma.InputJsonValue,
      isCorrect,
    },
  });

  const canRetry = !isCorrect && attemptNumber < MAX_ATTEMPTS;
  const isFinal = isCorrect || !canRetry;

  return {
    isCorrect,
    attemptNumber,
    canRetry,
    // Eine Textstelle als Hilfe erscheint nur bei einer falschen Antwort, nie
    // als Bloßstellung — siehe docs/EDUCATIONAL_MODEL.md.
    hintText: !isCorrect && canRetry ? question.hintText : null,
    correctAnswer: isFinal ? question.correctAnswer : null,
  };
}
