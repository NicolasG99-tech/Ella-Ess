import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { RegisterTeacherForm } from '@/features/teacher/RegisterTeacherForm';

export const metadata: Metadata = { title: 'Als Lehrkraft registrieren — Lese-Abenteuer' };

export default async function RegisterTeacherPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Als Lehrkraft registrieren</h1>
        <p className="mt-1 text-sm text-stone-600">
          Für Lehrkräfte, die von Eltern Einblick in die Übungsdaten eines Kindes erhalten. Dein
          Konto muss zunächst von einer Admin-Person verifiziert werden, bevor Eltern dir Zugriff
          geben können.
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Wichtig: Dieser Bereich ermöglicht ausschließlich freien Textaustausch auf Basis der in
          der App sichtbaren Übungsdaten — keine Notenvergabe und kein Ersatz für die reguläre
          schulische Einschätzung.
        </p>
      </div>
      <RegisterTeacherForm />
      <p className="text-sm text-stone-600">
        Bereits ein Konto?{' '}
        <Link href="/login" className="font-medium underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
