import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Neues Passwort — Lese-Abenteuer' };

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Neues Passwort festlegen</h1>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
