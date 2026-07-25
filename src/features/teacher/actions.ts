'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { logAuditEvent } from '@/lib/server/audit';
import { requireOwnChildProfile, requireOwnActiveTeacherGrant } from '@/lib/server/authz';
import {
  registerTeacherSchema,
  grantTeacherAccessSchema,
  createTeacherFeedbackRequestSchema,
  submitTeacherFeedbackSchema,
} from '@/lib/validation/teacher';
import {
  grantTeacherAccess,
  revokeTeacherAccess,
  submitTeacherFeedback,
  createTeacherFeedbackRequest,
  updateTeacherFeedbackRequestStatus,
} from '@/lib/teacher/teacherService';
import type { FormActionState } from '@/features/auth/actions';
import type { FeedbackRequestStatus } from '@/generated/prisma/enums';

const CONSENT_VERSION = '2026-07-15';

export async function registerTeacherAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = registerTeacherSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
    schoolName: formData.get('schoolName') || undefined,
    acceptedTerms: formData.get('acceptedTerms') === 'on',
    acceptedPrivacy: formData.get('acceptedPrivacy') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const { email, password, name, schoolName } = parsed.data;

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
      role: 'teacher',
      consentRecords: {
        create: [
          { type: 'terms_of_service', version: CONSENT_VERSION },
          { type: 'privacy_policy', version: CONSENT_VERSION },
        ],
      },
      teacherProfile: { create: { schoolName } },
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'user.register_teacher',
    targetType: 'User',
    targetId: user.id,
  });

  redirect('/login?registered=1');
}

export async function grantTeacherAccessAction(
  childProfileId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = grantTeacherAccessSchema.safeParse({
    teacherEmail: formData.get('teacherEmail'),
  });
  if (!parsed.success) {
    return { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  // Verhindert E-Mail-Enumeration verifizierter Lehrkraft-Konten durch ein
  // (kompromittiertes) Elternkonto — analog zu grantSpecialistAccessAction,
  // siehe security-red-team-Agent.
  if (!(await checkRateLimit(`grant-teacher:${user.id}`, 10, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const result = await grantTeacherAccess(childProfileId, user.id, parsed.data.teacherEmail);
  if (!result.success) {
    return { error: result.error };
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'teacher_access_grant.create',
    targetType: 'TeacherAccessGrant',
    targetId: result.grantId,
    metadata: { childProfileId },
  });

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
  return { success: true };
}

export async function revokeTeacherAccessAction(
  childProfileId: string,
  teacherAccessGrantId: string,
): Promise<void> {
  const { user } = await requireOwnChildProfile(childProfileId);

  await revokeTeacherAccess(childProfileId, teacherAccessGrantId);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'teacher_access_grant.revoke',
    targetType: 'TeacherAccessGrant',
    targetId: teacherAccessGrantId,
  });

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
}

export async function createTeacherFeedbackRequestAction(
  childProfileId: string,
  teacherAccessGrantId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = createTeacherFeedbackRequestSchema.safeParse({
    teacherAccessGrantId,
    message: formData.get('message') || undefined,
  });
  if (!parsed.success) {
    return { error: 'Bitte prüfe deine Eingabe.' };
  }

  const result = await createTeacherFeedbackRequest(
    childProfileId,
    teacherAccessGrantId,
    user.id,
    parsed.data.message,
  );
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
  return { success: true };
}

export async function submitTeacherFeedbackAction(
  teacherAccessGrantId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { teacherProfile } = await requireOwnActiveTeacherGrant(teacherAccessGrantId);

  const parsed = submitTeacherFeedbackSchema.safeParse({
    teacherAccessGrantId,
    note: formData.get('note'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingabe.' };
  }

  await submitTeacherFeedback(teacherAccessGrantId, teacherProfile.id, parsed.data.note);

  revalidatePath(`/lehrer/${teacherAccessGrantId}`);
  return { success: true };
}

export async function updateTeacherFeedbackRequestStatusAction(
  teacherAccessGrantId: string,
  feedbackRequestId: string,
  status: FeedbackRequestStatus,
): Promise<void> {
  await requireOwnActiveTeacherGrant(teacherAccessGrantId);

  await updateTeacherFeedbackRequestStatus(teacherAccessGrantId, feedbackRequestId, status);

  revalidatePath(`/lehrer/${teacherAccessGrantId}`);
}
