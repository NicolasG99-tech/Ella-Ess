import { describe, expect, it } from 'vitest';
import { countDistinctPracticeDays, reachesMilestone } from '@/lib/gamification/milestones';

describe('reachesMilestone', () => {
  it('ist wahr, sobald der Zählerstand die Schwelle erreicht oder überschreitet', () => {
    expect(reachesMilestone(0, 1)).toBe(false);
    expect(reachesMilestone(1, 1)).toBe(true);
    expect(reachesMilestone(5, 1)).toBe(true);
    expect(reachesMilestone(4, 5)).toBe(false);
    expect(reachesMilestone(5, 5)).toBe(true);
  });
});

describe('countDistinctPracticeDays', () => {
  it('zählt mehrere Ereignisse am selben Tag nur einmal', () => {
    const dates = [new Date('2026-07-10T08:00:00.000Z'), new Date('2026-07-10T18:30:00.000Z')];
    expect(countDistinctPracticeDays(dates)).toBe(1);
  });

  it('zählt Ereignisse an unterschiedlichen Tagen einzeln', () => {
    const dates = [
      new Date('2026-07-10T08:00:00.000Z'),
      new Date('2026-07-11T08:00:00.000Z'),
      new Date('2026-07-12T08:00:00.000Z'),
    ];
    expect(countDistinctPracticeDays(dates)).toBe(3);
  });

  it('liefert 0 für eine leere Liste', () => {
    expect(countDistinctPracticeDays([])).toBe(0);
  });
});
