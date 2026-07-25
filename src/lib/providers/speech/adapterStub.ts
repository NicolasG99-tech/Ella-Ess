import type { SpeechRecognitionProvider } from '@/lib/providers/speech/types';

// Vorbereitete Adapterstruktur für einen späteren echten Spracherkennungs-
// Anbieter (z.B. Whisper, Google Cloud Speech-to-Text, Azure Speech).
//
// Ein konkretes Beispiel existiert bereits: AzureSpeechRecognitionProvider.ts
// implementiert SpeechRecognitionProvider gegen Azure AI Speech Pronunciation
// Assessment (SPEECH_PROVIDER=azure, siehe index.ts). Diese Datei bleibt als
// Vorlage für weitere/alternative Anbieter (z.B. SpeechAce, SoapBox Labs)
// erhalten.
//
// Um einen weiteren echten Anbieter anzubinden:
//   1. Neue Datei anlegen, z.B. `WhisperSpeechRecognitionProvider.ts`, die
//      `SpeechRecognitionProvider` implementiert (siehe `types.ts`).
//   2. `transcribeAudio` ruft die echte API mit dem aufgenommenen Audio auf
//      und bildet das Ergebnis auf `RecognizedWord[]` ab.
//   3. `alignToTargetText` kann die bestehende `alignToTargetText`-Funktion
//      aus `lib/reading/positionTracker.ts` weiterverwenden — sie ist
//      Provider-unabhängig.
//   4. In `index.ts` (`getSpeechRecognitionProvider`) den neuen Provider für
//      `SPEECH_PROVIDER=<name>` registrieren.
//   5. API-Schlüssel ausschließlich serverseitig aus `process.env` lesen,
//      niemals im Client-Bundle.
//
// Diese Datei ist absichtlich kein lauffähiger Code, sondern nur die
// dokumentierte Erweiterungsstelle.
export type UnimplementedSpeechRecognitionProvider = never;

export function createUnimplementedProviderError(providerName: string): Error {
  return new Error(
    `Spracherkennungs-Anbieter "${providerName}" ist nicht implementiert. ` +
      'Im MVP ist ausschließlich SPEECH_PROVIDER=mock verfügbar. ' +
      'Siehe src/lib/providers/speech/adapterStub.ts für die Anbindung eines echten Anbieters.',
  );
}

// Type-Level-Check: stellt sicher, dass dieser Stub bei Bedarf zu einer
// echten Implementierung ausgebaut werden kann, ohne types.ts anzufassen.
export type { SpeechRecognitionProvider };
