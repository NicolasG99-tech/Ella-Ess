import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import {
  grantTeacherAccess,
  revokeTeacherAccess,
  listActiveGrantsForChild,
  listActiveGrantsForTeacher,
  listFeedbackForChild,
  listFeedbackForGrant,
  submitTeacherFeedback,
  createTeacherFeedbackRequest,
  updateTeacherFeedbackRequestStatus,
  listFeedbackRequestsForGrant,
} from '@/lib/teacher/teacherService';

describe('Lehrkräfte-Zusammenarbeit (teacherService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let verifiedTeacherUserId: string;
  let verifiedTeacherProfileId: string;
  let verifiedTeacherEmail: string;
  let unverifiedTeacherEmail: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');

    const parent = await db.user.create({
      data: { email: `vitest-teacher-parent-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    verifiedTeacherEmail = `vitest-teacher-verified-${suffix}@example.com`;
    const verifiedTeacher = await db.user.create({
      data: {
        email: verifiedTeacherEmail,
        passwordHash,
        role: 'teacher',
        teacherProfile: {
          create: { schoolName: 'Grundschule am Fluss', verifiedAt: new Date() },
        },
      },
      include: { teacherProfile: true },
    });
    verifiedTeacherUserId = verifiedTeacher.id;
    verifiedTeacherProfileId = verifiedTeacher.teacherProfile!.id;

    unverifiedTeacherEmail = `vitest-teacher-unverified-${suffix}@example.com`;
    await db.user.create({
      data: {
        email: unverifiedTeacherEmail,
        passwordHash,
        role: 'teacher',
        teacherProfile: { create: {} },
      },
    });
  });

  afterAll(async () => {
    await db.teacherFeedbackRequest.deleteMany({
      where: { teacherAccessGrant: { childProfileId } },
    });
    await db.teacherFeedback.deleteMany({
      where: { teacherAccessGrant: { childProfileId } },
    });
    await db.teacherAccessGrant.deleteMany({ where: { childProfileId } });
    await db.childProfile.deleteMany({ where: { parentId } });
    await db.user.deleteMany({ where: { id: parentId } });
    await db.user.deleteMany({ where: { id: verifiedTeacherUserId } });
    await db.user.deleteMany({ where: { email: unverifiedTeacherEmail } });
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

  it('lehnt eine Freigabe an eine nicht existente/nicht verifizierte Lehrkraft ab', async () => {
    const notFoundResult = await grantTeacherAccess(
      childProfileId,
      parentId,
      `does-not-exist-${suffix}@example.com`,
    );
    expect(notFoundResult.success).toBe(false);

    const unverifiedResult = await grantTeacherAccess(
      childProfileId,
      parentId,
      unverifiedTeacherEmail,
    );
    expect(unverifiedResult.success).toBe(false);
  });

  it('gewährt einer verifizierten Lehrkraft Zugriff und listet ihn für beide Seiten', async () => {
    const result = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    expect(result.success).toBe(true);

    const parentSideGrants = await listActiveGrantsForChild(childProfileId);
    expect(parentSideGrants).toHaveLength(1);
    expect(parentSideGrants[0].teacherEmail).toBe(verifiedTeacherEmail);

    const teacherSideGrants = await listActiveGrantsForTeacher(verifiedTeacherProfileId);
    expect(teacherSideGrants.some((grant) => grant.id === parentSideGrants[0].id)).toBe(true);
  });

  it('vergibt bei wiederholter Freigabe nicht zweimal Zugriff (idempotent)', async () => {
    const first = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    const second = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);

    expect(first.success && second.success && first.grantId === second.grantId).toBe(true);

    const grants = await listActiveGrantsForChild(childProfileId);
    expect(grants).toHaveLength(1);
  });

  it('entfernt einen widerrufenen Zugriff aus der aktiven Liste', async () => {
    const result = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    await revokeTeacherAccess(childProfileId, result.grantId);

    const grants = await listActiveGrantsForChild(childProfileId);
    expect(grants).toHaveLength(0);
  });

  it('speichert Rückmeldungen und zeigt sie sowohl pro Kind als auch pro Freigabe', async () => {
    const result = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    await submitTeacherFeedback(
      result.grantId,
      verifiedTeacherProfileId,
      'Gute Mitarbeit im Unterricht.',
    );

    const forChild = await listFeedbackForChild(childProfileId);
    expect(forChild).toHaveLength(1);
    expect(forChild[0].note).toContain('Mitarbeit');

    const forGrant = await listFeedbackForGrant(result.grantId);
    expect(forGrant).toHaveLength(1);
  });

  it('erlaubt Eltern, eine Rückmeldung anzufragen, und der Lehrkraft, sie zu schließen', async () => {
    const result = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    const created = await createTeacherFeedbackRequest(
      childProfileId,
      result.grantId,
      parentId,
      'Wie geht es beim Lesen voran?',
    );
    expect(created.success).toBe(true);

    const requests = await listFeedbackRequestsForGrant(result.grantId);
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('open');

    await updateTeacherFeedbackRequestStatus(result.grantId, requests[0].id, 'closed');

    const updatedRequests = await listFeedbackRequestsForGrant(result.grantId);
    expect(updatedRequests[0].status).toBe('closed');
  });

  it('lehnt eine Rückmeldungsanfrage ab, wenn die Freigabe nicht zum angegebenen Kind gehört (IDOR)', async () => {
    const result = await grantTeacherAccess(childProfileId, parentId, verifiedTeacherEmail);
    if (!result.success) throw new Error('Setup fehlgeschlagen');

    const otherChild = await db.childProfile.create({
      data: { parentId, displayName: 'Anderes-Kind', birthYear: 2017 },
    });

    const created = await createTeacherFeedbackRequest(
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
