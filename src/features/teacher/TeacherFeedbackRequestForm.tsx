'use client';

import { useActionState } from 'react';
import { createTeacherFeedbackRequestAction } from '@/features/teacher/actions';
import type { FormActionState } from '@/features/auth/actions';

const initialState: FormActionState = {};

export function TeacherFeedbackRequestForm({
  childProfileId,
  teacherAccessGrantId,
}: {
  childProfileId: string;
  teacherAccessGrantId: string;
}) {
  const action = createTeacherFeedbackRequestAction.bind(
    null,
    childProfileId,
    teacherAccessGrantId,
  );
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.success) {
    return <p className="text-sm text-green-800">Anfrage gesendet.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="message"
        rows={2}
        placeholder="Kurze Nachricht (optional)"
        className="rounded-md border border-stone-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-800 disabled:opacity-60"
      >
        {isPending ? 'Wird gesendet …' : 'Um Rückmeldung bitten'}
      </button>
      {state.error && <p className="text-sm text-red-800">{state.error}</p>}
    </form>
  );
}
