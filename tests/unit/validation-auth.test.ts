import { describe, expect, it } from 'vitest';
import { loginSchema, passwordSchema, registerSchema } from '@/lib/validation/auth';

describe('passwordSchema', () => {
  it('lehnt zu kurze Passwörter ab', () => {
    expect(passwordSchema.safeParse('kurz123').success).toBe(false);
  });

  it('akzeptiert ein 10-stelliges Passwort', () => {
    expect(passwordSchema.safeParse('1234567890').success).toBe(true);
  });
});

describe('registerSchema', () => {
  const base = {
    email: 'eltern@example.com',
    password: 'sicheresPasswort1',
    acceptedTerms: true,
    acceptedPrivacy: true,
  };

  it('akzeptiert gültige Eingaben', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('normalisiert die E-Mail-Adresse auf Kleinbuchstaben', () => {
    const result = registerSchema.safeParse({ ...base, email: 'Eltern@Example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('eltern@example.com');
    }
  });

  it('lehnt fehlende Zustimmung zu den Nutzungsbedingungen ab', () => {
    const result = registerSchema.safeParse({ ...base, acceptedTerms: false });
    expect(result.success).toBe(false);
  });

  it('lehnt fehlende Zustimmung zur Datenschutzerklärung ab', () => {
    const result = registerSchema.safeParse({ ...base, acceptedPrivacy: false });
    expect(result.success).toBe(false);
  });

  it('lehnt eine ungültige E-Mail-Adresse ab', () => {
    const result = registerSchema.safeParse({ ...base, email: 'keine-email' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('lehnt ein leeres Passwort ab', () => {
    const result = loginSchema.safeParse({ email: 'eltern@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});
