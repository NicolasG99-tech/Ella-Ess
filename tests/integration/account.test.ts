import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { deleteAccount, gatherAccountData } from '@/lib/account/accountService';

describe('Konto (accountService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  const parentEmail = `vitest-account-${suffix}@example.com`;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: {
        email: parentEmail,
        passwordHash,
        consentRecords: { create: [{ type: 'terms_of_service', version: '2026-07-15' }] },
      },
    });
    parentId = parent.id;

    await db.childProfile.create({
      data: { parentId, displayName: 'IT-Export-Kind', birthYear: 2017 },
    });
  });

  afterAll(async () => {
    // Konto wird im Löschtest bereits entfernt; hier nur zur Sicherheit,
    // falls ein Testfall vor dem Löschen fehlschlägt.
    await db.user.deleteMany({ where: { id: parentId } });
  });

  it('liefert Stammdaten, Einwilligungen und Kinderprofile im Export', async () => {
    const data = await gatherAccountData(parentId);

    expect(data.user.email).toBe(parentEmail);
    expect(data.consentRecords).toHaveLength(1);
    expect(data.childProfiles).toHaveLength(1);
    expect(data.childProfiles?.[0].displayName).toBe('IT-Export-Kind');
    expect(data.specialistProfile).toBeUndefined();
  });

  it('löscht beim Entfernen des Kontos automatisch alle Kinderprofile (Kaskade) und protokolliert die Löschung', async () => {
    const child = await db.childProfile.findFirstOrThrow({ where: { parentId } });

    await deleteAccount(parentId);

    const remainingChild = await db.childProfile.findUnique({ where: { id: child.id } });
    expect(remainingChild).toBeNull();

    const remainingUser = await db.user.findUnique({ where: { id: parentId } });
    expect(remainingUser).toBeNull();

    // Revisionssicherer Nachweis der Löschung überlebt das Entfernen des
    // Kontos: actorUserId wird per onDelete: SetNull genullt, action/targetId
    // bleiben erhalten.
    const auditEvent = await db.auditEvent.findFirst({
      where: { action: 'user.delete_account', targetId: parentId },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.actorUserId).toBeNull();

    // Aufräumen: der zurückgebliebene Prüfpfad-Eintrag würde sonst akkumulieren.
    if (auditEvent) {
      await db.auditEvent.delete({ where: { id: auditEvent.id } });
    }
  });
});
