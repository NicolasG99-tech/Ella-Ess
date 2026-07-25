import { MockSpeechRecognitionProvider } from '@/lib/providers/speech/MockSpeechRecognitionProvider';
import { AzureSpeechRecognitionProvider } from '@/lib/providers/speech/AzureSpeechRecognitionProvider';
import { createUnimplementedProviderError } from '@/lib/providers/speech/adapterStub';
import type { SpeechRecognitionProvider } from '@/lib/providers/speech/types';

let cachedProvider: SpeechRecognitionProvider | null = null;

// Zentrale Factory — UI- und Session-Code rufen ausschließlich diese Funktion
// auf, nie eine konkrete Provider-Klasse direkt.
export function getSpeechRecognitionProvider(): SpeechRecognitionProvider {
  const providerName = process.env.SPEECH_PROVIDER ?? 'mock';

  if (providerName === 'mock') {
    if (!cachedProvider) {
      cachedProvider = new MockSpeechRecognitionProvider();
    }
    return cachedProvider;
  }

  if (providerName === 'azure') {
    if (!cachedProvider) {
      const subscriptionKey = process.env.AZURE_SPEECH_KEY;
      const region = process.env.AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) {
        throw new Error(
          'SPEECH_PROVIDER=azure erfordert AZURE_SPEECH_KEY und AZURE_SPEECH_REGION ' +
            '(siehe .env.example). Vor Aktivierung: Datenschutz-Review mit dem ' +
            'privacy-security-Agent durchführen (echtes Kinderaudio wird an Azure übertragen).',
        );
      }
      cachedProvider = new AzureSpeechRecognitionProvider({
        subscriptionKey,
        region,
        language: process.env.AZURE_SPEECH_LANGUAGE ?? 'de-DE',
      });
    }
    return cachedProvider;
  }

  throw createUnimplementedProviderError(providerName);
}

export function isMockSpeechProviderActive(): boolean {
  return (process.env.SPEECH_PROVIDER ?? 'mock') === 'mock';
}

/**
 * Optionaler Tonhöhen-/Tempo-Faktor für die clientseitige Audio-
 * Vorverarbeitung (siehe audioPreprocessing.ts), z. B. "1.06" für +6 %.
 * `null`, wenn nicht gesetzt oder ungültig — dann keine Veränderung.
 * Nur relevant, wenn ein echter Provider aktiv ist; hat im Mock-Modus keine
 * Wirkung, da dort gar kein Audio erfasst wird.
 */
export function getPitchShiftRate(): number | null {
  const raw = process.env.SPEECH_PRIVACY_PITCH_SHIFT_RATE;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export type { SpeechRecognitionProvider } from '@/lib/providers/speech/types';
