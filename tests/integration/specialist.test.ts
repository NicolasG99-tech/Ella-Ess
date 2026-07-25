import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import {
  grantSpecialistAccess,
  revokeSpecialistAccess,
  listActiveGrantsForChild,
  listActiveGrantsForSpecialist,
  listFeedbackForChild,
  listFeedbackForGrant,
  submitSpecialistFeedback,
  createFeedbackRequest,
  updateFeedbackRequestStatus,
  listFeedbackRequestsForGrant,
} from '@/lib/specialist/specialistService';

describe('Fachkräfte-Zusammenarbeit (specialistService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let verifiedSpecialistUserId: string;
  let verifiedSpecialistProfileId: string;
  let verifiedSpecialistEmail: string;
  let unverifiedSpecialistEmail: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');

    const parent = await db.user.create({
      data: { email: `vitest-specialist-parent-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    verifiedSpecialistEmail = `vitest-specialist-verified-${suffix}@example.com`;
    const verifiedSpecialist = await db.user.create({
      data: {
        email: verifiedSpecialistEmail,
        passwordHash,
        role: 'specialist',
        specialistProfile: {
          create: { credentials: 'Logopädin', verifiedAt: new Date() },
        },
      },
      include: { specialistProfile: true },
    });
    verifiedSpecialistUserId = verifiedSpecialist.id;
    verifiedSpecialistProfileId = verifiedSpecialist.specialistProfile!.id;

    unverifiedSpecialistEmail = `vitest-specialist-unverified-${suffix}@example.com`;
    await db.user.create({
      data: {
        email: unverifiedSpecialistEmail,
        passwordHash,
        role: 'specialist',
        specialistProfile: { create: {} },
      },
    });
  });

  afterAll(async () => {
    await db.feedbackRequest.deleteMany({
      where: { childAccessGrant: { childProfileId } },
    });
    await db.specialistFeedback.deleteMany({
      where: { childAccessGrant: { childProfileId } },
    });
    await db.childAccessGrant.deleteMany({ where: { childProfileId } });
    await db.childProfile.deleteMany({ where: { parentId } });
    await db.user.deleteMany({ where: { id: parentId } });
    await db.user.deleteMany({ where: { id: verifiedSpecialistUserId } });
    await db.user.deleteMany({ where: { email: unverifiedSpecialistEmail } });
  });

  beforeEach(async () => {
    const child = await db.childProfile.create({
      data: {
        parentId,
        displayName: `IT-Kind-${Math.random().toString(36).slice(2)}`,
        birthYear: 2017,
      },
    });
    childProfileId = child.id;
  });

  it('lehnt eine Freigabe an eine nicht existente/nicht verifizierte Fachkraft ab', async () => {
    const notFoundResult = await grantSpecialistAccess(
      childProfileId,
      parentId,
      `does-not-exist-${suffix}@example.com`,
    );
    expect(notFoundResult.success).toBe(false);

    const unverifiedResult = await grantSpecialistAccess(
      childProfileId,
      parentId,
      unverifiedSpecialistEmail,
    );
    expect(unverifiedResult.success).toBe(false);
  });

  it('gewährt einer verifizierten Fachkraft Zugriff und listet ihn für beide Seiten', async () => {
    const result = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    expect(result.success).toBe(true);

    const parentSideGrants = await listActiveGrantsForChild(childProfileId);
    expect(parentSideGrants).toHaveLength(1);
    expect(parentSideGrants[0].specialistEmail).toBe(verifiedSpecialistEmail);

    const specialistSideGrants = await listActiveGrantsForSpecialist(verifiedSpecialistProfileId);
    expect(specialistSideGrants.some((grant) => grant.id === parentSideGrants[0].id)).toBe(true);
  });

  it('vergibt bei wiederholter Freigabe nicht zweimal Zugriff (idempotent)', async () => {
    const first = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    const second = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);

    expect(first.success && second.success && first.grantId === second.grantId).toBe(true);

    const grants = await listActiveGrantsForChild(childProfileId);
    expect(grants).toHaveLength(1);
  });

  it('entfernt einen widerrufenen Zugriff aus der aktiven Liste', async () => {
    const result = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    await revokeSpecialistAccess(childProfileId, result.grantId);

    const grants = await listActiveGrantsForChild(childProfileId);
    expect(grants).toHaveLength(0);
  });

  it('speichert Rückmeldungen und zeigt sie sowohl pro Kind als auch pro Freigabe', async () => {
    const result = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    await submitSpecialistFeedback(
      result.grantId,
      verifiedSpecialistProfileId,
      'Gute Fortschritte beim Silben erkennen.',
    );

    const forChild = await listFeedbackForChild(childProfileId);
    expect(forChild).toHaveLength(1);
    expect(forChild[0].note).toContain('Silben');

    const forGrant = await listFeedbackForGrant(result.grantId);
    expect(forGrant).toHaveLength(1);
  });

  it('erlaubt Eltern, eine Rückmeldung anzufragen, und der Fachkraft, sie zu schließen', async () => {
    const result = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    const created = await createFeedbackRequest(
      childProfileId,
      result.grantId,
      parentId,
      'Wie geht es beim Lesen voran?',
    );
    expect(created.success).toBe(true);

    const requests = await listFeedbackRequestsForGrant(result.grantId);
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('open');

    await updateFeedbackRequestStatus(result.grantId, requests[0].id, 'closed');

    const updatedRequests = await listFeedbackRequestsForGrant(result.grantId);
    expect(updatedRequests[0].status).toBe('closed');
  });

  it('lehnt eine Rückmeldungsanfrage ab, wenn die Freigabe nicht zum angegebenen Kind gehört (IDOR)', async () => {
    const result = await grantSpecialistAccess(childProfileId, parentId, verifiedSpecialistEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    const otherChild = await db.childProfile.create({
      data: { parentId, displayName: 'Anderes-Kind', birthYear: 2017 },
    });

    const created = await createFeedbackRequest(
      otherChild.id,
      result.grantId,
      parentId,
      'Sollte nicht funktionieren',
    );
    expect(created.success).toBe(false);

    const requests = await listFeedbackRequestsForGrant(result.grantId);
    expect(requests).toHaveLength(0);

    await db.childProfile.delete({ where: { id: otherChild.id } });
  });
});
