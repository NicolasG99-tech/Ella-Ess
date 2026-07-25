import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/server/password';

describe('password hashing', () => {
  it('verifiziert das richtige Passwort gegen seinen Hash', async () => {
    const hash = await hashPassword('SicheresTestPasswort123');
    await expect(verifyPassword(hash, 'SicheresTestPasswort123')).resolves.toBe(true);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const hash = await hashPassword('SicheresTestPasswort123');
    await expect(verifyPassword(hash, 'FalschesPasswort')).resolves.toBe(false);
  });

  it('erzeugt für dasselbe Passwort unterschiedliche Hashes (Salt)', async () => {
    const [hashA, hashB] = await Promise.all([
      hashPassword('SicheresTestPasswort123'),
      hashPassword('SicheresTestPasswort123'),
    ]);
    expect(hashA).not.toBe(hashB);
  });
});
