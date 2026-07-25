import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { RegisterSpecialistForm } from '@/features/specialist/RegisterSpecialistForm';

export const metadata: Metadata = { title: 'Als Fachkraft registrieren — Lese-Abenteuer' };

export default async function RegisterSpecialistPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Als Fachkraft registrieren</h1>
        <p className="mt-1 text-sm text-stone-600">
          Für Logopäd:innen, Ergotherapeut:innen und andere Fachpersonen, die von Eltern Einblick in
          die Übungsdaten eines Kindes erhalten. Dein Konto muss zunächst von einer Admin-Person
          verifiziert werden, bevor Eltern dir Zugriff geben können.
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Wichtig: Dieser Bereich ermöglicht ausschließlich freien Textaustausch auf Basis der in
          der App sichtbaren Übungsdaten — keine Diagnose, keine Therapieplanung und kein Ersatz für
          eine reguläre Untersuchung.
        </p>
      </div>
      <RegisterSpecialistForm />
      <p className="text-sm text-stone-600">
        Bereits ein Konto?{' '}
        <Link href="/login" className="font-medium underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
