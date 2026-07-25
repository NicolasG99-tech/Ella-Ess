import { describe, expect, it } from 'vitest';
import { describeMasteryLevel } from '@/lib/progress/masteryLevelLabel';

describe('describeMasteryLevel', () => {
  it('beschreibt niedrige Werte als "Wird geübt"', () => {
    expect(describeMasteryLevel(0)).toBe('Wird geübt');
    expect(describeMasteryLevel(0.33)).toBe('Wird geübt');
  });

  it('beschreibt mittlere Werte als "Wird sicherer"', () => {
    expect(describeMasteryLevel(0.34)).toBe('Wird sicherer');
    expect(describeMasteryLevel(0.66)).toBe('Wird sicherer');
  });

  it('beschreibt hohe Werte als "Sicher"', () => {
    expect(describeMasteryLevel(0.67)).toBe('Sicher');
    expect(describeMasteryLevel(1)).toBe('Sicher');
  });
});
