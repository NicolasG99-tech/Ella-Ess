import type { IllustrationLayerName } from '@/generated/prisma/enums';

export interface UnlockCheckpoint {
  layerName: IllustrationLayerName;
  /**
   * Wortindex (0-basiert, in derselben Zählung wie deriveExpectedWords)
   * INNERHALB des Abschnitts, ab dem die Ebene freigeschaltet wird — "an
   * dieser Wortposition angekommen" statt "Abschnitt abgeschlossen".
   */
  wordIndex: number;
}

export interface ParsedSectionText {
  /** Text ohne Marker — das ist es, was gespeichert und dem Kind gezeigt wird. */
  text: string;
  checkpoints: UnlockCheckpoint[];
}

// Inline-Marker für Illustrationsfreischaltung, z.B.:
//   "Der Bär [[unlock:main_character]] wachte auf."
// `layerName` muss einer der fünf IllustrationLayerName-Werte sein (siehe
// prisma/schema.prisma). Marker werden vor dem Speichern/Anzeigen entfernt —
// sie dürfen niemals im Lesetext für das Kind sichtbar sein oder in die
// Worterkennung (deriveExpectedWords) einfließen. Deshalb MUSS dieser Parser
// vor deriveExpectedWords aufgerufen werden (siehe prisma/seed.ts).
//
// Autoren-Konvention: Marker mit Leerzeichen umgeben, zwischen zwei Wörtern
// platzieren (nicht mitten in einem Wort) — sonst kann die Wortzählung an
// der Markerstelle verrutschen.
const UNLOCK_MARKER_PATTERN = /\[\[unlock:([a-z_]+)\]\]/g;

function countWords(segment: string): number {
  return segment.split(/\s+/).filter((token) => token.length > 0).length;
}

export function parseUnlockCheckpoints(rawText: string): ParsedSectionText {
  const checkpoints: UnlockCheckpoint[] = [];
  let cleanedText = '';
  let wordCount = 0;
  let lastIndex = 0;

  for (const match of rawText.matchAll(UNLOCK_MARKER_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const before = rawText.slice(lastIndex, matchIndex);
    cleanedText += before;
    wordCount += countWords(before);
    checkpoints.push({
      layerName: match[1] as IllustrationLayerName,
      wordIndex: wordCount,
    });
    lastIndex = matchIndex + match[0].length;
  }
  cleanedText += rawText.slice(lastIndex);

  return {
    // Durch das Entfernen der Marker können doppelte Leerzeichen entstehen
    // (z.B. "Wald [[unlock:x]] ging" -> "Wald  ging") — auf ein Leerzeichen
    // reduzieren, damit der angezeigte Text sauber bleibt. Zeilenumbrüche
    // (Absatzstruktur) bleiben unangetastet.
    text: cleanedText.replace(/[ \t]{2,}/g, ' ').trim(),
    checkpoints,
  };
}
