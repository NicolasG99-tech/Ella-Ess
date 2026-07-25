'use client';

import { useCallback, useRef, useState } from 'react';

export type MicState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'processing'
  | 'permission_denied'
  | 'unsupported'
  | 'error';

function detectSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface UseAudioRecorderOptions {
  /**
   * Nur setzen, wenn ein echter Spracherkennungs-Provider aktiv ist
   * (SPEECH_PROVIDER != "mock", siehe ReadingView.tsx `isMockProvider`).
   * Steuert, ob Audio-Chunks überhaupt gesammelt werden. Standard: false —
   * dann verhält sich der Hook exakt wie zuvor, es wird nichts gesammelt und
   * `stop()` liefert `null`. Das MVP-Prinzip "Rohaudio verlässt nie den
   * Browser" bleibt im Mock-Modus dadurch unverändert (siehe
   * docs/SECURITY.md, "Audioverarbeitung").
   */
  captureAudio?: boolean;
}

// Nimmt kurze Audiosegmente über die Browser-MediaRecorder-API auf. Ohne
// `captureAudio: true` wird das aufgenommene Audio NIE gesammelt, an den
// Server übertragen oder gespeichert — der Mock-Spracherkennungs-Provider
// benötigt keine echten Audiodaten (siehe docs/SECURITY.md). Nur wenn ein
// echter Provider aktiv ist, sammelt der Hook die Chunks und `stop()`
// liefert das aufgenommene Audio als Blob zur kurzzeitigen Weiterverarbeitung
// (siehe audioPreprocessing.ts) und Übertragung.
export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const { captureAudio = false } = options;
  const [micState, setMicState] = useState<MicState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported = detectSupport();

  const start = useCallback(async () => {
    if (!detectSupport()) {
      setMicState('unsupported');
      return;
    }

    setMicState('requesting_permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      if (captureAudio) {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
      }
      recorder.start();
      mediaRecorderRef.current = recorder;
      setMicState('recording');
    } catch {
      setMicState('permission_denied');
    }
  }, [captureAudio]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setMicState('processing');
        resolve(null);
        return;
      }

      setMicState('processing');
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        const blob =
          captureAudio && chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
            : null;
        chunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, [captureAudio]);

  const cancel = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setMicState('idle');
  }, []);

  const reset = useCallback(() => setMicState('idle'), []);

  return { micState, isSupported, start, stop, cancel, reset };
}
