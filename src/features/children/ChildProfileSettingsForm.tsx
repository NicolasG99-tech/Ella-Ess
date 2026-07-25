'use client';

import { useActionState } from 'react';
import { updateChildProfileSettingsAction } from '@/features/children/actions';
import type { FormActionState } from '@/features/auth/actions';

const initialState: FormActionState = {};

interface ChildProfileSettingsFormProps {
  childProfileId: string;
  defaultValues: {
    fontScale: number;
    lineSpacingScale: number;
    reducedMotion: boolean;
    audioHintsEnabled: boolean;
  };
}

export function ChildProfileSettingsForm({
  childProfileId,
  defaultValues,
}: ChildProfileSettingsFormProps) {
  const action = updateChildProfileSettingsAction.bind(null, childProfileId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fontScale" className="text-sm font-medium text-stone-700">
          Schriftgröße ({defaultValues.fontScale.toFixed(1)}×)
        </label>
        <input
          id="fontScale"
          name="fontScale"
          type="range"
          min={0.8}
          max={2}
          step={0.1}
          defaultValue={defaultValues.fontScale}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="lineSpacingScale" className="text-sm font-medium text-stone-700">
          Zeilenabstand ({defaultValues.lineSpacingScale.toFixed(1)}×)
        </label>
        <input
          id="lineSpacingScale"
          name="lineSpacingScale"
          type="range"
          min={0.8}
          max={2}
          step={0.1}
          defaultValue={defaultValues.lineSpacingScale}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="reducedMotion" defaultChecked={defaultValues.reducedMotion} />
        Reduzierte Animationen
      </label>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="audioHintsEnabled"
          defaultChecked={defaultValues.audioHintsEnabled}
        />
        Audio-Hilfen aktiviert
      </label>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Einstellungen gespeichert.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-stone-300 px-4 py-2 font-medium text-stone-800 disabled:opacity-60"
      >
        {isPending ? 'Wird gespeichert …' : 'Einstellungen speichern'}
      </button>
    </form>
  );
}
