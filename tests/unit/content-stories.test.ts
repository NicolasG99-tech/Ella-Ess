import { describe, expect, it } from 'vitest';
import { stories } from '@/content/stories';

const REQUIRED_ILLUSTRATION_LAYERS = [
  'background',
  'main_character',
  'object',
  'secondary_character',
  'final_scene',
];

describe('Story-Seed-Daten', () => {
  it('enthält mindestens 5 Geschichten', () => {
    expect(stories.length).toBeGreaterThanOrEqual(5);
  });

  it('deckt alle 3 Schwierigkeitsstufen ab', () => {
    const levels = new Set(stories.map((s) => s.difficultyLevel));
    expect(levels).toEqual(new Set([1, 2, 3]));
  });

  it('hat eindeutige Slugs', () => {
    const slugs = stories.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const story of stories) {
    describe(story.slug, () => {
      it('hat Titel, Beschreibung und Lernziele', () => {
        expect(story.title.length).toBeGreaterThan(0);
        expect(story.description.length).toBeGreaterThan(0);
        expect(story.learningGoals.length).toBeGreaterThan(0);
      });

      it('hat mindestens 3 Textabschnitte mit fortlaufender Reihenfolge', () => {
        expect(story.sections.length).toBeGreaterThanOrEqual(3);
        story.sections.forEach((section, index) => expect(section.order).toBe(index));
      });

      it('hat genau die 5 geforderten Illustrationsebenen', () => {
        const names = story.illustrationLayers.map((layer) => layer.name).sort();
        expect(names).toEqual([...REQUIRED_ILLUSTRATION_LAYERS].sort());
      });

      it('schaltet Illustrationen erst nach einem existierenden Abschnitt frei', () => {
        const maxSectionOrder = story.sections.length - 1;
        for (const layer of story.illustrationLayers) {
          expect(layer.unlockAfterSectionOrder).toBeGreaterThanOrEqual(0);
          expect(layer.unlockAfterSectionOrder).toBeLessThanOrEqual(maxSectionOrder);
        }
      });

      it('hat 2 bis 4 Verständnisfragen (Vorgabe: 2–4 pro Text)', () => {
        expect(story.comprehensionQuestions.length).toBeGreaterThanOrEqual(2);
        expect(story.comprehensionQuestions.length).toBeLessThanOrEqual(4);
      });

      it('jede Verständnisfrage hat eine korrekte Antwort', () => {
        for (const question of story.comprehensionQuestions) {
          expect(question.correctAnswer).toBeDefined();
        }
      });
    });
  }

  it('stellt insgesamt mindestens 15 Verständnisfragen bereit', () => {
    const total = stories.reduce((sum, story) => sum + story.comprehensionQuestions.length, 0);
    expect(total).toBeGreaterThanOrEqual(15);
  });
});
