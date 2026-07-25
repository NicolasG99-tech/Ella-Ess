import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Konto erstellen — Lese-Abenteuer' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Elternkonto erstellen</h1>
        <p className="mt-1 text-sm text-stone-600">
          Für dein Kind erstellst du danach ein eigenes Kinderprofil — es benötigt keine eigene
          E-Mail-Adresse.
        </p>
      </div>
      <RegisterForm />
      <p className="text-sm text-stone-600">
        Bereits ein Konto?{' '}
        <Link href="/login" className="font-medium underline">
          Anmelden
        </Link>
      </p>
      <p className="text-sm text-stone-600">
        Bist du eine Fachkraft (Logopädie, Ergotherapie o.ä.)?{' '}
        <Link href="/registrieren-fachkraft" className="font-medium underline">
          Hier registrieren
        </Link>
      </p>
      <p className="text-sm text-stone-600">
        Bist du Lehrkraft?{' '}
        <Link href="/registrieren-lehrer" className="font-medium underline">
          Hier registrieren
        </Link>
      </p>
    </div>
  );
}
