'use server';

import { db } from '@/lib/server/db';
import { requireOwnChildProfile } from '@/lib/server/authz';
import { submitComprehensionAnswer } from '@/lib/comprehension/comprehensionService';

export interface SubmitComprehensionAnswerInput {
  childProfileId: string;
  sessionId: string;
  questionId: string;
  submittedAnswer: unknown;
}

export async function submitComprehensionAnswerAction(input: SubmitComprehensionAnswerInput) {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  await db.readingSession.findFirstOrThrow({
    where: { id: input.sessionId, childProfileId: childProfile.id },
  });

  return submitComprehensionAnswer({
    readingSessionId: input.sessionId,
    questionId: input.questionId,
    submittedAnswer: input.submittedAnswer,
  });
}
