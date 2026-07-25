import { describe, expect, it } from 'vitest';
import { computeSessionStep, resolveHelpOffered } from '@/lib/reading/sessionStateMachine';

describe('computeSessionStep', () => {
  it('rückt bei "correct" vor und setzt den Wiederholungszähler zurück', () => {
    const result = computeSessionStep({ evaluationState: 'correct', retryCount: 1 });
    expect(result.uiState).toBe('advance');
    expect(result.shouldAdvance).toBe(true);
    expect(result.retryCount).toBe(0);
  });

  it('rückt bei "self_corrected" positiv vor', () => {
    const result = computeSessionStep({ evaluationState: 'self_corrected', retryCount: 0 });
    expect(result.uiState).toBe('advance');
    expect(result.shouldAdvance).toBe(true);
    expect(result.message).not.toMatch(/falsch|fehler/i);
  });

  it('rückt bei "skipped" vor, ohne es als Fehler zu behandeln', () => {
    const result = computeSessionStep({ evaluationState: 'skipped', retryCount: 0 });
    expect(result.shouldAdvance).toBe(true);
  });

  it('bittet bei "unclear_audio" neutral um Wiederholung und erhöht den Zähler', () => {
    const result = computeSessionStep({ evaluationState: 'unclear_audio', retryCount: 0 });
    expect(result.uiState).toBe('clarify_retry');
    expect(result.shouldAdvance).toBe(false);
    expect(result.retryCount).toBe(1);
  });

  it('gibt bei "possible_error" eine motivierende Rückmeldung statt Kritik', () => {
    const result = computeSessionStep({ evaluationState: 'possible_error', retryCount: 0 });
    expect(result.uiState).toBe('gentle_hint');
    expect(result.message).not.toMatch(/falsch|schlecht|versagt|enttäuschend/i);
  });

  it('bietet nach zwei Wiederholungen Hilfe an statt einer dritten Runde', () => {
    const first = computeSessionStep({ evaluationState: 'possible_error', retryCount: 0 });
    const second = computeSessionStep({
      evaluationState: 'possible_error',
      retryCount: first.retryCount,
    });
    const third = computeSessionStep({
      evaluationState: 'possible_error',
      retryCount: second.retryCount,
    });

    expect(first.uiState).toBe('gentle_hint');
    expect(second.uiState).toBe('gentle_hint');
    expect(third.uiState).toBe('help_offered');
    expect(third.shouldAdvance).toBe(false);
  });

  it('behandelt einen technischen Fehler nie als Lesefehler und zählt ihn nicht als Versuch', () => {
    const result = computeSessionStep({ evaluationState: 'unavailable', retryCount: 0 });
    expect(result.uiState).toBe('provider_unavailable');
    expect(result.retryCount).toBe(0);
  });

  it('verwendet in keiner Nachricht beschämende Formulierungen', () => {
    const states = [
      'correct',
      'likely_correct',
      'possible_error',
      'unclear_audio',
      'self_corrected',
      'skipped',
      'unavailable',
    ] as const;
    const forbidden =
      /falsch|schlecht gelesen|zu langsam|versagt|unterdurchschnittlich|enttäuschend/i;
    for (const state of states) {
      const result = computeSessionStep({ evaluationState: state, retryCount: 0 });
      expect(result.message).not.toMatch(forbidden);
    }
  });
});

describe('resolveHelpOffered', () => {
  it('führt immer zu "advance" — keine Endlosschleife nach einer Hilfestellung', () => {
    const result = resolveHelpOffered();
    expect(result.uiState).toBe('advance');
    expect(result.shouldAdvance).toBe(true);
    expect(result.retryCount).toBe(0);
  });
});
