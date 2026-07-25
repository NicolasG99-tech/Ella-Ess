import type { AlignmentFlags, AlignmentResult, RecognizedWord } from '@/lib/providers/speech/types';

// Textpositions-Erkennung (siehe docs/ARCHITECTURE.md, Abschnitt
// "Textpositions-Erkennung"): bestimmt die wahrscheinlichste Position im
// Zieltext aus einem kurzen Fenster zuletzt erkannter Wörter. Kein
// Volltext-Rematch — nur ein kleines Suchfenster um die letzte bekannte
// Position, um wilde Sprünge zu vermeiden.

// Wie viele Wörter voraus (ab der aktuellen Position) berücksichtigt werden.
const SEARCH_WINDOW = 6;
// Unterhalb dieser Konfidenz wird die Position nicht bewegt.
const MIN_CONFIDENCE_TO_ADVANCE = 0.55;
// Ab dieser Wortlänge wird eine kleine Editierdistanz als Annäherung toleriert
// (z.B. leichte Erkennungsfehler bei längeren Wörtern).
const MIN_LENGTH_FOR_FUZZY_MATCH = 4;
const MAX_EDIT_DISTANCE = 1;
// Eigene, mit geringer Konfidenz erkannte Wörter gelten als Hintergrundrauschen.
const NOISE_CONFIDENCE_THRESHOLD = 0.35;

export function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ]);
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

function wordsMatch(recognized: string, target: string): boolean {
  const a = normalizeWord(recognized);
  const b = normalizeWord(target);
  if (a === b) return true;
  if (a.length < MIN_LENGTH_FOR_FUZZY_MATCH || b.length < MIN_LENGTH_FOR_FUZZY_MATCH) {
    return false;
  }
  return levenshtein(a, b) <= MAX_EDIT_DISTANCE;
}

/**
 * Verarbeitet eine Folge erkannter Wörter sequentiell gegen ein kleines
 * Suchfenster im Zieltext, beginnend bei `fromPosition`. Ein "Cursor" rückt
 * nur bei einem klaren Treffer vor:
 *  - passt das Wort zum direkt erwarteten Wort → ein Wort vor,
 *  - passt es zum übernächsten erwarteten Wort → ein Wort ausgelassen (toleriert), zwei vor,
 *  - passt es zu einem bereits bestätigten Wort → Wiederholung, Cursor bleibt stehen,
 *  - passt es zu nichts in der Nähe → wird ignoriert (Rauschen/zusätzliches Wort),
 *    beeinflusst aber ggf. die Gesamtkonfidenz.
 */
export function alignToTargetText(
  recognizedWords: RecognizedWord[],
  targetWords: string[],
  fromPosition: number,
): AlignmentResult {
  const flags: AlignmentFlags = {
    repetition: false,
    omission: false,
    selfCorrection: false,
    possibleMisreadWord: false,
  };

  if (recognizedWords.length === 0 || fromPosition >= targetWords.length) {
    return { position: fromPosition, confidence: 0, flags };
  }

  let cursor = fromPosition;
  const matchedConfidences: number[] = [];
  let lastUnmatchedCursor: number | null = null;

  for (const recognized of recognizedWords) {
    if (recognized.confidence < NOISE_CONFIDENCE_THRESHOLD) {
      // Zu leise/unsicher, um überhaupt als Kandidat zu zählen.
      continue;
    }

    // Das Suchfenster wandert mit dem Cursor mit (bounded lookahead relativ
    // zur aktuellen Position) statt an der ursprünglichen fromPosition fixiert
    // zu bleiben — sonst würde die Erkennung bei langen, aber korrekt
    // gelesenen Abschnitten vorzeitig abbrechen.
    const windowEnd = Math.min(targetWords.length, cursor + SEARCH_WINDOW);
    const expected = cursor < windowEnd ? targetWords[cursor] : null;
    const nextExpected = cursor + 1 < windowEnd ? targetWords[cursor + 1] : null;

    if (expected && wordsMatch(recognized.word, expected)) {
      if (lastUnmatchedCursor === cursor) {
        flags.selfCorrection = true;
      }
      matchedConfidences.push(recognized.confidence);
      cursor += 1;
      lastUnmatchedCursor = null;
      continue;
    }

    if (nextExpected && wordsMatch(recognized.word, nextExpected)) {
      flags.omission = true;
      matchedConfidences.push(recognized.confidence);
      cursor += 2;
      lastUnmatchedCursor = null;
      continue;
    }

    const matchesEarlierWord = targetWords
      .slice(Math.max(0, cursor - SEARCH_WINDOW), cursor)
      .some((word) => wordsMatch(recognized.word, word));
    if (matchesEarlierWord) {
      flags.repetition = true;
      continue;
    }

    // Weder erwartetes Wort noch bekanntes früheres Wort — möglicherweise ein
    // Fehllesen oder ein zusätzlich gesprochenes Wort. Nicht sofort als Fehler
    // werten (siehe Bewertungslogik), aber für evaluateReadingAttempt vormerken.
    if (recognized.confidence >= MIN_CONFIDENCE_TO_ADVANCE) {
      flags.possibleMisreadWord = true;
    }
    lastUnmatchedCursor = cursor;
  }

  const confidence =
    matchedConfidences.length > 0
      ? matchedConfidences.reduce((sum, value) => sum + value, 0) / matchedConfidences.length
      : 0;

  if (confidence < MIN_CONFIDENCE_TO_ADVANCE) {
    return { position: fromPosition, confidence, flags };
  }

  return { position: cursor, confidence, flags };
}
