'use client';

import { useActionState } from 'react';
import { submitTeacherFeedbackAction } from '@/features/teacher/actions';
import type { FormActionState } from '@/features/auth/actions';

const initialState: FormActionState = {};

export function TeacherFeedbackForm({ teacherAccessGrantId }: { teacherAccessGrantId: string }) {
  const action = submitTeacherFeedbackAction.bind(null, teacherAccessGrantId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="note" className="text-sm font-medium text-stone-700">
        Neue Rückmeldung für die Eltern
      </label>
      <textarea
        id="note"
        name="note"
        rows={4}
        required
        className="rounded-md border border-stone-300 px-3 py-2 text-base"
      />
      <p className="text-xs text-stone-500">
        Bitte als persönliche Einschätzung formulieren, nicht als Note oder Diagnose.
      </p>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Rückmeldung gesendet.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-amber-800 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? 'Wird gesendet …' : 'Rückmeldung senden'}
      </button>
    </form>
  );
}
