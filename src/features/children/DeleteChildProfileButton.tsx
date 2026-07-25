'use client';

import { useState, useTransition } from 'react';
import { deleteChildProfileAction } from '@/features/children/actions';

export function DeleteChildProfileButton({
  childProfileId,
  displayName,
}: {
  childProfileId: string;
  displayName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-700 underline"
      >
        Kinderprofil löschen
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
      <p>
        „{displayName}“ und alle zugehörigen Lerndaten werden endgültig gelöscht. Das kann nicht
        rückgängig gemacht werden.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteChildProfileAction(childProfileId))}
          className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Wird gelöscht …' : 'Endgültig löschen'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-red-300 px-3 py-1.5 font-medium text-red-800"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
