import type { EvaluationState } from '@/lib/providers/speech/types';

// Steuert Wiederholungen und Hilfestellungen innerhalb eines Wort-/
// Abschnittsversuchs (siehe docs/EDUCATIONAL_MODEL.md, Abschnitt
// "Feedbackregeln"). Rein und ohne Seiteneffekte — die UI ruft diese
// Funktion bei jedem Bewertungsergebnis auf.

export type ReadingStepUiState =
  'advance' | 'clarify_retry' | 'gentle_hint' | 'help_offered' | 'provider_unavailable';

export interface SessionStepInput {
  evaluationState: EvaluationState;
  /** Bisherige Wiederholungen für dieses Wort/diesen Abschnitt. */
  retryCount: number;
}

export interface SessionStepResult {
  uiState: ReadingStepUiState;
  retryCount: number;
  shouldAdvance: boolean;
  message: string;
}

// Nach maximal 2 Wiederholungen wird eine Hilfestellung angeboten — das Kind
// bleibt nie in einer Endlosschleife hängen.
const MAX_RETRIES = 2;

const MESSAGES = {
  unavailable:
    'Es gibt gerade ein technisches Problem. Das liegt nicht an dir — versuche es gleich noch einmal.',
  correct: 'Weiter so!',
  selfCorrected: 'Schön, dass du dich selbst verbessert hast!',
  skipped: 'Kein Problem, weiter geht’s!',
  unclearAudio: 'Ich konnte dich nicht deutlich genug hören. Versuchen wir es noch einmal.',
  possibleError: 'Fast geschafft. Schau dir dieses Wort noch einmal an.',
  helpOffered: 'Hier ist eine Hilfe für dich. Wenn du bereit bist, geht es weiter.',
} as const;

export function computeSessionStep(input: SessionStepInput): SessionStepResult {
  const { evaluationState, retryCount } = input;

  switch (evaluationState) {
    case 'unavailable':
      // Ein technischer Fehler darf niemals als Lesefehler erscheinen und
      // zählt nicht als Wiederholungsversuch.
      return {
        uiState: 'provider_unavailable',
        retryCount,
        shouldAdvance: false,
        message: MESSAGES.unavailable,
      };

    case 'correct':
    case 'likely_correct':
      return { uiState: 'advance', retryCount: 0, shouldAdvance: true, message: MESSAGES.correct };

    case 'self_corrected':
      return {
        uiState: 'advance',
        retryCount: 0,
        shouldAdvance: true,
        message: MESSAGES.selfCorrected,
      };

    case 'skipped':
      return { uiState: 'advance', retryCount: 0, shouldAdvance: true, message: MESSAGES.skipped };

    case 'unclear_audio':
    case 'possible_error': {
      const nextRetryCount = retryCount + 1;
      if (nextRetryCount > MAX_RETRIES) {
        return {
          uiState: 'help_offered',
          retryCount: nextRetryCount,
          shouldAdvance: false,
          message: MESSAGES.helpOffered,
        };
      }
      return {
        uiState: evaluationState === 'unclear_audio' ? 'clarify_retry' : 'gentle_hint',
        retryCount: nextRetryCount,
        shouldAdvance: false,
        message:
          evaluationState === 'unclear_audio' ? MESSAGES.unclearAudio : MESSAGES.possibleError,
      };
    }

    default:
      return { uiState: 'advance', retryCount: 0, shouldAdvance: true, message: MESSAGES.correct };
  }
}

// Nach einer angebotenen Hilfestellung geht es immer weiter — nie eine
// weitere Bewertungsrunde für dasselbe Wort, um Endlosschleifen auszuschließen.
export function resolveHelpOffered(): SessionStepResult {
  return { uiState: 'advance', retryCount: 0, shouldAdvance: true, message: MESSAGES.correct };
}
