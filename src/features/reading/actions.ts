'use server';

import { requireOwnChildProfile } from '@/lib/server/authz';
import {
  resolveHelp,
  startOrResumeReadingSession,
  submitReadingAttempt,
  type ResolveHelpParams,
  type SubmitReadingAttemptParams,
} from '@/lib/reading/readingSessionService';

export async function startOrResumeReadingSessionAction(childProfileId: string, storySlug: string) {
  const { user, childProfile } = await requireOwnChildProfile(childProfileId);
  return startOrResumeReadingSession(childProfile.id, storySlug, user.id);
}

export async function submitReadingAttemptAction(input: SubmitReadingAttemptParams) {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);
  return submitReadingAttempt({ ...input, childProfileId: childProfile.id });
}

export async function resolveHelpAction(input: ResolveHelpParams) {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);
  return resolveHelp({ ...input, childProfileId: childProfile.id });
}
