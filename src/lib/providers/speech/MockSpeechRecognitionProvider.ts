import { alignToTargetText } from '@/lib/reading/positionTracker';
import {
  defaultDetectPossibleSelfCorrection,
  defaultEvaluateReadingAttempt,
} from '@/lib/reading/defaultProviderHelpers';
import type {
  AlignmentResult,
  EvaluateReadingAttemptParams,
  MockScenario,
  RecognizedWord,
  SpeechRecognitionProvider,
  TranscribeAudioInput,
  TranscriptionResult,
  WordEvaluationResult,
} from '@/lib/providers/speech/types';

// Wörter, die garantiert zu keinem realistischen Zielwort passen — für
// "möglicher Fehler"/"Selbstkorrektur"-Simulationen.
const DECOY_WORDS = ['Fahrrad', 'Regenschirm', 'Kartoffel', 'Wolkenkratzer'];

function pickDecoyWord(seed: string): string {
  const index = seed.charCodeAt(0) % DECOY_WORDS.length;
  return DECOY_WORDS[index];
}

function uniformConfidence(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Gewichtete Standardauswahl für den "realistischen" Demo-Betrieb ohne
// erzwungenes Szenario: die meisten Leseversuche gelingen, wie bei einem
// echten Kind überwiegend der Fall.
const DEFAULT_SCENARIO_WEIGHTS: Array<[MockScenario, number]> = [
  ['correct', 0.65],
  ['likely_correct', 0.15],
  ['possible_error', 0.08],
  ['unclear_audio', 0.05],
  ['self_corrected', 0.04],
  ['skipped_word', 0.02],
  ['extra_word', 0.01],
];

function pickWeightedScenario(): MockScenario {
  const roll = Math.random();
  let cumulative = 0;
  for (const [scenario, weight] of DEFAULT_SCENARIO_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return scenario;
  }
  return 'correct';
}

function buildTranscriptionForScenario(
  scenario: MockScenario,
  targetWords: string[],
): TranscriptionResult {
  if (targetWords.length === 0) {
    return { available: true, recognizedWords: [] };
  }

  switch (scenario) {
    case 'correct':
      return {
        available: true,
        recognizedWords: targetWords.map((word) => ({
          word,
          confidence: uniformConfidence(0.85, 0.98),
        })),
      };

    case 'likely_correct':
      return {
        available: true,
        recognizedWords: targetWords.map((word) => ({
          word,
          confidence: uniformConfidence(0.56, 0.7),
        })),
      };

    case 'possible_error': {
      const decoy = pickDecoyWord(targetWords[targetWords.length - 1]);
      return {
        available: true,
        recognizedWords: [
          ...targetWords
            .slice(0, -1)
            .map((word) => ({ word, confidence: uniformConfidence(0.85, 0.95) })),
          { word: decoy, confidence: uniformConfidence(0.8, 0.9) },
        ],
      };
    }

    case 'unclear_audio':
      return {
        available: true,
        recognizedWords: targetWords.map((word) => ({
          word,
          confidence: uniformConfidence(0.1, 0.3),
        })),
      };

    case 'unavailable':
      return { available: false, recognizedWords: [] };

    case 'self_corrected': {
      const decoy = pickDecoyWord(targetWords[0]);
      return {
        available: true,
        recognizedWords: [
          { word: decoy, confidence: uniformConfidence(0.5, 0.65) },
          ...targetWords.map((word) => ({ word, confidence: uniformConfidence(0.85, 0.95) })),
        ],
      };
    }

    case 'skipped_word': {
      const skipIndex = Math.min(1, targetWords.length - 1);
      const withoutSkipped = targetWords.filter((_, index) => index !== skipIndex);
      return {
        available: true,
        recognizedWords: withoutSkipped.map((word) => ({
          word,
          confidence: uniformConfidence(0.85, 0.95),
        })),
      };
    }

    case 'extra_word': {
      const insertIndex = Math.min(1, targetWords.length);
      const withExtra = [...targetWords];
      withExtra.splice(insertIndex, 0, 'äh');
      return {
        available: true,
        recognizedWords: withExtra.map((word) => ({
          word,
          confidence: word === 'äh' ? uniformConfidence(0.6, 0.8) : uniformConfidence(0.85, 0.95),
        })),
      };
    }

    default:
      return { available: true, recognizedWords: [] };
  }
}

export class MockSpeechRecognitionProvider implements SpeechRecognitionProvider {
  async transcribeAudio(input: TranscribeAudioInput): Promise<TranscriptionResult> {
    const scenario = input.forcedScenario ?? pickWeightedScenario();
    return buildTranscriptionForScenario(scenario, input.targetWords);
  }

  alignToTargetText(
    recognizedWords: RecognizedWord[],
    targetWords: string[],
    fromPosition: number,
  ): AlignmentResult {
    return alignToTargetText(recognizedWords, targetWords, fromPosition);
  }

  evaluateReadingAttempt(params: EvaluateReadingAttemptParams): WordEvaluationResult {
    return defaultEvaluateReadingAttempt(params);
  }

  returnWordConfidence(recognizedWord: RecognizedWord): number {
    return recognizedWord.confidence;
  }

  detectPossibleSelfCorrection(recognizedWords: RecognizedWord[]): boolean {
    return defaultDetectPossibleSelfCorrection(recognizedWords);
  }
}
