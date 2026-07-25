import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/lib/validation/auth';

export const registerSpecialistSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  credentials: z.string().trim().max(500).optional(),
  acceptedTerms: z.literal(true, 'Du musst den Nutzungsbedingungen zustimmen.'),
  acceptedPrivacy: z.literal(true, 'Du musst der Datenschutzerklärung zustimmen.'),
});

export const grantSpecialistAccessSchema = z.object({
  specialistEmail: emailSchema,
});

export const createFeedbackRequestSchema = z.object({
  childAccessGrantId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
});

export const submitSpecialistFeedbackSchema = z.object({
  childAccessGrantId: z.string().min(1),
  note: z.string().trim().min(1, 'Bitte gib eine Rückmeldung ein.').max(2000),
});
