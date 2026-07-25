'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { registerSpecialistAction } from '@/features/specialist/actions';
import type { FormActionState } from '@/features/auth/actions';

const initialState: FormActionState = {};

export function RegisterSpecialistForm() {
  const [state, formAction, isPending] = useActionState(registerSpecialistAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-stone-700">
          Name (optional)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-stone-700">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-stone-700">
          Passwort (mindestens 10 Zeichen)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="credentials" className="text-sm font-medium text-stone-700">
          Qualifikation (optional, z.B. „Logopädin, zugelassen bei …“)
        </label>
        <textarea
          id="credentials"
          name="credentials"
          rows={2}
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
        <p className="text-xs text-stone-500">
          Wird von einer Admin-Person geprüft, bevor Eltern dir Zugriff geben können.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="acceptedTerms" required className="mt-1" />
        <span>
          Ich stimme den{' '}
          <Link href="/nutzungsbedingungen" className="underline">
            Nutzungsbedingungen
          </Link>{' '}
          zu.
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="acceptedPrivacy" required className="mt-1" />
        <span>
          Ich habe die{' '}
          <Link href="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>{' '}
          gelesen und stimme der Verarbeitung wie beschrieben zu.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-amber-800 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Wird erstellt …' : 'Konto erstellen'}
      </button>
    </form>
  );
}
