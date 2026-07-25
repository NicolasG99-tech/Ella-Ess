import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Bewusst nur eine Mindestlänge, keine erzwungenen Zeichenklassen (NIST-konform:
// Länge schlägt künstliche Komplexitätsregeln).
export const passwordSchema = z
  .string()
  .min(10, 'Das Passwort muss mindestens 10 Zeichen lang sein.')
  .max(200);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  acceptedTerms: z.literal(true, 'Du musst den Nutzungsbedingungen zustimmen.'),
  acceptedPrivacy: z.literal(true, 'Du musst der Datenschutzerklärung zustimmen.'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
