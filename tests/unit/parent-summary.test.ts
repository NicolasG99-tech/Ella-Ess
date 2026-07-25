import { describe, expect, it } from 'vitest';
import { buildParentFriendlySummary } from '@/lib/progress/parentSummary';
import type { ChildProgressOverview } from '@/lib/progress/parentDashboardService';

function baseOverview(overrides: Partial<ChildProgressOverview> = {}): ChildProgressOverview {
  return {
    masteryGroups: [],
    recentSessions: [],
    completedSessionCount: 0,
    completedExerciseCount: 0,
    distinctPracticeDays: 0,
    comprehensionFirstTryCorrect: 0,
    comprehensionFirstTryTotal: 0,
    firstActivityAt: null,
    ...overrides,
  };
}

const NOW = new Date('2026-07-17T12:00:00Z');

describe('buildParentFriendlySummary', () => {
  it('meldet fehlende Aktivität ohne jegliche Übungsdaten', () => {
    const summary = buildParentFriendlySummary('Mila', baseOverview(), NOW);

    expect(summary.startedText).toBeNull();
    expect(summary.nowText).toContain('Noch keine Übungsdaten');
    expect(summary.attentionFlags).toEqual([]);
  });

  it('beschreibt den Startzeitpunkt anhand der ersten Aktivität', () => {
    const summary = buildParentFriendlySummary(
      'Mila',
      baseOverview({ firstActivityAt: new Date('2026-05-01T00:00:00Z') }),
      NOW,
    );

    expect(summary.startedText).toContain('01.05.2026');
    expect(summary.startedText).toContain('Mila');
  });

  it('erkennt, wenn alle geübten Bereiche sicher sind', () => {
    const summary = buildParentFriendlySummary(
      'Mila',
      baseOverview({
        masteryGroups: [
          {
            learningProfileName: 'Lesegrundlagen',
            skills: [
              {
                skillName: 'Buchstaben erkennen',
                masteryLevel: 0.8,
                label: 'Sicher',
                lastPracticedAt: NOW,
              },
            ],
          },
        ],
      }),
      NOW,
    );

    expect(summary.nowText).toContain('in allen geübten Bereichen');
    expect(summary.attentionFlags).toEqual([]);
  });

  it('markiert Bereiche mit niedrigem Beherrschungsgrad als Achtungspunkt', () => {
    const summary = buildParentFriendlySummary(
      'Mila',
      baseOverview({
        masteryGroups: [
          {
            learningProfileName: 'Lesegrundlagen',
            skills: [
              {
                skillName: 'Silben verbinden',
                masteryLevel: 0.1,
                label: 'Wird geübt',
                lastPracticedAt: NOW,
              },
            ],
          },
        ],
      }),
      NOW,
    );

    expect(summary.attentionFlags).toHaveLength(1);
    expect(summary.attentionFlags[0].skillName).toBe('Silben verbinden');
  });

  it('markiert lange nicht geübte, aber ansonsten sichere Bereiche als Achtungspunkt', () => {
    const longAgo = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
    const summary = buildParentFriendlySummary(
      'Mila',
      baseOverview({
        masteryGroups: [
          {
            learningProfileName: 'Lesegrundlagen',
            skills: [
              {
                skillName: 'Reimwörter',
                masteryLevel: 0.9,
                label: 'Sicher',
                lastPracticedAt: longAgo,
              },
            ],
          },
        ],
      }),
      NOW,
    );

    expect(summary.attentionFlags).toHaveLength(1);
    expect(summary.attentionFlags[0].reason).toContain('20 Tagen');
  });

  it('markiert eine niedrige Verständnis-Trefferquote als Achtungspunkt', () => {
    const summary = buildParentFriendlySummary(
      'Mila',
      baseOverview({ comprehensionFirstTryCorrect: 1, comprehensionFirstTryTotal: 5 }),
      NOW,
    );

    expect(summary.attentionFlags.some((flag) => flag.skillName === 'Leseverständnis')).toBe(true);
  });
});
