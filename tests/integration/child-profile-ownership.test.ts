import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';

// Integrationstest gegen die lokale Entwicklungsdatenbank (siehe docker-compose.yml).
// Testet exakt das Zugriffsmuster aus requireOwnChildProfile()
// (lib/server/authz.ts): ein Elternteil darf nur auf eigene Kinderprofile
// zugreifen. auth()/Session lassen sich außerhalb des Next.js-Request-Kontexts
// nicht sinnvoll mocken, daher prüft dieser Test die zugrunde liegende,
// sicherheitskritische Datenbankabfrage direkt.
describe('Kinderprofil-Eigentümerschaft (IDOR-Schutz)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentAId: string;
  let parentBId: string;
  let childOfParentAId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');

    const parentA = await db.user.create({
      data: { email: `vitest-parent-a-${suffix}@example.com`, passwordHash },
    });
    const parentB = await db.user.create({
      data: { email: `vitest-parent-b-${suffix}@example.com`, passwordHash },
    });
    parentAId = parentA.id;
    parentBId = parentB.id;

    const child = await db.childProfile.create({
      data: { parentId: parentAId, displayName: 'Integrationstest-Kind', birthYear: 2017 },
    });
    childOfParentAId = child.id;
  });

  afterAll(async () => {
    await db.childProfile.deleteMany({ where: { parentId: { in: [parentAId, parentBId] } } });
    await db.user.deleteMany({ where: { id: { in: [parentAId, parentBId] } } });
  });

  it('findet das Kinderprofil für den rechtmäßigen Elternteil', async () => {
    const found = await db.childProfile.findFirst({
      where: { id: childOfParentAId, parentId: parentAId },
    });
    expect(found).not.toBeNull();
  });

  it('findet das Kinderprofil NICHT für ein fremdes Elternteil', async () => {
    const found = await db.childProfile.findFirst({
      where: { id: childOfParentAId, parentId: parentBId },
    });
    expect(found).toBeNull();
  });

  it('ein Elternteil sieht in der eigenen Liste nur eigene Kinderprofile', async () => {
    const childrenOfB = await db.childProfile.findMany({ where: { parentId: parentBId } });
    expect(childrenOfB).toHaveLength(0);

    const childrenOfA = await db.childProfile.findMany({ where: { parentId: parentAId } });
    expect(childrenOfA.map((c) => c.id)).toContain(childOfParentAId);
  });
});
