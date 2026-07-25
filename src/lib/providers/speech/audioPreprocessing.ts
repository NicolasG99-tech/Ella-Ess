// Client-seitige Audio-Vorverarbeitung für echte Spracherkennungs-Anbieter
// (SPEECH_PROVIDER != "mock"). Läuft ausschließlich im Browser (Web Audio
// API) und wird nur aufgerufen, wenn ein echter Provider aktiv ist — siehe
// ReadingView.tsx. Im Mock-Modus wird diese Datei nicht importiert/genutzt,
// das MVP-Prinzip "Rohaudio verlässt nie den Browser" bleibt dort unverändert
// (siehe docs/SECURITY.md, "Audioverarbeitung").
//
// Zwei Schritte:
//   1. Dekodierung des MediaRecorder-Outputs (i.d.R. audio/webm) in ein
//      AudioBuffer und Re-Encoding als WAV/PCM — Azures Kurz-Audio-REST-API
//      (siehe AzureSpeechRecognitionProvider.ts) erwartet WAV.
//   2. Optionale, leichte Tonhöhenverschiebung als zusätzliche
//      Datenschutz-Maßnahme — siehe WICHTIGER HINWEIS unten.

export interface PrepareAudioOptions {
  /**
   * Optionaler Tonhöhen-/Tempo-Faktor (z. B. 1.06 = +6 %). `null`/`undefined`
   * = keine Veränderung. Siehe WICHTIGER HINWEIS unten, bevor das als
   * alleinige Datenschutzmaßnahme eingeplant wird.
   */
  pitchShiftRate?: number | null;
}

type AudioContextConstructor = typeof AudioContext;
type OfflineAudioContextConstructor = typeof OfflineAudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor {
  const globalWindow = window as unknown as { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? globalWindow.webkitAudioContext!;
}

function resolveOfflineAudioContextConstructor(): OfflineAudioContextConstructor {
  const globalWindow = window as unknown as {
    webkitOfflineAudioContext?: OfflineAudioContextConstructor;
  };
  return window.OfflineAudioContext ?? globalWindow.webkitOfflineAudioContext!;
}

async function decodeToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const AudioContextClass = resolveAudioContextConstructor();
  const decodeContext = new AudioContextClass();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await decodeContext.decodeAudioData(arrayBuffer);
  } finally {
    void decodeContext.close();
  }
}

// WICHTIGER HINWEIS zur Tonhöhenverschiebung als Datenschutzmaßnahme:
//
// Diese Resample-basierte Methode verändert Tonhöhe UND Tempo gemeinsam
// (kein Phase-Vocoder, der beides unabhängig steuern würde) — bewusst
// einfach gehalten, ohne zusätzliche DSP-Bibliothek.
//
// Sie ist KEINE verlässliche Anonymisierung der Stimme als biometrisches
// Merkmal: Forschung zu Voice-Anonymisierung (z. B. die VoicePrivacy
// Challenge) zeigt, dass moderne Sprechererkennung überwiegend auf der
// Formantstruktur/Spektralhüllkurve (Vokaltrakt-Form) beruht, nicht auf der
// Grundfrequenz allein — eine reine Tonhöhenverschiebung verändert diese
// Merkmale kaum und bietet gegen gezielte Re-Identifikation nur schwachen
// Schutz. Sie ist als zusätzliche Defense-in-Depth-Maßnahme gedacht, KEIN
// Ersatz für vertragliche/rechtliche Absicherung (Auftragsverarbeitungs-
// vertrag mit dem Anbieter, EU-Datenzone, aktualisierte Einwilligung) — siehe
// docs/SECURITY.md und den privacy-security-/speech-provider-Agenten.
//
// Ein zu großer Faktor beeinträchtigt außerdem die Erkennungsgenauigkeit
// (inkl. etwaiger Fluency-/Timing-Metriken des Anbieters) — kleine Werte
// (z. B. 1.03–1.08) werden empfohlen, falls diese Maßnahme überhaupt
// eingesetzt wird.
async function applyPitchShift(buffer: AudioBuffer, rate: number): Promise<AudioBuffer> {
  const OfflineAudioContextClass = resolveOfflineAudioContextConstructor();
  const offlineContext = new OfflineAudioContextClass(
    buffer.numberOfChannels,
    Math.max(1, Math.ceil(buffer.length / rate)),
    buffer.sampleRate,
  );
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(offlineContext.destination);
  source.start();
  return offlineContext.startRendering();
}

function writeAsciiString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

// Kodiert ein AudioBuffer als unkomprimiertes 16-Bit-PCM-WAV — Standardformat,
// das von Azure und den meisten anderen Spracherkennungs-APIs akzeptiert
// wird. Der WAV-Header trägt die tatsächliche Sample-Rate, kein erzwungenes
// Resampling nötig.
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel += 1) {
    channelData.push(buffer.getChannelData(channel));
  }

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Bereitet im Browser aufgenommenes Audio für einen echten
 * Spracherkennungs-Anbieter auf: dekodiert, wendet optional eine leichte
 * Tonhöhenverschiebung an, kodiert als WAV. Wird nur aufgerufen, wenn
 * SPEECH_PROVIDER != "mock" (siehe ReadingView.tsx, `isMockProvider`).
 */
export async function prepareAudioForRealProvider(
  blob: Blob,
  options: PrepareAudioOptions = {},
): Promise<Blob> {
  const decoded = await decodeToAudioBuffer(blob);
  const rate = options.pitchShiftRate;
  const processed = rate && rate !== 1 ? await applyPitchShift(decoded, rate) : decoded;
  return audioBufferToWavBlob(processed);
}
