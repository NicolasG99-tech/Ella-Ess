'use client';

import { useActionState } from 'react';
import { grantSpecialistAccessAction } from '@/features/specialist/actions';
import type { FormActionState } from '@/features/auth/actions';

const initialState: FormActionState = {};

export function GrantSpecialistAccessForm({ childProfileId }: { childProfileId: string }) {
  const action = grantSpecialistAccessAction.bind(null, childProfileId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="specialistEmail" className="text-sm font-medium text-stone-700">
          E-Mail-Adresse der Fachkraft
        </label>
        <input
          id="specialistEmail"
          name="specialistEmail"
          type="email"
          required
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-amber-800 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Wird geprüft …' : 'Zugriff geben'}
      </button>
      {state.error && (
        <p role="alert" className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="w-full rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Zugriff erteilt.
        </p>
      )}
    </form>
  );
}
