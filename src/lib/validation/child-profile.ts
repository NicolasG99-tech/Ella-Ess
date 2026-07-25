import { z } from 'zod';

export const MAX_CHILD_PROFILES_PER_PARENT = 3;

export const LEARNING_PROFILE_CODES = ['reading_basics', 'fluency', 'spelling_basics'] as const;

export const AVATAR_KEYS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
] as const;

const currentYear = new Date().getFullYear();

// Zielgruppe ist 7–10 Jahre; etwas Spielraum an den Rändern, damit Geburtstage
// innerhalb des Jahres nicht zu einer künstlichen Fehlermeldung führen.
export const birthYearSchema = z
  .number()
  .int()
  .min(currentYear - 12, 'Bitte gib ein plausibles Geburtsjahr ein.')
  .max(currentYear - 5, 'Bitte gib ein plausibles Geburtsjahr ein.');

export const childProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Bitte gib einen Namen oder Spitznamen ein.').max(40),
  birthYear: birthYearSchema,
  avatarKey: z.enum(AVATAR_KEYS).default('avatar-01'),
  currentLearningProfileCode: z.enum(LEARNING_PROFILE_CODES).optional(),
});

export const childProfileSettingsSchema = z.object({
  fontScale: z.number().min(0.8).max(2),
  lineSpacingScale: z.number().min(0.8).max(2),
  reducedMotion: z.boolean(),
  audioHintsEnabled: z.boolean(),
});
