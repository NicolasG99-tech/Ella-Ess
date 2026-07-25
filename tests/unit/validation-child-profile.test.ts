import { describe, expect, it } from 'vitest';
import { childProfileSchema } from '@/lib/validation/child-profile';

const currentYear = new Date().getFullYear();

describe('childProfileSchema', () => {
  it('akzeptiert ein plausibles Geburtsjahr für die Zielgruppe (7–10 Jahre)', () => {
    const result = childProfileSchema.safeParse({
      displayName: 'Mia',
      birthYear: currentYear - 8,
    });
    expect(result.success).toBe(true);
  });

  it('lehnt ein unplausibel junges Geburtsjahr ab', () => {
    const result = childProfileSchema.safeParse({
      displayName: 'Mia',
      birthYear: currentYear - 1,
    });
    expect(result.success).toBe(false);
  });

  it('lehnt ein unplausibel altes Geburtsjahr ab', () => {
    const result = childProfileSchema.safeParse({
      displayName: 'Mia',
      birthYear: currentYear - 20,
    });
    expect(result.success).toBe(false);
  });

  it('lehnt einen leeren Namen ab', () => {
    const result = childProfileSchema.safeParse({
      displayName: '   ',
      birthYear: currentYear - 8,
    });
    expect(result.success).toBe(false);
  });

  it('lehnt einen unbekannten Avatar-Key ab', () => {
    const result = childProfileSchema.safeParse({
      displayName: 'Mia',
      birthYear: currentYear - 8,
      avatarKey: 'nicht-existent',
    });
    expect(result.success).toBe(false);
  });

  it('setzt avatar-01 als Standard, wenn kein Avatar gewählt wurde', () => {
    const result = childProfileSchema.safeParse({
      displayName: 'Mia',
      birthYear: currentYear - 8,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarKey).toBe('avatar-01');
    }
  });
});
