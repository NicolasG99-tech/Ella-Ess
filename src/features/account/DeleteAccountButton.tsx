'use client';

import { useState, useTransition } from 'react';
import { signOut } from 'next-auth/react';
import { deleteOwnAccountAction } from '@/features/account/actions';

// Erfordert Tippen der eigenen E-Mail-Adresse zur Bestätigung — höhere
// Hürde als beim Löschen eines Kinderprofils (DeleteChildProfileButton.tsx),
// da hier zusätzlich der Zugang selbst und ggf. alle Kinderprofile betroffen
// sind.
export function DeleteAccountButton({
  email,
  hasChildProfiles,
}: {
  email: string;
  hasChildProfiles: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-700 underline"
      >
        Konto endgültig löschen
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-md bg-red-50 p-4 text-sm text-red-900">
      <p>
        Dein Konto{hasChildProfiles ? ' und alle Kinderprofile mit ihren Lerndaten' : ''} werden
        endgültig gelöscht. Das kann nicht rückgängig gemacht werden.
      </p>
      <label className="flex w-full flex-col gap-1">
        <span>
          Tippe zur Bestätigung deine E-Mail-Adresse (<strong>{email}</strong>) ein:
        </span>
        <input
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          className="rounded-md border border-red-300 px-3 py-2 text-base text-stone-900"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending || confirmText !== email}
          onClick={() =>
            startTransition(async () => {
              await deleteOwnAccountAction();
              await signOut({ callbackUrl: '/' });
            })
          }
          className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
        >
          {isPending ? 'Wird gelöscht …' : 'Endgültig löschen'}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText('');
          }}
          className="rounded-md border border-red-300 px-3 py-1.5 font-medium text-red-800"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
