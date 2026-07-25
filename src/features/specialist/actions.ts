'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { logAuditEvent } from '@/lib/server/audit';
import { requireOwnChildProfile, requireOwnActiveGrant } from '@/lib/server/authz';
import {
  registerSpecialistSchema,
  grantSpecialistAccessSchema,
  createFeedbackRequestSchema,
  submitSpecialistFeedbackSchema,
} from '@/lib/validation/specialist';
import {
  grantSpecialistAccess,
  revokeSpecialistAccess,
  submitSpecialistFeedback,
  createFeedbackRequest,
  updateFeedbackRequestStatus,
} from '@/lib/specialist/specialistService';
import type { FormActionState } from '@/features/auth/actions';
import type { FeedbackRequestStatus } from '@/generated/prisma/enums';

const CONSENT_VERSION = '2026-07-15';

export async function registerSpecialistAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = registerSpecialistSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
    credentials: formData.get('credentials') || undefined,
    acceptedTerms: formData.get('acceptedTerms') === 'on',
    acceptedPrivacy: formData.get('acceptedPrivacy') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const { email, password, name, credentials } = parsed.data;

  if (!(await checkRateLimit(`register:${email}`, 5, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'Für diese E-Mail-Adresse existiert bereits ein Konto.' };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: 'specialist',
      consentRecords: {
        create: [
          { type: 'terms_of_service', version: CONSENT_VERSION },
          { type: 'privacy_policy', version: CONSENT_VERSION },
        ],
      },
      specialistProfile: { create: { credentials } },
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'user.register_specialist',
    targetType: 'User',
    targetId: user.id,
  });

  redirect('/login?registered=1');
}

export async function grantSpecialistAccessAction(
  childProfileId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = grantSpecialistAccessSchema.safeParse({
    specialistEmail: formData.get('specialistEmail'),
  });
  if (!parsed.success) {
    return { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  // Verhindert, dass ein (kompromittiertes) Elternkonto durch wiederholtes
  // Durchprobieren von E-Mail-Adressen erkennt, welche davon zu verifizierten
  // Fachkraft-Konten gehören (Enumeration) — siehe security-red-team-Agent.
  if (!(await checkRateLimit(`grant-specialist:${user.id}`, 10, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const result = await grantSpecialistAccess(childProfileId, user.id, parsed.data.specialistEmail);
  if (!result.success) {
    return { error: result.error };
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_access_grant.create',
    targetType: 'ChildAccessGrant',
    targetId: result.grantId,
    metadata: { childProfileId },
  });

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
  return { success: true };
}

export async function revokeSpecialistAccessAction(
  childProfileId: string,
  childAccessGrantId: string,
): Promise<void> {
  const { user } = await requireOwnChildProfile(childProfileId);

  await revokeSpecialistAccess(childProfileId, childAccessGrantId);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_access_grant.revoke',
    targetType: 'ChildAccessGrant',
    targetId: childAccessGrantId,
  });

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
}

export async function createFeedbackRequestAction(
  childProfileId: string,
  childAccessGrantId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = createFeedbackRequestSchema.safeParse({
    childAccessGrantId,
    message: formData.get('message') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Bitte prüfe deine Eingabe.' };
  }

  const result = await createFeedbackRequest(
    childProfileId,
    childAccessGrantId,
    user.id,
    parsed.data.message,
  );
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
  return { success: true };
}

export async function submitSpecialistFeedbackAction(
  childAccessGrantId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { specialistProfile } = await requireOwnActiveGrant(childAccessGrantId);

  const parsed = submitSpecialistFeedbackSchema.safeParse({
    childAccessGrantId,
    note: formData.get('note'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingabe.' };
  }

  await submitSpecialistFeedback(childAccessGrantId, specialistProfile.id, parsed.data.note);

  revalidatePath(`/fachkraft/${childAccessGrantId}`);
  return { success: true };
}

export async function updateFeedbackRequestStatusAction(
  childAccessGrantId: string,
  feedbackRequestId: string,
  status: FeedbackRequestStatus,
): Promise<void> {
  await requireOwnActiveGrant(childAccessGrantId);

  await updateFeedbackRequestStatus(childAccessGrantId, feedbackRequestId, status);

  revalidatePath(`/fachkraft/${childAccessGrantId}`);
}
