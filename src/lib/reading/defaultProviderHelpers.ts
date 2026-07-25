import type {
  EvaluateReadingAttemptParams,
  RecognizedWord,
  WordEvaluationResult,
} from '@/lib/providers/speech/types';

const HIGH_CONFIDENCE = 0.75;
const LOW_CONFIDENCE = 0.55;

/**
 * Konservative Standard-Bewertungslogik auf Basis eines Alignment-Ergebnisses.
 * Provider-unabhängig (siehe docs/ARCHITECTURE.md, "Provider-Abstraktion") —
 * wird sowohl von MockSpeechRecognitionProvider als auch von echten Providern
 * (z. B. AzureSpeechRecognitionProvider) genutzt, damit die Bewertungs-
 * schwellen an genau einer Stelle gepflegt werden und nicht zwischen
 * Implementierungen auseinanderlaufen können. Siehe docs/EDUCATIONAL_MODEL.md,
 * Abschnitt "Feedbackregeln" — insbesondere: `unavailable` erscheint nie als
 * Lesefehler, ein möglicher Fehler nur bei hoher Konfidenz.
 */
export function defaultEvaluateReadingAttempt(
  params: EvaluateReadingAttemptParams,
): WordEvaluationResult {
  const { alignment, providerAvailable } = params;

  if (!providerAvailable) {
    return { state: 'unavailable', confidence: 0 };
  }
  if (alignment.flags.omission) {
    return { state: 'skipped', confidence: alignment.confidence };
  }
  if (alignment.flags.selfCorrection) {
    return { state: 'self_corrected', confidence: alignment.confidence };
  }
  if (alignment.confidence < LOW_CONFIDENCE) {
    return { state: 'unclear_audio', confidence: alignment.confidence };
  }
  if (alignment.flags.possibleMisreadWord && alignment.confidence >= HIGH_CONFIDENCE) {
    return { state: 'possible_error', confidence: alignment.confidence };
  }
  if (alignment.confidence >= HIGH_CONFIDENCE) {
    return { state: 'correct', confidence: alignment.confidence };
  }
  return { state: 'likely_correct', confidence: alignment.confidence };
}

/**
 * Heuristik für Selbstkorrekturen auf Basis der letzten beiden erkannten
 * Wörter — provider-unabhängig, da sie nur auf `RecognizedWord[]` operiert.
 */
export function defaultDetectPossibleSelfCorrection(recognizedWords: RecognizedWord[]): boolean {
  if (recognizedWords.length < 2) return false;
  const previous = recognizedWords[recognizedWords.length - 2];
  const last = recognizedWords[recognizedWords.length - 1];
  const differentWord = previous.word.toLowerCase() !== last.word.toLowerCase();
  const clearlyImproved = last.confidence - previous.confidence >= 0.2;
  return differentWord && clearlyImproved;
}
