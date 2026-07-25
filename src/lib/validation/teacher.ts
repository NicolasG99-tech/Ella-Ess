import { z } from 'zod';
import { emailSchema, passwordSchema } from '@/lib/validation/auth';

export const registerTeacherSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
  schoolName: z.string().trim().max(500).optional(),
  acceptedTerms: z.literal(true, 'Du musst den Nutzungsbedingungen zustimmen.'),
  acceptedPrivacy: z.literal(true, 'Du musst der Datenschutzerklärung zustimmen.'),
});

export const grantTeacherAccessSchema = z.object({
  teacherEmail: emailSchema,
});

export const createTeacherFeedbackRequestSchema = z.object({
  teacherAccessGrantId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
});

export const submitTeacherFeedbackSchema = z.object({
  teacherAccessGrantId: z.string().min(1),
  note: z.string().trim().min(1, 'Bitte gib eine Rückmeldung ein.').max(2000),
});
