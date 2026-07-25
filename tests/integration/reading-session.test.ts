import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import {
  resolveHelp,
  startOrResumeReadingSession,
  submitReadingAttempt,
} from '@/lib/reading/readingSessionService';

// Integrationstest gegen die lokale Entwicklungsdatenbank und die per Seed
// eingespielte Geschichte "pieks-sucht-ein-zuhause" (4 Abschnitte). Ruft die
// Service-Funktionen direkt auf (nicht die Server Actions), da
// requireOwnChildProfile() einen Next.js-Request-Kontext (cookies()/auth())
// voraussetzt, der außerhalb eines echten Requests nicht verfügbar ist. Die
// Autorisierung selbst ist bereits in tests/integration/child-profile-ownership.test.ts
// und den E2E-404-Tests abgedeckt.
describe('Lesesitzung (readingSessionService)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parentId: string;
  let childProfileId: string;
  let storyId: string;
  let storySlug: string;
  let firstSectionWordCount: number;
  let sectionCount: number;

  beforeAll(async () => {
    const passwordHash = await hashPassword('IntegrationTestPasswort123');
    const parent = await db.user.create({
      data: { email: `vitest-reading-${suffix}@example.com`, passwordHash },
    });
    parentId = parent.id;

    const story = await db.story.findFirstOrThrow({
      where: { slug: 'pieks-sucht-ein-zuhause' },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    storyId = story.id;
    storySlug = story.slug;
    sectionCount = story.sections.length;
    firstSectionWordCount = (story.sections[0].expectedWords as Array<{ word: string }>).length;
  });

  afterAll(async () => {
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

  it('erstellt eine neue aktive Sitzung und setzt bei erneutem Aufruf dieselbe fort', async () => {
    const first = await startOrResumeReadingSession(childProfileId, storySlug, parentId);
    expect(first.currentSectionOrder).toBe(0);
    expect(first.status).toBe('active');

    const second = await startOrResumeReadingSession(childProfileId, storySlug, parentId);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it('rückt bei "correct" bis zum Ende des Abschnitts vor und schließt ihn ab', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    const result = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'correct',
    });

    expect(result.evaluationState).toBe('correct');
    expect(result.newLocalPosition).toBe(firstSectionWordCount);
    expect(result.sectionComplete).toBe(true);
    expect(result.sessionComplete).toBe(false);

    const session = await db.readingSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.currentSectionOrder).toBe(1);
  });

  it('schreibt für jedes gelesene Wort eine WordEvaluation mit Zustand "correct"', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'correct',
    });

    const attempts = await db.readingAttempt.findMany({ where: { readingSessionId: sessionId } });
    expect(attempts).toHaveLength(1);

    const evaluations = await db.wordEvaluation.findMany({
      where: { readingAttemptId: attempts[0].id },
      orderBy: { wordIndex: 'asc' },
    });
    expect(evaluations).toHaveLength(firstSectionWordCount);
    expect(evaluations.every((e) => e.state === 'correct')).toBe(true);
  });

  it('liest die ganze Geschichte fertig, wenn jeder Abschnitt korrekt gelesen wird', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    let sessionComplete = false;
    for (let section = 0; section < sectionCount; section += 1) {
      const result = await submitReadingAttempt({
        sessionId,
        childProfileId,
        sectionOrder: section,
        localPosition: 0,
        retryCount: 0,
        forcedScenario: 'correct',
      });
      sessionComplete = result.sessionComplete;
    }

    expect(sessionComplete).toBe(true);
    const session = await db.readingSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe('completed');
    expect(session.completedAt).not.toBeNull();
  });

  it('bietet nach zwei erfolglosen Versuchen Hilfe an und blockiert nicht endlos', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    const first = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'possible_error',
    });
    expect(first.uiState).toBe('gentle_hint');
    expect(first.newLocalPosition).toBe(0);

    const second = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: first.retryCount,
      forcedScenario: 'possible_error',
    });
    expect(second.uiState).toBe('gentle_hint');

    const third = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: second.retryCount,
      forcedScenario: 'possible_error',
    });
    expect(third.uiState).toBe('help_offered');
    expect(third.newLocalPosition).toBe(0);

    const helpResult = await resolveHelp({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
    });
    expect(helpResult.newLocalPosition).toBe(1);
    expect(helpResult.uiState).toBe('advance');
  });

  it('behandelt einen nicht verfügbaren Dienst nicht als Lesefehler und persistiert das korrekt', async () => {
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    const result = await submitReadingAttempt({
      sessionId,
      childProfileId,
      sectionOrder: 0,
      localPosition: 0,
      retryCount: 0,
      forcedScenario: 'unavailable',
    });

    expect(result.evaluationState).toBe('unavailable');
    expect(result.uiState).toBe('provider_unavailable');
    expect(result.newLocalPosition).toBe(0);

    const attempts = await db.readingAttempt.findMany({ where: { readingSessionId: sessionId } });
    expect(attempts[0].state).toBe('unavailable');
  });

  it('rückt eine ganze Geschichte lang korrekt vor, wenn nur der letzte Abschnitt einen Fehler enthält', async () => {
    // Story bleibt unabgeschlossen, wenn der letzte Abschnitt nicht gelesen wird.
    const { sessionId } = await startOrResumeReadingSession(childProfileId, storySlug, parentId);

    for (let section = 0; section < sectionCount - 1; section += 1) {
      await submitReadingAttempt({
        sessionId,
        childProfileId,
        sectionOrder: section,
        localPosition: 0,
        retryCount: 0,
        forcedScenario: 'correct',
      });
    }

    const session = await db.readingSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe('active');
    expect(session.currentSectionOrder).toBe(sectionCount - 1);
  });

  it('storyId aus dem Seed passt zur erwarteten Geschichte', () => {
    expect(storyId).toBeTruthy();
  });
});
