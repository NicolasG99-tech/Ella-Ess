// Provider-Abstraktion für Spracherkennung (siehe docs/ARCHITECTURE.md,
// Abschnitt "Provider-Abstraktion"). UI- und Session-Code dürfen ausschließlich
// dieses Interface importieren, nie eine konkrete Implementierung — so lässt
// sich der Mock später durch einen echten Anbieter ersetzen, ohne UI-Code
// anzufassen.

// Konservative Bewertungszustände, siehe docs/EDUCATIONAL_MODEL.md.
export type EvaluationState =
  | 'correct'
  | 'likely_correct'
  | 'possible_error'
  | 'unclear_audio'
  | 'self_corrected'
  | 'skipped'
  | 'unavailable';

export interface RecognizedWord {
  word: string;
  /** 0 (unsicher) bis 1 (sehr sicher). */
  confidence: number;
}

// Die 8 im Lastenheft geforderten Simulationsszenarien des Mock-Providers.
export type MockScenario =
  | 'correct'
  | 'likely_correct'
  | 'possible_error'
  | 'unclear_audio'
  | 'unavailable'
  | 'self_corrected'
  | 'skipped_word'
  | 'extra_word';

export interface TranscribeAudioInput {
  /** Die als Nächstes erwarteten Wörter (kurzes Fenster, kein ganzer Text). */
  targetWords: string[];
  /** Nur im Mock-Modus: erzwingt ein bestimmtes Szenario statt zufälliger Auswahl. */
  forcedScenario?: MockScenario;
  /**
   * Aufgenommenes Audio für echte Anbieter (z. B. Azure). Nur gesetzt, wenn
   * SPEECH_PROVIDER != "mock" — siehe useAudioRecorder.ts (`captureAudio`)
   * und ReadingView.tsx. Der Mock-Provider ignoriert dieses Feld; das
   * MVP-Prinzip "Rohaudio verlässt nie den Browser" gilt weiterhin für den
   * Mock-Modus unverändert (siehe docs/SECURITY.md, "Audioverarbeitung").
   */
  audio?: Blob;
}

export interface TranscriptionResult {
  /** false, wenn der (simulierte) Dienst nicht verfügbar ist. */
  available: boolean;
  recognizedWords: RecognizedWord[];
}

export interface AlignmentFlags {
  /** Erkanntes Wort wiederholt ein bereits bestätigtes Wort (kein Rücksprung). */
  repetition: boolean;
  /** Ein erwartetes Wort wurde übersprungen, aber toleriert. */
  omission: boolean;
  /** Ein früherer Versuch wurde durch einen späteren, besseren ersetzt. */
  selfCorrection: boolean;
  /** Ein Wort mit brauchbarer Konfidenz passt zu keinem nahen Zielwort. */
  possibleMisreadWord: boolean;
}

export interface AlignmentResult {
  /** Neue Position im Zieltext (Wortindex), sofern die Konfidenz ausreichte. */
  position: number;
  /** Konfidenz des Alignments insgesamt (0..1). */
  confidence: number;
  flags: AlignmentFlags;
}

export interface WordEvaluationResult {
  state: EvaluationState;
  confidence: number;
}

export interface EvaluateReadingAttemptParams {
  alignment: AlignmentResult;
  retryCount: number;
  providerAvailable: boolean;
}

export interface SpeechRecognitionProvider {
  transcribeAudio(input: TranscribeAudioInput): Promise<TranscriptionResult>;
  alignToTargetText(
    recognizedWords: RecognizedWord[],
    targetWords: string[],
    fromPosition: number,
  ): AlignmentResult;
  evaluateReadingAttempt(params: EvaluateReadingAttemptParams): WordEvaluationResult;
  returnWordConfidence(recognizedWord: RecognizedWord): number;
  detectPossibleSelfCorrection(recognizedWords: RecognizedWord[]): boolean;
}
