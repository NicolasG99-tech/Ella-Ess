import type { MicState } from '@/features/reading/useAudioRecorder';

const LABELS: Record<MicState, string> = {
  idle: 'Bereit zum Aufnehmen',
  requesting_permission: 'Mikrofon wird angefragt …',
  recording: 'Ich höre zu …',
  processing: 'Wird geprüft …',
  permission_denied: 'Kein Mikrofonzugriff',
  unsupported: 'Mikrofon hier nicht verfügbar',
  error: 'Es gab ein Problem',
};

const DOT_COLOR: Record<MicState, string> = {
  idle: 'bg-stone-300',
  requesting_permission: 'bg-amber-400',
  recording: 'bg-red-500',
  processing: 'bg-amber-400',
  permission_denied: 'bg-stone-400',
  unsupported: 'bg-stone-400',
  error: 'bg-stone-400',
};

export function MicStatus({ micState }: { micState: MicState }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700"
    >
      <span
        className={`h-3 w-3 rounded-full ${DOT_COLOR[micState]} ${micState === 'recording' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
        aria-hidden="true"
      />
      {LABELS[micState]}
    </div>
  );
}
