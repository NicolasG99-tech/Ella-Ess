import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Anmelden — Lese-Abenteuer' };

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  const { callbackUrl, registered, reset } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Anmelden</h1>
        <p className="mt-1 text-sm text-stone-600">Melde dich mit deinem Elternkonto an.</p>
      </div>

      {registered === '1' && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Konto erstellt. Du kannst dich jetzt anmelden.
        </p>
      )}
      {reset === '1' && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Passwort geändert. Du kannst dich jetzt anmelden.
        </p>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <div className="flex flex-col gap-1 text-sm text-stone-600">
        <Link href="/passwort-vergessen" className="underline">
          Passwort vergessen?
        </Link>
        <p>
          Noch kein Konto?{' '}
          <Link href="/register" className="font-medium underline">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
