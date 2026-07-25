import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import {
  startOrResumeReadingSession,
  submitReadingAttempt,
} from '@/lib/reading/readingSessionService';

// Integrationstest für die Illustrationsfreischaltung (Meilenstein 5) gegen
// die per Seed eingespielte Geschichte "pieks-sucht-ein-zuhause" (4
// Abschnitte, 5 Illustrationsebenen: background/main_character nach
// Abschnitt 0, object nach Abschnitt 1, secondary_character nach Abschnitt 2,
// final_scene nach Abschnitt 3).
describe('Illustrationsfreischaltung', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let storySlug: string;
  let totalLayers: number;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-illustration-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const story = await db.story.findFirstOrThrow({
      where: { slug: 'pieks-sucht-ein-zuhause' },
      include: { illustrationLayers: true },
    });
    storySlug = story.slug;
    totalLayers = story.illustrationLayers.length;
  });

  afterAll(async () => {
    await db.unlockedIllustration.deleteMany({
      where: { readingSession: { childProfileId } },
    });
    await db.wordEvaluation.deleteMany({
      where: { readingAttempt: { readingSession: { childProfileId } } },
    });
    await db.readingAttempt.deleteMany({ where: { readingSession: { childProfileId } } });
    await db.readingSession.deleteMany({ where: { childProfileId } });
    await db.childProfile.deleteMany({ where: { parentId } });
    await db.user.deleteMany({ where: { id: parentId } });
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

  it('startet ohne freigeschaltete Illustrationen', async () => {
    const result = await startOrResumeReadingSession(childProfileId, storySlug, parentId);
    expect(result.unlockedIllustrations).toEqual([]);
  });

  it('schaltet nach dem ersten Abschnitt genau die dafür vorgesehenen Ebenen frei', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    const result = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'correct',
    });

    const names = result.newlyUnlockedIllustrations.map((layer) => layer.name).sort();
    expect(names).toEqual(['background', 'main_character']);

    const stored = await db.unlockedIllustration.findMany({
      where: { readingSessionId: sessionId },
    });
    expect(stored).toHaveLength(2);
  });

  it('schaltet über die ganze Geschichte hinweg kumulativ alle Ebenen frei, in der richtigen Reihenfolge', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    const unlockedPerSection: string[][] = [];
    for (let section = 0; section < 4; section += 1) {
      const result = await submitReadingAttempt({
        sessionId,
        childProfileId,
        sectionOrder: section,
        localPosition: 0,
        retryCount: 0,
        forcedScenario: 'correct',
      });
      unlockedPerSection.push(result.newlyUnlockedIllustrations.map((l) => l.name).sort());
    }

    expect(unlockedPerSection[0]).toEqual(['background', 'main_character']);
    expect(unlockedPerSection[1]).toEqual(['object']);
    expect(unlockedPerSection[2]).toEqual(['secondary_character']);
    expect(unlockedPerSection[3]).toEqual(['final_scene']);

    const stored = await db.unlockedIllustration.findMany({
      where: { readingSessionId: sessionId },
    });
    expect(stored).toHaveLength(totalLayers);
  });

  it('schaltet eine bereits freigeschaltete Ebene nicht doppelt frei (idempotent)', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'correct',
    });

    // Fortsetzen einer aktiven Sitzung ruft erneut startOrResumeReadingSession auf
    // (z.B. nach einer Pause) — die bereits freigeschalteten Ebenen dürfen dabei
    // nicht erneut als "neu" gemeldet oder doppelt gespeichert werden.
    const resumed = await startOrResumeReadingSession(childProfileId, storySlug, parentId);
    expect(resumed.unlockedIllustrations.map((l) => l.name).sort()).toEqual([
      'background',
      'main_character',
    ]);

    const stored = await db.unlockedIllustration.findMany({
      where: { readingSessionId: sessionId },
    });
    expect(stored).toHaveLength(2);
  });

  it('schaltet unabhängig von der Anzahl der Versuche/verstrichener Zeit frei, nicht anhand der Lesegeschwindigkeit', async () => {
    // Ein Kind, das für Abschnitt 0 drei Versuche braucht (Wiederholungen),
    // muss am Ende dieselben Ebenen freigeschaltet bekommen wie eines, das ihn
    // sofort schafft — die Freischaltung hängt am Erreichen der Position, nicht
    // an Tempo oder Versuchsanzahl.
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    let retryCount = 0;
    let unlocked: string[] = [];
    for (const scenario of ['possible_error', 'possible_error', 'correct'] as const) {
      const result = await submitReadingAttempt({
        sessionId,
        childProfileId,
        sectionOrder: 0,
        localPosition: 0,
        retryCount,
        forcedScenario: scenario,
      });
      retryCount = result.retryCount;
      if (result.newlyUnlockedIllustrations.length > 0) {
        unlocked = result.newlyUnlockedIllustrations.map((l) => l.name).sort();
      }
    }

    expect(unlocked).toEqual(['background', 'main_character']);
  });
});
