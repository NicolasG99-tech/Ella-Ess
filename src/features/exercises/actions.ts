'use server';

import { requireOwnChildProfile } from '@/lib/server/authz';
import { markWordReadingComplete, submitSpellingAttempt } from '@/lib/exercises/exerciseService';

export interface SubmitSpellingAttemptInput {
  childProfileId: string;
  exerciseItemId: string;
  submittedAnswer: string;
}

export async function submitSpellingAttemptAction(input: SubmitSpellingAttemptInput) {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);
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

export async function markWordReadingCompleteAction(input: MarkWordReadingCompleteInput) {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);
  return markWordReadingComplete(childProfile.id, input.exerciseItemId);
}
