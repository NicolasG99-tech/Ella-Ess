import { alignToTargetText } from '@/lib/reading/positionTracker';
import {
  defaultDetectPossibleSelfCorrection,
  defaultEvaluateReadingAttempt,
} from '@/lib/reading/defaultProviderHelpers';
import type {
  AlignmentResult,
  EvaluateReadingAttemptParams,
  RecognizedWord,
  SpeechRecognitionProvider,
  TranscribeAudioInput,
  TranscriptionResult,
  WordEvaluationResult,
} from '@/lib/providers/speech/types';

// Adapter für Azure AI Speech — Pronunciation Assessment (REST, Kurz-Audio).
// Sendet Referenztext + Audio, erhält pro Wort einen Genauigkeits-Score und
// Fehlertyp zurück (siehe docs/ARCHITECTURE.md, "Provider-Abstraktion").
//
// WICHTIG — vor Aktivierung (SPEECH_PROVIDER=azure) lesen:
// Diese Implementierung überträgt echtes Kinderaudio an einen
// Drittanbieter-Server. Das MVP-Kernprinzip "Rohaudio verlässt nie den
// Browser" (docs/SECURITY.md, docs/ARCHITECTURE.md) gilt dann NICHT mehr für
// diesen Provider. Aktivierung erst nach abgeschlossenem Datenschutz-Review
// (Auftragsverarbeitungsvertrag mit Microsoft, EU-Datenzone, aktualisierte
// Einwilligungstexte) — siehe den `privacy-security`- und
// `speech-provider`-Agenten. Standardmäßig bleibt SPEECH_PROVIDER=mock aktiv.
//
// Sicherheits-Guard (siehe security-red-team-Agent): dieser Provider liest
// AZURE_SPEECH_KEY und darf niemals in ein Client-Bundle gelangen. Ohne
// diesen Guard würde ein versehentlicher Import aus einer Client-Komponente
// nur "still" fehlschlagen (process.env.AZURE_SPEECH_KEY ist im Browser
// undefined, kein Build-Fehler) — mit dem Guard schlägt der Build/die
// Ausführung sofort und eindeutig fehl, statt sich auf Konvention zu
// verlassen.
if (typeof window !== 'undefined') {
  throw new Error(
    'AzureSpeechRecognitionProvider darf nicht im Browser ausgeführt werden — ' +
      'enthält den serverseitigen Azure-API-Schlüssel. Nur über ' +
      'getSpeechRecognitionProvider() (server-seitig) verwenden.',
  );
}

// Erwartetes Audioformat: WAV/PCM (siehe
// src/lib/providers/speech/audioPreprocessing.ts, das MediaRecorder-Output
// clientseitig entsprechend aufbereitet, bevor er hier ankommt).

interface AzurePronunciationWord {
  Word: string;
  ErrorType?: 'None' | 'Omission' | 'Insertion' | 'Mispronunciation';
  PronunciationAssessment?: {
    AccuracyScore?: number;
  };
}

interface AzurePronunciationResponse {
  RecognitionStatus?: string;
  NBest?: Array<{ Words?: AzurePronunciationWord[] }>;
}

export interface AzureSpeechRecognitionProviderConfig {
  /** Aus AZURE_SPEECH_KEY — ausschließlich serverseitig gelesen, siehe index.ts. */
  subscriptionKey: string;
  /** Azure-Region der Speech-Ressource, z. B. "germanywestcentral" (EU-Datenzone). */
  region: string;
  /** BCP-47-Sprachcode, Standard "de-DE". */
  language?: string;
}

const DEFAULT_LANGUAGE = 'de-DE';

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class AzureSpeechRecognitionProvider implements SpeechRecognitionProvider {
  constructor(private readonly config: AzureSpeechRecognitionProviderConfig) {}

  async transcribeAudio(input: TranscribeAudioInput): Promise<TranscriptionResult> {
    // Kein Audio oder kein Zieltext -> Dienst kann keine sinnvolle Aussage
    // treffen. Wird als "nicht verfügbar" behandelt, nie als Lesefehler
    // (siehe docs/EDUCATIONAL_MODEL.md, "Feedbackregeln").
    if (!input.audio || input.targetWords.length === 0) {
      return { available: false, recognizedWords: [] };
    }

    const referenceText = input.targetWords.join(' ');
    const assessmentConfig = Buffer.from(
      JSON.stringify({
        ReferenceText: referenceText,
        GradingSystem: 'HundredMark',
        Granularity: 'Word',
        Dimension: 'Comprehensive',
        // Erkennt zusätzliche/ausgelassene Wörter gegenüber dem Referenztext
        // — liefert die "Insertion"/"Omission"-Fehlertypen unten.
        EnableMiscue: true,
      }),
    ).toString('base64');

    const language = this.config.language ?? DEFAULT_LANGUAGE;
    const url =
      `https://${this.config.region}.stt.speech.microsoft.com` +
      `/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

    let response: Response;
    try {
      const audioBytes = await input.audio.arrayBuffer();
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Pronunciation-Assessment': assessmentConfig,
          Accept: 'application/json',
        },
        body: audioBytes,
      });
    } catch {
      // Netzwerkfehler, Timeout etc. — niemals als Lesefehler werten.
      return { available: false, recognizedWords: [] };
    }

    if (!response.ok) {
      return { available: false, recognizedWords: [] };
    }

    let data: AzurePronunciationResponse;
    try {
      data = (await response.json()) as AzurePronunciationResponse;
    } catch {
      return { available: false, recognizedWords: [] };
    }

    const words = data.NBest?.[0]?.Words ?? [];
    const recognizedWords: RecognizedWord[] = words
      .filter((word) => Boolean(word.Word))
      .map((word) => ({
        word: word.Word,
        confidence: clampConfidence((word.PronunciationAssessment?.AccuracyScore ?? 0) / 100),
      }));

    return { available: true, recognizedWords };
  }

  alignToTargetText(
    recognizedWords: RecognizedWord[],
    targetWords: string[],
    fromPosition: number,
  ): AlignmentResult {
    // Provider-unabhängige Positionslogik, siehe docs/ARCHITECTURE.md,
    // "Textpositions-Erkennung" — bewusst identisch zum Mock-Provider, damit
    // sich das Verhalten beim Providerwechsel nicht durch zwei verschiedene
    // Alignment-Implementierungen unterscheidet.
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
