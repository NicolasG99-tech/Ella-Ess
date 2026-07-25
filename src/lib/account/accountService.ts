import { db } from '@/lib/server/db';
import { logAuditEvent } from '@/lib/server/audit';

// Löscht ein Konto endgültig und schreibt zuvor einen Audit-Eintrag. Bewusst
// als Service (nicht nur in der Server Action), damit die kontoübergreifende
// Löschung inkl. Prüfpfad ohne Request-Kontext integrationstestbar ist. Die
// Kaskade (siehe prisma/schema.prisma, onDelete: Cascade) entfernt alle
// Kinderprofile, Fach-/Lehrkräfte-Profile und deren Freigaben/Rückmeldungen.
//
// Reihenfolge ist wichtig: Der Audit-Eintrag wird VOR dem Löschen geschrieben,
// solange die actorUserId-Fremdschlüsselbeziehung noch gültig ist. Beim
// anschließenden Löschen wird actorUserId per onDelete: SetNull genullt, das
// action/targetType/targetId-Trio bleibt jedoch als revisionssicherer Nachweis
// der Löschung erhalten (targetId ist ein reines String-Feld ohne FK).
export async function deleteAccount(userId: string): Promise<void> {
  await logAuditEvent({
    actorUserId: userId,
    action: 'user.delete_account',
    targetType: 'User',
    targetId: userId,
  });

  await db.user.delete({ where: { id: userId } });
}

// Datenexport für das Auskunftsrecht (DSGVO Art. 15) — sammelt alle Daten, die
// direkt einem Konto zugeordnet sind. Bewusst rollenunabhängig (Eltern und
// Fachkräfte haben unterschiedliche Datenmengen, aber dieselbe Anfrage).
export async function gatherAccountData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const consentRecords = await db.consentRecord.findMany({
    where: { userId },
    select: { type: true, version: true, acceptedAt: true },
  });

  const childProfiles = await db.childProfile.findMany({
    where: { parentId: userId },
    select: {
      displayName: true,
      birthYear: true,
      createdAt: true,
      currentLearningProfile: { select: { name: true } },
      skillProgress: {
        select: {
          masteryLevel: true,
          lastPracticedAt: true,
          literacySkill: { select: { name: true } },
        },
      },
      earnedRewards: {
        select: { earnedAt: true, reward: { select: { code: true, name: true } } },
      },
      readingSessions: {
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          story: { select: { title: true } },
        },
      },
      spellingAttempts: {
        select: {
          attemptNumber: true,
          isCorrect: true,
          submittedAnswer: true,
          createdAt: true,
          exerciseItem: { select: { prompt: true } },
        },
      },
    },
  });

  const specialistProfile = await db.specialistProfile.findUnique({
    where: { userId },
    select: {
      credentials: true,
      verifiedAt: true,
      createdAt: true,
      accessGrants: {
        select: {
          createdAt: true,
          revokedAt: true,
          childProfile: { select: { displayName: true } },
        },
      },
      feedback: { select: { note: true, createdAt: true } },
    },
  });

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId },
    select: {
      schoolName: true,
      verifiedAt: true,
      createdAt: true,
      accessGrants: {
        select: {
          createdAt: true,
          revokedAt: true,
          childProfile: { select: { displayName: true } },
        },
      },
      feedback: { select: { note: true, createdAt: true } },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    user,
    consentRecords,
    childProfiles: childProfiles.length > 0 ? childProfiles : undefined,
    specialistProfile: specialistProfile ?? undefined,
    teacherProfile: teacherProfile ?? undefined,
  };
}
