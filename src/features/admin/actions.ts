'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/server/db';
import { requireRole } from '@/lib/server/authz';
import { logAuditEvent } from '@/lib/server/audit';

// Einzige Schreibaktion der lokalen Admin-Demo (Meilenstein 3): Geschichten
// veröffentlichen/verbergen. Volle Content-Erstellung über die UI ist kein
// MVP-Ziel — Inhalte kommen aus src/content/* und werden per Seed eingespielt.
export async function toggleStoryPublishedAction(storyId: string): Promise<void> {
  const admin = await requireRole('admin');

  const story = await db.story.findUniqueOrThrow({ where: { id: storyId } });
  await db.story.update({ where: { id: storyId }, data: { isPublished: !story.isPublished } });

  await logAuditEvent({
    actorUserId: admin.id,
    action: 'story.toggle_published',
    targetType: 'Story',
    targetId: storyId,
    metadata: { isPublished: !story.isPublished },
  });

  revalidatePath('/admin');
}

// Verifiziert/entverifiziert ein Fachkräfte-Profil (Meilenstein 9). Nur
// verifizierte Fachkräfte können von Eltern Zugriff auf ein Kinderprofil
// erhalten (siehe specialistService.ts::grantSpecialistAccess). Diese lokale
// Admin-Demo ersetzt keine echte Qualifikationsprüfung — siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Später von Fachpersonal zu prüfen".
export async function toggleSpecialistVerifiedAction(specialistProfileId: string): Promise<void> {
  const admin = await requireRole('admin');

  const specialistProfile = await db.specialistProfile.findUniqueOrThrow({
    where: { id: specialistProfileId },
  });
  const verifiedAt = specialistProfile.verifiedAt ? null : new Date();
  await db.specialistProfile.update({ where: { id: specialistProfileId }, data: { verifiedAt } });

  await logAuditEvent({
    actorUserId: admin.id,
    action: 'specialist_profile.toggle_verified',
    targetType: 'SpecialistProfile',
    targetId: specialistProfileId,
    metadata: { verified: verifiedAt !== null },
  });

  revalidatePath('/admin');
}

// Analoge Verifizierung für Lehrkräfte-Profile — eigenständige Rolle neben
// Fachkräften, siehe prisma/schema.prisma. Nur verifizierte Lehrkräfte können
// von Eltern Zugriff auf ein Kinderprofil erhalten (siehe
// teacherService.ts::grantTeacherAccess).
export async function toggleTeacherVerifiedAction(teacherProfileId: string): Promise<void> {
  const admin = await requireRole('admin');

  const teacherProfile = await db.teacherProfile.findUniqueOrThrow({
    where: { id: teacherProfileId },
  });
  const verifiedAt = teacherProfile.verifiedAt ? null : new Date();
  await db.teacherProfile.update({ where: { id: teacherProfileId }, data: { verifiedAt } });

  await logAuditEvent({
    actorUserId: admin.id,
    action: 'teacher_profile.toggle_verified',
    targetType: 'TeacherProfile',
    targetId: teacherProfileId,
    metadata: { verified: verifiedAt !== null },
  });

  revalidatePath('/admin');
}
