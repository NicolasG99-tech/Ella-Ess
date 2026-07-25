'use server';

import { randomUUID } from 'node:crypto';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/server/db';
import { signIn, signOut } from '@/lib/server/auth';
import { hashPassword, verifyPassword } from '@/lib/server/password';
import { logAuditEvent } from '@/lib/server/audit';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { sendPasswordResetEmail } from '@/lib/server/email';
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';

// Aktuelle Fassung von Nutzungsbedingungen/Datenschutzerklärung. Bei inhaltlichen
// Änderungen erhöhen, damit Bestandsnutzer erneut zustimmen müssten (hier noch
// nicht erzwungen — siehe docs/SECURITY.md, Produktionsanforderungen).
const CONSENT_VERSION = '2026-07-15';

export interface FormActionState {
  error?: string;
  success?: boolean;
}

export async function registerAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
    acceptedTerms: formData.get('acceptedTerms') === 'on',
    acceptedPrivacy: formData.get('acceptedPrivacy') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const { email, password, name } = parsed.data;

  if (!(await checkRateLimit(`register:${email}`, 5, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'Für diese E-Mail-Adresse existiert bereits ein Konto.' };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      consentRecords: {
        create: [
          { type: 'terms_of_service', version: CONSENT_VERSION },
          { type: 'privacy_policy', version: CONSENT_VERSION },
        ],
      },
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'user.register',
    targetType: 'User',
    targetId: user.id,
  });

  redirect('/login?registered=1');
}

export async function loginAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'Bitte gib E-Mail-Adresse und Passwort ein.' };
  }

  const { email, password } = parsed.data;

  if (!(await checkRateLimit(`login:${email}`, 8, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const callbackUrl = (formData.get('callbackUrl') as string) || '/dashboard';

  try {
    await signIn('credentials', { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'E-Mail-Adresse oder Passwort ist falsch.' };
    }
    throw error;
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

export async function requestPasswordResetAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }

  const { email } = parsed.data;

  if (!(await checkRateLimit(`pwreset:${email}`, 3, 60_000))) {
    return { error: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.' };
  }

  const user = await db.user.findUnique({ where: { email } });

  // Gleiche Antwort unabhängig davon, ob das Konto existiert — verhindert,
  // dass über diesen Endpunkt registrierte E-Mail-Adressen erraten werden können.
  if (user) {
    const token = randomUUID();
    await db.verificationToken.create({
      data: { identifier: email, token, expires: new Date(Date.now() + 30 * 60 * 1000) },
    });

    // Echter Versand über Brevo, sofern BREVO_API_KEY konfiguriert ist — sonst
    // Fallback auf Server-Log wie bisher (siehe lib/server/email.ts).
    await sendPasswordResetEmail(email, token);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'user.password_reset_requested',
      targetType: 'User',
      targetId: user.id,
    });
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.' };
  }

  const { token, password } = parsed.data;

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return { error: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' };
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } });
  if (!user) {
    return { error: 'Der Link ist ungültig.' };
  }

  const isSamePassword = await verifyPassword(user.passwordHash, password);
  const passwordHash = isSamePassword ? user.passwordHash : await hashPassword(password);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.verificationToken.delete({ where: { token } }),
  ]);

  await logAuditEvent({
    actorUserId: user.id,
    action: 'user.password_reset_completed',
    targetType: 'User',
    targetId: user.id,
  });

  redirect('/login?reset=1');
}
