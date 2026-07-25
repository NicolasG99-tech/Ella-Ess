import { db } from '@/lib/server/db';
import type { FeedbackRequestStatus } from '@/generated/prisma/enums';

// Orchestrierungsschicht für die Fachkräfte-Zusammenarbeit (Meilenstein 9),
// getrennt von der Server-Action-Hülle, damit sie ohne Next.js-Request-Kontext
// direkt integrationstestbar ist (siehe readingSessionService.ts für dasselbe
// Muster). WICHTIG — rechtlicher Rahmen: Diese Funktionen erlauben
// ausschließlich das Austauschen freier Textnotizen auf Basis der in der App
// sichtbaren Übungsdaten. Keine Diagnosefunktion, keine Therapieplanung,
// keine Video-/Audiokommunikation — siehe docs/EDUCATIONAL_MODEL.md, Abschnitt
// "Fachkräfte-Zusammenarbeit" und docs/SECURITY.md für den noch ausstehenden
// berufsrechtlichen/rechtlichen Prüfbedarf vor einem echten Einsatz.

export type GrantAccessResult =
  { success: true; grantId: string } | { success: false; error: string };

export async function grantSpecialistAccess(
  childProfileId: string,
  grantedByUserId: string,
  specialistEmail: string,
): Promise<GrantAccessResult> {
  const specialistUser = await db.user.findUnique({
    where: { email: specialistEmail },
    include: { specialistProfile: true },
  });

  if (
    !specialistUser ||
    specialistUser.role !== 'specialist' ||
    !specialistUser.specialistProfile ||
    !specialistUser.specialistProfile.verifiedAt
  ) {
    return {
      success: false,
      error: 'Keine verifizierte Fachkraft mit dieser E-Mail-Adresse gefunden.',
    };
  }

  const specialistProfileId = specialistUser.specialistProfile.id;

  const existingActiveGrant = await db.childAccessGrant.findFirst({
    where: {
      childProfileId,
      specialistProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (existingActiveGrant) {
    return { success: true, grantId: existingActiveGrant.id };
  }

  const grant = await db.childAccessGrant.create({
    data: {
      childProfileId,
      specialistProfileId,
      grantedByUserId,
      scope: { view: 'progress_overview' },
    },
  });

  return { success: true, grantId: grant.id };
}

export async function revokeSpecialistAccess(
  childProfileId: string,
  childAccessGrantId: string,
): Promise<void> {
  await db.childAccessGrant.updateMany({
    where: { id: childAccessGrantId, childProfileId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface ActiveGrantSummary {
  id: string;
  specialistName: string | null;
  specialistEmail: string;
  credentials: string | null;
  createdAt: Date;
}

export async function listActiveGrantsForChild(
  childProfileId: string,
): Promise<ActiveGrantSummary[]> {
  const grants = await db.childAccessGrant.findMany({
    where: {
      childProfileId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { specialistProfile: { include: { user: true } } },
  });

  return grants.map((grant) => ({
    id: grant.id,
    specialistName: grant.specialistProfile.user.name,
    specialistEmail: grant.specialistProfile.user.email,
    credentials: grant.specialistProfile.credentials,
    createdAt: grant.createdAt,
  }));
}

export interface SpecialistFeedbackEntry {
  id: string;
  note: string;
  authorName: string | null;
  authorCredentials: string | null;
  createdAt: Date;
}

export async function listFeedbackForChild(
  childProfileId: string,
): Promise<SpecialistFeedbackEntry[]> {
  const feedback = await db.specialistFeedback.findMany({
    where: { childAccessGrant: { childProfileId } },
    orderBy: { createdAt: 'desc' },
    include: { authorProfile: { include: { user: true } } },
  });

  return feedback.map((entry) => ({
    id: entry.id,
    note: entry.note,
    authorName: entry.authorProfile.user.name,
    authorCredentials: entry.authorProfile.credentials,
    createdAt: entry.createdAt,
  }));
}

export interface SpecialistGrantOverview {
  id: string;
  childDisplayName: string;
  createdAt: Date;
}

export async function listActiveGrantsForSpecialist(
  specialistProfileId: string,
): Promise<SpecialistGrantOverview[]> {
  const grants = await db.childAccessGrant.findMany({
    where: {
      specialistProfileId,
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

export interface FeedbackRequestSummary {
  id: string;
  message: string | null;
  status: FeedbackRequestStatus;
  createdAt: Date;
}

export async function listFeedbackRequestsForGrant(
  childAccessGrantId: string,
): Promise<FeedbackRequestSummary[]> {
  const requests = await db.feedbackRequest.findMany({
    where: { childAccessGrantId },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((request) => ({
    id: request.id,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
  }));
}

export interface GrantFeedbackEntry {
  id: string;
  note: string;
  createdAt: Date;
}

export async function listFeedbackForGrant(
  childAccessGrantId: string,
): Promise<GrantFeedbackEntry[]> {
  const feedback = await db.specialistFeedback.findMany({
    where: { childAccessGrantId },
    orderBy: { createdAt: 'desc' },
  });
  return feedback.map((entry) => ({ id: entry.id, note: entry.note, createdAt: entry.createdAt }));
}

export async function submitSpecialistFeedback(
  childAccessGrantId: string,
  authorProfileId: string,
  note: string,
): Promise<void> {
  await db.specialistFeedback.create({
    data: { childAccessGrantId, authorProfileId, note },
  });
}

export type CreateFeedbackRequestResult = { success: true } | { success: false; error: string };

// Prüft die Zugehörigkeit von childAccessGrantId zu childProfileId selbst
// (statt sich auf die aufrufende Server Action zu verlassen) — verhindert,
// dass ein Elternteil eine Anfrage gegen die Freigabe eines fremden Kindes
// erstellt (IDOR).
export async function createFeedbackRequest(
  childProfileId: string,
  childAccessGrantId: string,
  requestedByUserId: string,
  message: string | undefined,
): Promise<CreateFeedbackRequestResult> {
  const grant = await db.childAccessGrant.findFirst({
    where: { id: childAccessGrantId, childProfileId },
  });
  if (!grant) {
    return { success: false, error: 'Freigabe nicht gefunden.' };
  }

  await db.feedbackRequest.create({
    data: { childAccessGrantId, requestedByUserId, message },
  });
  return { success: true };
}

export async function updateFeedbackRequestStatus(
  childAccessGrantId: string,
  feedbackRequestId: string,
  status: FeedbackRequestStatus,
): Promise<void> {
  await db.feedbackRequest.updateMany({
    where: { id: feedbackRequestId, childAccessGrantId },
    data: { status },
  });
}
