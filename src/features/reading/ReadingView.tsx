'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useAudioRecorder } from '@/features/reading/useAudioRecorder';
import { prepareAudioForRealProvider } from '@/lib/providers/speech/audioPreprocessing';
import { MicStatus } from '@/features/reading/MicStatus';
import { ProgressBar } from '@/features/reading/ProgressBar';
import { IllustrationStack, type UnlockedLayer } from '@/features/reading/IllustrationStack';
import {
  ComprehensionQuiz,
  type ComprehensionQuestionData,
} from '@/features/comprehension/ComprehensionQuiz';
import { RewardBadge, type RewardBadgeData } from '@/features/gamification/RewardBadge';
import {
  startOrResumeReadingSessionAction,
  submitReadingAttemptAction,
  resolveHelpAction,
} from '@/features/reading/actions';
import type { MockScenario } from '@/lib/providers/speech/types';
import type { ReadingStepUiState } from '@/lib/reading/sessionStateMachine';

interface StorySection {
  order: number;
  text: string;
  words: string[];
}

interface ChildSettings {
  fontScale: number;
  lineSpacingScale: number;
  reducedMotion: boolean;
  audioHintsEnabled: boolean;
}

interface ReadingViewProps {
  childProfileId: string;
  story: {
    slug: string;
    title: string;
    sections: StorySection[];
    totalIllustrationLayers: number;
    comprehensionQuestions: ComprehensionQuestionData[];
  };
  childSettings: ChildSettings;
  isMockProvider: boolean;
  /** Nur relevant bei echtem Provider, siehe audioPreprocessing.ts. */
  pitchShiftRate?: number | null;
  backHref: string;
}

type Phase = 'intro' | 'reading' | 'comprehension' | 'finished';

const MOCK_SCENARIO_OPTIONS: { value: MockScenario | ''; label: string }[] = [
  { value: '', label: 'Zufällig (realistisch)' },
  { value: 'correct', label: 'Richtig gelesen' },
  { value: 'likely_correct', label: 'Wahrscheinlich richtig' },
  { value: 'possible_error', label: 'Möglicher Fehler' },
  { value: 'unclear_audio', label: 'Undeutliches Audio' },
  { value: 'self_corrected', label: 'Selbstkorrektur' },
  { value: 'skipped_word', label: 'Ausgelassenes Wort' },
  { value: 'extra_word', label: 'Zusätzliches Wort' },
  { value: 'unavailable', label: 'Dienst nicht verfügbar' },
];

function splitDisplayTokens(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

const STATE_STYLES: Record<ReadingStepUiState, string> = {
  advance: 'bg-green-50 text-green-900',
  clarify_retry: 'bg-amber-50 text-amber-900',
  gentle_hint: 'bg-amber-50 text-amber-900',
  help_offered: 'bg-blue-50 text-blue-900',
  provider_unavailable: 'bg-stone-100 text-stone-700',
};

export function ReadingView({
  childProfileId,
  story,
  childSettings,
  isMockProvider,
  pitchShiftRate,
  backHref,
}: ReadingViewProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState(0);
  const [localPosition, setLocalPosition] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [uiState, setUiState] = useState<ReadingStepUiState>('advance');
  const [message, setMessage] = useState('');
  const [forcedScenario, setForcedScenario] = useState<MockScenario | ''>('');
  const [unlockedLayers, setUnlockedLayers] = useState<UnlockedLayer[]>([]);
  const [justUnlockedIds, setJustUnlockedIds] = useState<Set<string>>(new Set());
  const [earnedRewards, setEarnedRewards] = useState<RewardBadgeData[]>([]);
  const [isPending, startTransition] = useTransition();
  const { micState, isSupported, start, stop, cancel, reset } = useAudioRecorder({
    captureAudio: !isMockProvider,
  });

  const currentSection = story.sections.find((section) => section.order === sectionOrder);
  const totalSections = story.sections.length;
  const displayTokens = useMemo(
    () => (currentSection ? splitDisplayTokens(currentSection.text) : []),
    [currentSection],
  );

  const showingFeedback = [
    'clarify_retry',
    'gentle_hint',
    'help_offered',
    'provider_unavailable',
  ].includes(uiState);
  const canAct = phase === 'reading' && !isPending && micState !== 'processing';

  function handleReadAloud() {
    if (!currentSection || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentSection.text);
    utterance.lang = 'de-DE';
    window.speechSynthesis.speak(utterance);
  }

  function handleStart() {
    startTransition(async () => {
      const result = await startOrResumeReadingSessionAction(childProfileId, story.slug);
      setSessionId(result.sessionId);
      setSectionOrder(result.currentSectionOrder);
      setLocalPosition(0);
      setRetryCount(0);
      setUiState('advance');
      setMessage('');
      setUnlockedLayers(result.unlockedIllustrations);
      setJustUnlockedIds(new Set());
      setEarnedRewards([]);
      setPhase('reading');
    });
  }

  async function handleFinishRecording() {
    const recordedBlob = await stop();
    if (!sessionId) return;

    // Nur bei echtem Provider tatsächlich aufbereiten/übertragen — im
    // Mock-Modus ist recordedBlob wegen `captureAudio: !isMockProvider`
    // ohnehin immer null (siehe useAudioRecorder.ts).
    let preparedAudio: Blob | undefined;
    if (!isMockProvider && recordedBlob) {
      preparedAudio = await prepareAudioForRealProvider(recordedBlob, { pitchShiftRate });
    }

    startTransition(async () => {
      const result = await submitReadingAttemptAction({
        sessionId,
        childProfileId,
        sectionOrder,
        localPosition,
        retryCount,
        forcedScenario: forcedScenario || undefined,
        audio: preparedAudio,
      });
      applyStepResult(result);
      reset();
    });
  }

  // Erlaubt, ein Ergebnis direkt zu simulieren, ohne den Mikrofon-Roundtrip zu
  // durchlaufen — nützlich für Demos/Tests ohne funktionierendes Mikrofon,
  // da der Mock-Provider ohnehin keine echten Audiodaten auswertet.
  function handleSimulateWithoutRecording() {
    if (!sessionId || !forcedScenario) return;
    startTransition(async () => {
      const result = await submitReadingAttemptAction({
        sessionId,
        childProfileId,
        sectionOrder,
        localPosition,
        retryCount,
        forcedScenario,
      });
      applyStepResult(result);
    });
  }

  function handleHelp() {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await resolveHelpAction({
        sessionId,
        childProfileId,
        sectionOrder,
        localPosition,
      });
      applyStepResult(result);
      reset();
    });
  }

  function applyStepResult(result: {
    uiState: ReadingStepUiState;
    message: string;
    retryCount: number;
    newLocalPosition: number;
    sectionComplete: boolean;
    sessionComplete: boolean;
    newlyUnlockedIllustrations: UnlockedLayer[];
    newlyEarnedRewards: RewardBadgeData[];
  }) {
    setMessage(result.message);
    setRetryCount(result.retryCount);

    if (result.newlyUnlockedIllustrations.length > 0) {
      setUnlockedLayers((current) => [...current, ...result.newlyUnlockedIllustrations]);
      setJustUnlockedIds(new Set(result.newlyUnlockedIllustrations.map((layer) => layer.id)));
    } else {
      setJustUnlockedIds(new Set());
    }

    if (result.newlyEarnedRewards.length > 0) {
      setEarnedRewards((current) => [...current, ...result.newlyEarnedRewards]);
    }

    if (result.sessionComplete) {
      setPhase(story.comprehensionQuestions.length > 0 ? 'comprehension' : 'finished');
      return;
    }
    if (result.sectionComplete) {
      setSectionOrder((current) => current + 1);
      setLocalPosition(0);
      setUiState('advance');
      return;
    }
    setLocalPosition(result.newLocalPosition);
    setUiState(result.uiState);
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-900">{story.title}</h1>
        <p className="max-w-md text-lg text-amber-800">
          Wenn du bereit bist, drücke auf Start. Du kannst jederzeit eine Pause machen.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="rounded-full bg-amber-700 px-8 py-4 text-xl font-bold text-white shadow disabled:opacity-60"
        >
          {isPending ? 'Wird geladen …' : 'Los geht’s!'}
        </button>
        <Link href={backHref} className="text-sm text-amber-800 underline">
          Zurück zur Auswahl
        </Link>
      </div>
    );
  }

  if (phase === 'comprehension' && sessionId) {
    return (
      <ComprehensionQuiz
        childProfileId={childProfileId}
        sessionId={sessionId}
        questions={story.comprehensionQuestions}
        onAllComplete={() => setPhase('finished')}
      />
    );
  }

  if (phase === 'finished') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-900">Fertig gelesen! 🎉</h1>
        <IllustrationStack
          unlockedLayers={unlockedLayers}
          totalLayers={story.totalIllustrationLayers}
          justUnlockedIds={justUnlockedIds}
          reducedMotion={childSettings.reducedMotion}
        />
        <p className="max-w-md text-lg text-amber-800">Du hast „{story.title}“ zu Ende gelesen.</p>
        {earnedRewards.length > 0 && (
          <ul className="flex w-full flex-col gap-2 text-left">
            {earnedRewards.map((reward, index) => (
              <RewardBadge key={`${reward.code}-${index}`} reward={reward} />
            ))}
          </ul>
        )}
        <Link
          href={backHref}
          className="rounded-full bg-amber-700 px-8 py-4 text-xl font-bold text-white shadow"
        >
          Zurück zur Auswahl
        </Link>
      </div>
    );
  }

  if (!currentSection) {
    return null;
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10"
      style={{ fontSize: `${childSettings.fontScale}rem` }}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-stone-900">{story.title}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              cancel();
              setPhase('intro');
            }}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
          >
            Pause
          </button>
          <Link
            href={backHref}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
          >
            Beenden
          </Link>
        </div>
      </div>

      <ProgressBar
        current={sectionOrder}
        total={totalSections}
        label={`Abschnitt ${sectionOrder + 1} von ${totalSections}`}
      />

      <IllustrationStack
        unlockedLayers={unlockedLayers}
        totalLayers={story.totalIllustrationLayers}
        justUnlockedIds={justUnlockedIds}
        reducedMotion={childSettings.reducedMotion}
      />

      <p
        className="rounded-xl border border-stone-200 bg-white p-6 leading-relaxed"
        style={{ lineHeight: childSettings.lineSpacingScale * 1.7 }}
      >
        {displayTokens.map((token, index) => (
          <span
            key={index}
            className={
              index < localPosition
                ? 'text-green-800'
                : index === localPosition
                  ? 'rounded bg-amber-200 px-1 font-bold text-amber-950'
                  : 'text-stone-800'
            }
          >
            {token}{' '}
          </span>
        ))}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <MicStatus micState={micState} />
        {childSettings.audioHintsEnabled && (
          <button
            type="button"
            onClick={handleReadAloud}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
          >
            Text vorlesen lassen
          </button>
        )}
      </div>

      {!isSupported && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Dein Browser unterstützt keine Mikrofonaufnahme. Bitte verwende einen aktuellen Chrome-,
          Safari-, Firefox- oder Edge-Browser.
        </p>
      )}
      {micState === 'permission_denied' && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ohne Mikrofonzugriff kann nicht zugehört werden. Du kannst den Zugriff in den
          Browser-Einstellungen erlauben und es erneut versuchen.
        </p>
      )}

      {showingFeedback && message && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${STATE_STYLES[uiState]}`}>
          {message}
        </p>
      )}

      {uiState === 'help_offered' ? (
        <div className="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-lg font-semibold text-blue-950">
            {displayTokens[localPosition] ?? ''}
          </p>
          <button
            type="button"
            onClick={handleHelp}
            disabled={isPending}
            className="self-start rounded-md bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            Weiter
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {micState === 'idle' || micState === 'permission_denied' || micState === 'unsupported' ? (
            <button
              type="button"
              onClick={start}
              disabled={!canAct || !isSupported}
              className="rounded-full bg-amber-700 px-6 py-3 text-lg font-bold text-white shadow disabled:opacity-60"
            >
              Aufnahme starten
            </button>
          ) : micState === 'recording' ? (
            <button
              type="button"
              onClick={handleFinishRecording}
              disabled={isPending}
              className="rounded-full bg-red-700 px-6 py-3 text-lg font-bold text-white shadow disabled:opacity-60"
            >
              Fertig
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-full bg-stone-300 px-6 py-3 text-lg font-bold text-stone-600"
            >
              {micState === 'requesting_permission' ? 'Warte auf Mikrofon …' : 'Wird geprüft …'}
            </button>
          )}

          <button
            type="button"
            onClick={handleHelp}
            disabled={!canAct}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-60"
          >
            Ich brauche Hilfe
          </button>
        </div>
      )}

      {isMockProvider && (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-600">
          <label htmlFor="mock-scenario" className="font-medium">
            Entwickler-Testmodus: nächstes Ergebnis simulieren
          </label>
          <select
            id="mock-scenario"
            value={forcedScenario}
            onChange={(event) => setForcedScenario(event.target.value as MockScenario | '')}
            className="rounded-md border border-stone-300 px-2 py-1"
          >
            {MOCK_SCENARIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {forcedScenario && (
            <button
              type="button"
              onClick={handleSimulateWithoutRecording}
              disabled={isPending || micState === 'recording'}
              className="self-start rounded-md border border-stone-400 bg-white px-3 py-1.5 font-medium text-stone-700 disabled:opacity-60"
            >
              Ergebnis simulieren (ohne Aufnahme)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
