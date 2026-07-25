import { describe, expect, it } from 'vitest';
import { alignToTargetText, normalizeWord } from '@/lib/reading/positionTracker';
import type { RecognizedWord } from '@/lib/providers/speech/types';

const TARGET = ['Der', 'kleine', 'Igel', 'lebt', 'im', 'Wald', 'und', 'schläft'];

function words(...pairs: Array<[string, number]>): RecognizedWord[] {
  return pairs.map(([word, confidence]) => ({ word, confidence }));
}

describe('alignToTargetText', () => {
  it('rückt bei exakten aufeinanderfolgenden Treffern vor', () => {
    const result = alignToTargetText(
      words(['Der', 0.9], ['kleine', 0.9], ['Igel', 0.9]),
      TARGET,
      0,
    );
    expect(result.position).toBe(3);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.flags).toEqual({
      repetition: false,
      omission: false,
      selfCorrection: false,
      possibleMisreadWord: false,
    });
  });

  it('liefert bei leerer Eingabe die unveränderte Position mit Konfidenz 0', () => {
    const result = alignToTargetText([], TARGET, 2);
    expect(result).toEqual({
      position: 2,
      confidence: 0,
      flags: {
        repetition: false,
        omission: false,
        selfCorrection: false,
        possibleMisreadWord: false,
      },
    });
  });

  it('bewegt die Position nicht, wenn bereits am Textende', () => {
    const result = alignToTargetText(words(['schläft', 0.9]), TARGET, TARGET.length);
    expect(result.position).toBe(TARGET.length);
  });

  it('toleriert ein ausgelassenes Wort und markiert es als omission', () => {
    // "im" wird nicht gelesen/erkannt, "Wald" aber schon.
    const result = alignToTargetText(words(['lebt', 0.9], ['Wald', 0.9]), TARGET, 3);
    expect(result.flags.omission).toBe(true);
    expect(result.position).toBe(6);
  });

  it('erkennt eine Wiederholung und springt nicht zurück', () => {
    // Kind liest "Igel" (Position 2) erneut, obwohl schon bei Position 4.
    const result = alignToTargetText(words(['Igel', 0.9]), TARGET, 4);
    expect(result.flags.repetition).toBe(true);
    expect(result.position).toBe(4);
  });

  it('erkennt eine Selbstkorrektur, wenn ein zweiter Versuch am selben Wort erfolgreich ist', () => {
    // Erster Versuch bei "Igel" misslingt (unbekanntes Wort erkannt), zweiter passt.
    const result = alignToTargetText(
      words(['Der', 0.9], ['kleine', 0.9], ['Iglu', 0.9], ['Igel', 0.9]),
      TARGET,
      0,
    );
    expect(result.flags.selfCorrection).toBe(true);
    expect(result.position).toBe(3);
  });

  it('ignoriert ein zusätzlich gesprochenes Wort, ohne die Ausrichtung zu verlieren', () => {
    const result = alignToTargetText(
      words(['Der', 0.9], ['ähm', 0.9], ['kleine', 0.9], ['Igel', 0.9]),
      TARGET,
      0,
    );
    expect(result.position).toBe(3);
  });

  it('bewegt die Position nicht bei insgesamt zu geringer Konfidenz', () => {
    const result = alignToTargetText(words(['Der', 0.4], ['kleine', 0.4]), TARGET, 0);
    expect(result.position).toBe(0);
    expect(result.confidence).toBeLessThan(0.55);
  });

  it('behandelt sehr leise Wörter (unter dem Rauschschwellenwert) als nicht vorhanden', () => {
    const result = alignToTargetText(words(['Der', 0.9], ['xyz', 0.1], ['kleine', 0.9]), TARGET, 0);
    expect(result.position).toBe(2);
  });

  it('toleriert eine kleine Abweichung bei längeren Wörtern (Editierdistanz 1)', () => {
    // "Igek" statt "Igel" — eine einzelne Buchstabenabweichung.
    const result = alignToTargetText(words(['Igek', 0.8]), TARGET, 2);
    expect(result.position).toBe(3);
  });

  it('toleriert keine Fuzzy-Abweichung bei kurzen Wörtern', () => {
    // "im" (Position 4) vs. erkanntes "in" — beide kurz, kein Fuzzy-Match erlaubt.
    const result = alignToTargetText(words(['in', 0.9]), TARGET, 4);
    expect(result.position).toBe(4);
    expect(result.flags.possibleMisreadWord).toBe(true);
  });

  it('markiert ein mit brauchbarer Konfidenz erkanntes, aber unpassendes Wort als möglichen Fehler', () => {
    const result = alignToTargetText(words(['Elefant', 0.8]), TARGET, 0);
    expect(result.flags.possibleMisreadWord).toBe(true);
    expect(result.position).toBe(0);
  });

  it('sucht nur in einem begrenzten Fenster, kein Volltext-Rematch', () => {
    // "schläft" ist weit voraus (Index 7); von Position 0 aus außerhalb des Fensters (6).
    const result = alignToTargetText(words(['schläft', 0.95]), TARGET, 0);
    expect(result.position).toBe(0);
  });
});

describe('normalizeWord', () => {
  it('wandelt in Kleinbuchstaben um und trimmt', () => {
    expect(normalizeWord('  Igel ')).toBe('igel');
  });
});
