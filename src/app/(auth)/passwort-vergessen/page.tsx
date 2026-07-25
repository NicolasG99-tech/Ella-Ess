import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Passwort vergessen — Lese-Abenteuer' };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Passwort vergessen</h1>
        <p className="mt-1 text-sm text-stone-600">
          Gib deine E-Mail-Adresse ein. Falls ein Konto existiert, senden wir einen Link zum
          Zurücksetzen.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
