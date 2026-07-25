import { db } from '@/lib/server/db';
import type { FeedbackRequestStatus } from '@/generated/prisma/enums';

// Orchestrierungsschicht für die Lehrkräfte-Zusammenarbeit, strukturell
// identisch zu specialistService.ts (Meilenstein 9), aber ein eigenständiges
// Modell (TeacherProfile/TeacherAccessGrant/TeacherFeedback) statt
// Wiederverwendung der Fachkräfte-Tabellen — siehe prisma/schema.prisma.
// Getrennt von der Server-Action-Hülle, damit sie ohne Next.js-Request-Kontext
// direkt integrationstestbar ist. WICHTIG — rechtlicher Rahmen: Diese
// Funktionen erlauben ausschließlich das Austauschen freier Textnotizen auf
// Basis der in der App sichtbaren Übungsdaten. Keine Diagnose, keine
// Notenvergabe, keine Video-/Audiokommunikation — siehe
// docs/EDUCATIONAL_MODEL.md und docs/SECURITY.md für den noch ausstehenden
// berufsrechtlichen/rechtlichen Prüfbedarf vor einem echten Einsatz.

export type GrantAccessResult =
  { success: true; grantId: string } | { success: false; error: string };

export async function grantTeacherAccess(
  childProfileId: string,
  grantedByUserId: string,
  teacherEmail: string,
): Promise<GrantAccessResult> {
  const teacherUser = await db.user.findUnique({
    where: { email: teacherEmail },
    include: { teacherProfile: true },
  });

  if (
    !teacherUser ||
    teacherUser.role !== 'teacher' ||
    !teacherUser.teacherProfile ||
    !teacherUser.teacherProfile.verifiedAt
  ) {
    return {
      success: false,
      error: 'Keine verifizierte Lehrkraft mit dieser E-Mail-Adresse gefunden.',
    };
  }

  const teacherProfileId = teacherUser.teacherProfile.id;

  const existingActiveGrant = await db.teacherAccessGrant.findFirst({
    where: {
      childProfileId,
      teacherProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (existingActiveGrant) {
    return { success: true, grantId: existingActiveGrant.id };
  }

  const grant = await db.teacherAccessGrant.create({
    data: {
      childProfileId,
      teacherProfileId,
      grantedByUserId,
      scope: { view: 'progress_overview' },
    },
  });

  return { success: true, grantId: grant.id };
}

export async function revokeTeacherAccess(
  childProfileId: string,
  teacherAccessGrantId: string,
): Promise<void> {
  await db.teacherAccessGrant.updateMany({
    where: { id: teacherAccessGrantId, childProfileId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface ActiveTeacherGrantSummary {
  id: string;
  teacherName: string | null;
  teacherEmail: string;
  schoolName: string | null;
  createdAt: Date;
}

export async function listActiveGrantsForChild(
  childProfileId: string,
): Promise<ActiveTeacherGrantSummary[]> {
  const grants = await db.teacherAccessGrant.findMany({
    where: {
      childProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { teacherProfile: { include: { user: true } } },
  });

  return grants.map((grant) => ({
    id: grant.id,
    teacherName: grant.teacherProfile.user.name,
    teacherEmail: grant.teacherProfile.user.email,
    schoolName: grant.teacherProfile.schoolName,
    createdAt: grant.createdAt,
  }));
}

export interface TeacherFeedbackEntry {
  id: string;
  note: string;
  authorName: string | null;
  authorSchoolName: string | null;
  createdAt: Date;
}

export async function listFeedbackForChild(
  childProfileId: string,
): Promise<TeacherFeedbackEntry[]> {
  const feedback = await db.teacherFeedback.findMany({
    where: { teacherAccessGrant: { childProfileId } },
    orderBy: { createdAt: 'desc' },
    include: { authorProfile: { include: { user: true } } },
  });

  return feedback.map((entry) => ({
    id: entry.id,
    note: entry.note,
    authorName: entry.authorProfile.user.name,
    authorSchoolName: entry.authorProfile.schoolName,
    createdAt: entry.createdAt,
  }));
}

export interface TeacherGrantOverview {
  id: string;
  childDisplayName: string;
  createdAt: Date;
}

export async function listActiveGrantsForTeacher(
  teacherProfileId: string,
): Promise<TeacherGrantOverview[]> {
  const grants = await db.teacherAccessGrant.findMany({
    where: {
      teacherProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { childProfile: { select: { displayName: true } } },
  });

  return grants.map((grant) => ({
    id: grant.id,
    childDisplayName: grant.childProfile.displayName,
    createdAt: grant.createdAt,
  }));
}

export interface TeacherFeedbackRequestSummary {
  id: string;
  message: string | null;
  status: FeedbackRequestStatus;
  createdAt: Date;
}

export async function listFeedbackRequestsForGrant(
  teacherAccessGrantId: string,
): Promise<TeacherFeedbackRequestSummary[]> {
  const requests = await db.teacherFeedbackRequest.findMany({
    where: { teacherAccessGrantId },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((request) => ({
    id: request.id,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
  }));
}

export interface TeacherGrantFeedbackEntry {
  id: string;
  note: string;
  createdAt: Date;
}

export async function listFeedbackForGrant(
  teacherAccessGrantId: string,
): Promise<TeacherGrantFeedbackEntry[]> {
  const feedback = await db.teacherFeedback.findMany({
    where: { teacherAccessGrantId },
    orderBy: { createdAt: 'desc' },
  });
  return feedback.map((entry) => ({ id: entry.id, note: entry.note, createdAt: entry.createdAt }));
}

export async function submitTeacherFeedback(
  teacherAccessGrantId: string,
  authorProfileId: string,
  note: string,
): Promise<void> {
  await db.teacherFeedback.create({
    data: { teacherAccessGrantId, authorProfileId, note },
  });
}

export type CreateTeacherFeedbackRequestResult =
  { success: true } | { success: false; error: string };

// Prüft die Zugehörigkeit von teacherAccessGrantId zu childProfileId selbst
// (statt sich auf die aufrufende Server Action zu verlassen) — verhindert,
// dass ein Elternteil eine Anfrage gegen die Freigabe eines fremden Kindes
// erstellt (IDOR).
export async function createTeacherFeedbackRequest(
  childProfileId: string,
  teacherAccessGrantId: string,
  requestedByUserId: string,
  message: string | undefined,
): Promise<CreateTeacherFeedbackRequestResult> {
  const grant = await db.teacherAccessGrant.findFirst({
    where: { id: teacherAccessGrantId, childProfileId },
  });
  if (!grant) {
    return { success: false, error: 'Freigabe nicht gefunden.' };
  }

  await db.teacherFeedbackRequest.create({
    data: { teacherAccessGrantId, requestedByUserId, message },
  });
  return { success: true };
}

export async function updateTeacherFeedbackRequestStatus(
  teacherAccessGrantId: string,
  feedbackRequestId: string,
  status: FeedbackRequestStatus,
): Promise<void> {
  await db.teacherFeedbackRequest.updateMany({
    where: { id: feedbackRequestId, teacherAccessGrantId },
    data: { status },
  });
}
