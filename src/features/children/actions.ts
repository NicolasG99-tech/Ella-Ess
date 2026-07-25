'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/server/db';
import { requireUser, requireOwnChildProfile } from '@/lib/server/authz';
import { logAuditEvent } from '@/lib/server/audit';
import {
  childProfileSchema,
  childProfileSettingsSchema,
  MAX_CHILD_PROFILES_PER_PARENT,
} from '@/lib/validation/child-profile';
import type { FormActionState } from '@/features/auth/actions';

function parseChildProfileForm(formData: FormData) {
  return childProfileSchema.safeParse({
    displayName: formData.get('displayName'),
    birthYear: Number(formData.get('birthYear')),
    avatarKey: formData.get('avatarKey') || undefined,
    currentLearningProfileCode: formData.get('currentLearningProfileCode') || undefined,
  });
}

export async function createChildProfileAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const parsed = parseChildProfileForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const existingCount = await db.childProfile.count({ where: { parentId: user.id } });
  if (existingCount >= MAX_CHILD_PROFILES_PER_PARENT) {
    return {
      error: `Es sind maximal ${MAX_CHILD_PROFILES_PER_PARENT} Kinderprofile pro Konto möglich.`,
    };
  }

  const { currentLearningProfileCode, ...rest } = parsed.data;
  const learningProfile = currentLearningProfileCode
    ? await db.learningProfile.findUnique({ where: { code: currentLearningProfileCode } })
    : null;

  const childProfile = await db.childProfile.create({
    data: {
      ...rest,
      parentId: user.id,
      currentLearningProfileId: learningProfile?.id,
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_profile.create',
    targetType: 'ChildProfile',
    targetId: childProfile.id,
  });

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function updateChildProfileAction(
  childProfileId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = parseChildProfileForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const { currentLearningProfileCode, ...rest } = parsed.data;
  const learningProfile = currentLearningProfileCode
    ? await db.learningProfile.findUnique({ where: { code: currentLearningProfileCode } })
    : null;

  await db.childProfile.update({
    where: { id: childProfileId },
    data: {
      ...rest,
      currentLearningProfileId: learningProfile?.id ?? null,
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_profile.update',
    targetType: 'ChildProfile',
    targetId: childProfileId,
  });

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function updateChildProfileSettingsAction(
  childProfileId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requireOwnChildProfile(childProfileId);

  const parsed = childProfileSettingsSchema.safeParse({
    fontScale: Number(formData.get('fontScale')),
    lineSpacingScale: Number(formData.get('lineSpacingScale')),
    reducedMotion: formData.get('reducedMotion') === 'on',
    audioHintsEnabled: formData.get('audioHintsEnabled') === 'on',
  });

  if (!parsed.success) {
    return { error: 'Bitte prüfe die Einstellungen.' };
  }

  await db.childProfile.update({ where: { id: childProfileId }, data: parsed.data });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_profile.update_settings',
    targetType: 'ChildProfile',
    targetId: childProfileId,
  });

  revalidatePath(`/dashboard/children/${childProfileId}/edit`);
  return { success: true };
}

export async function deleteChildProfileAction(childProfileId: string): Promise<void> {
  const { user } = await requireOwnChildProfile(childProfileId);

  await db.childProfile.delete({ where: { id: childProfileId } });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'child_profile.delete',
    targetType: 'ChildProfile',
    targetId: childProfileId,
  });

  revalidatePath('/dashboard');
}
