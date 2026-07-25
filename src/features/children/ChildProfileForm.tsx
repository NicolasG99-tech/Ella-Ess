'use client';

import { useActionState } from 'react';
import type { FormActionState } from '@/features/auth/actions';
import { AVATAR_KEYS, LEARNING_PROFILE_CODES } from '@/lib/validation/child-profile';

const LEARNING_PROFILE_LABELS: Record<(typeof LEARNING_PROFILE_CODES)[number], string> = {
  reading_basics: 'Lesegrundlagen',
  fluency: 'Leseflüssigkeit',
  spelling_basics: 'Grundlegende Rechtschreibung',
};

const initialState: FormActionState = {};

interface ChildProfileFormProps {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  submitLabel: string;
  defaultValues?: {
    displayName: string;
    birthYear: number;
    avatarKey: string;
    currentLearningProfileCode?: string | null;
  };
}

export function ChildProfileForm({ action, submitLabel, defaultValues }: ChildProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const currentYear = new Date().getFullYear();

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium text-stone-700">
          Name oder Spitzname
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={40}
          defaultValue={defaultValues?.displayName}
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="birthYear" className="text-sm font-medium text-stone-700">
          Geburtsjahr
        </label>
        <input
          id="birthYear"
          name="birthYear"
          type="number"
          required
          min={currentYear - 12}
          max={currentYear - 5}
          defaultValue={defaultValues?.birthYear}
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-stone-700">Avatar</span>
        <div className="flex flex-wrap gap-3">
          {AVATAR_KEYS.map((key, index) => (
            <label key={key} className="flex cursor-pointer flex-col items-center gap-1 text-xs">
              <input
                type="radio"
                name="avatarKey"
                value={key}
                defaultChecked={(defaultValues?.avatarKey ?? 'avatar-01') === key}
                className="peer sr-only"
              />
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-stone-300 bg-amber-100 text-lg peer-checked:border-amber-800">
                {index + 1}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="currentLearningProfileCode" className="text-sm font-medium text-stone-700">
          Startprofil (unverbindliche Empfehlung, jederzeit änderbar)
        </label>
        <select
          id="currentLearningProfileCode"
          name="currentLearningProfileCode"
          defaultValue={defaultValues?.currentLearningProfileCode ?? ''}
          className="rounded-md border border-stone-300 px-3 py-2 text-base"
        >
          <option value="">Kein Profil ausgewählt</option>
          {LEARNING_PROFILE_CODES.map((code) => (
            <option key={code} value={code}>
              {LEARNING_PROFILE_LABELS[code]}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          Dies ist keine medizinische oder pädagogische Diagnose, sondern nur ein Startpunkt.
        </p>
      </div>

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
        {isPending ? 'Wird gespeichert …' : submitLabel}
      </button>
    </form>
  );
}
