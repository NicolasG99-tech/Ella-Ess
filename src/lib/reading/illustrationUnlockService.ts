import { db } from '@/lib/server/db';

export interface UnlockedIllustrationInfo {
  id: string;
  name: string;
  assetKey: string;
  renderOrder: number;
}

// Schaltet Illustrationsebenen ausschließlich anhand des erreichten
// Lesefortschritts frei (abgeschlossener Abschnitt), nie anhand der
// Lesegeschwindigkeit oder verstrichener Zeit — siehe Lastenheft 4.10.
// Bereits freigeschaltete Ebenen werden nicht erneut angelegt (idempotent),
// damit ein fortgesetzter Lesevorgang keine doppelten Freischalt-Animationen
// auslöst.
export async function unlockIllustrationsForCompletedSection(
  readingSessionId: string,
  storyId: string,
  completedSectionOrder: number,
): Promise<UnlockedIllustrationInfo[]> {
  const eligibleLayers = await db.illustrationLayer.findMany({
    where: { storyId, unlockAfterSectionOrder: { lte: completedSectionOrder } },
    orderBy: { renderOrder: 'asc' },
  });

  if (eligibleLayers.length === 0) {
    return [];
  }

  const alreadyUnlocked = await db.unlockedIllustration.findMany({
    where: { readingSessionId, illustrationLayerId: { in: eligibleLayers.map((l) => l.id) } },
    select: { illustrationLayerId: true },
  });
  const unlockedIds = new Set(alreadyUnlocked.map((entry) => entry.illustrationLayerId));

  const newlyUnlockedLayers = eligibleLayers.filter((layer) => !unlockedIds.has(layer.id));
  if (newlyUnlockedLayers.length === 0) {
    return [];
  }

  await db.unlockedIllustration.createMany({
    data: newlyUnlockedLayers.map((layer) => ({
      readingSessionId,
      illustrationLayerId: layer.id,
    })),
  });

  return newlyUnlockedLayers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    assetKey: layer.assetKey,
    renderOrder: layer.renderOrder,
  }));
}

// Schaltet Illustrationsebenen anhand einer erreichten Wortposition INNERHALB
// eines (noch nicht zwangsläufig abgeschlossenen) Abschnitts frei — für
// Ebenen mit `unlockAfterWordIndex` gesetzt (siehe
// lib/content/parseUnlockCheckpoints.ts, [[unlock:...]]-Marker im Story-Text).
// Ergänzt unlockIllustrationsForCompletedSection (die weiterhin greift, wenn
// ein Abschnitt komplett gelesen wird — auch für Ebenen mit Wort-Checkpoint,
// falls die Sitzung nie exakt auf deren Wortposition landet, z.B. nach
// Hilfestellung). Idempotent wie oben: bereits freigeschaltete Ebenen werden
// nicht erneut angelegt.
export async function unlockIllustrationsForWordCheckpoint(
  readingSessionId: string,
  storyId: string,
  sectionOrder: number,
  reachedWordIndex: number,
): Promise<UnlockedIllustrationInfo[]> {
  const eligibleLayers = await db.illustrationLayer.findMany({
    where: {
      storyId,
      unlockAfterSectionOrder: sectionOrder,
      unlockAfterWordIndex: { not: null, lte: reachedWordIndex },
    },
    orderBy: { renderOrder: 'asc' },
  });

  if (eligibleLayers.length === 0) {
    return [];
  }

  const alreadyUnlocked = await db.unlockedIllustration.findMany({
    where: { readingSessionId, illustrationLayerId: { in: eligibleLayers.map((l) => l.id) } },
    select: { illustrationLayerId: true },
  });
  const unlockedIds = new Set(alreadyUnlocked.map((entry) => entry.illustrationLayerId));

  const newlyUnlockedLayers = eligibleLayers.filter((layer) => !unlockedIds.has(layer.id));
  if (newlyUnlockedLayers.length === 0) {
    return [];
  }

  await db.unlockedIllustration.createMany({
    data: newlyUnlockedLayers.map((layer) => ({
      readingSessionId,
      illustrationLayerId: layer.id,
    })),
  });

  return newlyUnlockedLayers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    assetKey: layer.assetKey,
    renderOrder: layer.renderOrder,
  }));
}

export async function getUnlockedIllustrations(
  readingSessionId: string,
): Promise<UnlockedIllustrationInfo[]> {
  const unlocked = await db.unlockedIllustration.findMany({
    where: { readingSessionId },
    include: { illustrationLayer: true },
    orderBy: { illustrationLayer: { renderOrder: 'asc' } },
  });

  return unlocked.map((entry) => ({
    id: entry.illustrationLayer.id,
    name: entry.illustrationLayer.name,
    assetKey: entry.illustrationLayer.assetKey,
    renderOrder: entry.illustrationLayer.renderOrder,
  }));
}
