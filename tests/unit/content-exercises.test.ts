import { describe, expect, it } from 'vitest';
import { exercises } from '@/content/exercises';

function itemCount(type: string) {
  return exercises
    .filter((exercise) => exercise.type === type)
    .reduce((sum, exercise) => sum + exercise.items.length, 0);
}

describe('Übungs-Seed-Daten', () => {
  it('stellt mindestens 20 Wortübungen bereit', () => {
    expect(itemCount('word_reading')).toBeGreaterThanOrEqual(20);
  });

  it('stellt mindestens 10 Rechtschreibübungen bereit (alle vier Typen)', () => {
    const spellingTypes = ['spelling_gap_fill', 'letter_order', 'syllable_build', 'dictation'];
    const total = spellingTypes.reduce((sum, type) => sum + itemCount(type), 0);
    expect(total).toBeGreaterThanOrEqual(10);

    for (const type of spellingTypes) {
      expect(itemCount(type)).toBeGreaterThan(0);
    }
  });

  it('jedes Übungs-Item hat eine nicht-leere Lösung', () => {
    for (const exercise of exercises) {
      for (const item of exercise.items) {
        expect(item.solution.length).toBeGreaterThan(0);
      }
    }
  });

  it('Diktat-Übungen haben einen Audiotext', () => {
    const dictationExercises = exercises.filter((exercise) => exercise.type === 'dictation');
    expect(dictationExercises.length).toBeGreaterThan(0);
    for (const exercise of dictationExercises) {
      for (const item of exercise.items) {
        expect(item.audioText).toBeTruthy();
      }
    }
  });
});
