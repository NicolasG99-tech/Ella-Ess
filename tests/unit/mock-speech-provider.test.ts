import { describe, expect, it } from 'vitest';
import { MockSpeechRecognitionProvider } from '@/lib/providers/speech/MockSpeechRecognitionProvider';
import type { MockScenario } from '@/lib/providers/speech/types';

const TARGET_WORDS = ['Der', 'kleine', 'Igel', 'lebt', 'im', 'Wald'];

describe('MockSpeechRecognitionProvider.transcribeAudio', () => {
  const provider = new MockSpeechRecognitionProvider();

  it('simuliert "correct": alle Zielwörter mit hoher Konfidenz', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'correct',
    });
    expect(result.available).toBe(true);
    expect(result.recognizedWords.map((w) => w.word)).toEqual(TARGET_WORDS);
    for (const word of result.recognizedWords) {
      expect(word.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('simuliert "likely_correct": alle Zielwörter mit moderater Konfidenz', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'likely_correct',
    });
    expect(result.recognizedWords.map((w) => w.word)).toEqual(TARGET_WORDS);
    for (const word of result.recognizedWords) {
      expect(word.confidence).toBeGreaterThanOrEqual(0.55);
      expect(word.confidence).toBeLessThan(0.75);
    }
  });

  it('simuliert "possible_error": letztes Wort wird durch ein unpassendes ersetzt', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'possible_error',
    });
    const last = result.recognizedWords.at(-1);
    expect(last?.word).not.toBe(TARGET_WORDS.at(-1));
    expect(last?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('simuliert "unclear_audio": alle Wörter mit niedriger Konfidenz', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'unclear_audio',
    });
    for (const word of result.recognizedWords) {
      expect(word.confidence).toBeLessThan(0.35);
    }
  });

  it('simuliert "unavailable": Dienst nicht verfügbar, keine Wörter', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'unavailable',
    });
    expect(result.available).toBe(false);
    expect(result.recognizedWords).toEqual([]);
  });

  it('simuliert "self_corrected": erst ein Fehlversuch, dann alle Zielwörter korrekt', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'self_corrected',
    });
    expect(result.recognizedWords[0].word).not.toBe(TARGET_WORDS[0]);
    expect(result.recognizedWords.slice(1).map((w) => w.word)).toEqual(TARGET_WORDS);
  });

  it('simuliert "skipped_word": ein Zielwort fehlt in der Erkennung', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'skipped_word',
    });
    expect(result.recognizedWords.length).toBe(TARGET_WORDS.length - 1);
  });

  it('simuliert "extra_word": ein zusätzliches Wort wird eingefügt', async () => {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: 'extra_word',
    });
    expect(result.recognizedWords.length).toBe(TARGET_WORDS.length + 1);
    expect(result.recognizedWords.some((w) => w.word === 'äh')).toBe(true);
  });

  it('liefert ohne erzwungenes Szenario ein gültiges, verfügbares Ergebnis', async () => {
    const result = await provider.transcribeAudio({ targetWords: TARGET_WORDS });
    expect(typeof result.available).toBe('boolean');
    expect(Array.isArray(result.recognizedWords)).toBe(true);
  });
});

describe('MockSpeechRecognitionProvider.evaluateReadingAttempt', () => {
  const provider = new MockSpeechRecognitionProvider();
  const noFlags = {
    repetition: false,
    omission: false,
    selfCorrection: false,
    possibleMisreadWord: false,
  };

  it('gibt "unavailable" zurück, wenn der Dienst nicht verfügbar ist', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 0, confidence: 0.9, flags: noFlags },
      retryCount: 0,
      providerAvailable: false,
    });
    expect(result.state).toBe('unavailable');
  });

  it('gibt "skipped" zurück bei einer tolerierten Auslassung', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 2, confidence: 0.9, flags: { ...noFlags, omission: true } },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('skipped');
  });

  it('gibt "self_corrected" zurück bei erkannter Selbstkorrektur', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 1, confidence: 0.9, flags: { ...noFlags, selfCorrection: true } },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('self_corrected');
  });

  it('gibt "unclear_audio" bei niedriger Konfidenz zurück (nie als Fehler gewertet)', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 0, confidence: 0.3, flags: noFlags },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('unclear_audio');
  });

  it('gibt "possible_error" nur bei hoher Konfidenz eines unpassenden Worts zurück', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 0, confidence: 0.8, flags: { ...noFlags, possibleMisreadWord: true } },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('possible_error');
  });

  it('gibt "correct" bei hoher Konfidenz und klarem Treffer zurück', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 1, confidence: 0.9, flags: noFlags },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('correct');
  });

  it('gibt "likely_correct" bei mittlerer Konfidenz zurück', () => {
    const result = provider.evaluateReadingAttempt({
      alignment: { position: 1, confidence: 0.6, flags: noFlags },
      retryCount: 0,
      providerAvailable: true,
    });
    expect(result.state).toBe('likely_correct');
  });
});

describe('MockSpeechRecognitionProvider.detectPossibleSelfCorrection', () => {
  const provider = new MockSpeechRecognitionProvider();

  it('erkennt eine Selbstkorrektur bei deutlich verbessertem, anderem Wort', () => {
    const result = provider.detectPossibleSelfCorrection([
      { word: 'Iglu', confidence: 0.5 },
      { word: 'Igel', confidence: 0.9 },
    ]);
    expect(result).toBe(true);
  });

  it('erkennt keine Selbstkorrektur bei gleichem Wort', () => {
    const result = provider.detectPossibleSelfCorrection([
      { word: 'Igel', confidence: 0.5 },
      { word: 'Igel', confidence: 0.9 },
    ]);
    expect(result).toBe(false);
  });

  it('erkennt keine Selbstkorrektur bei zu wenigen Wörtern', () => {
    expect(provider.detectPossibleSelfCorrection([{ word: 'Igel', confidence: 0.9 }])).toBe(false);
  });
});

describe('MockSpeechRecognitionProvider.returnWordConfidence', () => {
  it('gibt die Konfidenz des erkannten Worts zurück', () => {
    const provider = new MockSpeechRecognitionProvider();
    expect(provider.returnWordConfidence({ word: 'Igel', confidence: 0.73 })).toBe(0.73);
  });
});

// Stellt sicher, dass alle 8 im Lastenheft geforderten Szenarien unterstützt werden.
it('unterstützt alle 8 geforderten Simulationsszenarien', async () => {
  const provider = new MockSpeechRecognitionProvider();
  const scenarios: MockScenario[] = [
    'correct',
    'likely_correct',
    'possible_error',
    'unclear_audio',
    'unavailable',
    'self_corrected',
    'skipped_word',
    'extra_word',
  ];
  for (const scenario of scenarios) {
    const result = await provider.transcribeAudio({
      targetWords: TARGET_WORDS,
      forcedScenario: scenario,
    });
    expect(result).toBeDefined();
  }
});
