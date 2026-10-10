'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  markWordReadingCompleteAction,
  submitSpellingAttemptAction,
} from '@/features/exercises/actions';
import { RewardBadge, type RewardBadgeData } from '@/features/gamification/RewardBadge';

export interface ExerciseItemData {
  id: string;
  order: number;
  prompt: string;
  audioText: string | null;
}

interface ExercisePracticeProps {
  childProfileId: string;
  exercise: { id: string; type: string; title: string; items: ExerciseItemData[] };
  backHref: string;
}

interface SpellingFeedback {
  isCorrect: boolean;
  canRetry: boolean;
  solution: string | null;
  rateLimited?: boolean;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  window.speechSynthesis.speak(utterance);
}

// Kurzer, nicht wertender Hinweis bei Rate-Limit-Sperre (10 Aktionen/Min pro
// Kinderprofil, siehe checkChildContentRateLimit in lib/server/rate-limit.ts)
// — als eigene Komponente AUSSERHALB von ExercisePractice deklariert (nicht
// inline im Render), sonst verliert sie bei jedem Re-Render ihren Zustand
// (react-hooks/static-components-Lint-Regel) und wird bei jedem Tastenanschlag
// im Eingabefeld neu erzeugt.
function RateLimitHint() {
  return (
    <p role="status" className="rounded-md bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
      Kurze Pause — das war schnell hintereinander! Versuch es gleich noch einmal.
    </p>
  );
}

export function ExercisePractice({ childProfileId, exercise, backHref }: ExercisePracticeProps) {
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<SpellingFeedback | null>(null);
  const [wordRead, setWordRead] = useState(false);
  const [newRewards, setNewRewards] = useState<RewardBadgeData[]>([]);
  const [rateLimitNotice, setRateLimitNotice] = useState(false);
  const [isPending, startTransition] = useTransition();

  const item = exercise.items[index];
  const isWordReading = exercise.type === 'word_reading';
  const isDictation = exercise.type === 'dictation';

  if (!item) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-amber-900">Geschafft! 🎉</h1>
        <p className="text-lg text-amber-800">Du hast „{exercise.title}“ komplett geübt.</p>
        <Link
          href={backHref}
          className="rounded-full bg-amber-700 px-8 py-4 text-xl font-bold text-white shadow"
        >
          Zurück zu den Übungen
        </Link>
      </div>
    );
  }

  function goToNext() {
    setIndex((current) => current + 1);
    setInputValue('');
    setFeedback(null);
    setWordRead(false);
    setNewRewards([]);
    setRateLimitNotice(false);
  }

  function handleWordReadDone() {
    setWordRead(true);
    startTransition(async () => {
      const result = await markWordReadingCompleteAction({
        childProfileId,
        exerciseItemId: item.id,
      });
      // Bei Rate-Limit-Sperre wurde die Übung serverseitig NICHT als
      // abgeschlossen gespeichert — daher den optimistischen `wordRead`-Status
      // wieder zurücksetzen, statt fälschlich "geschafft" anzuzeigen.
      if (result.rateLimited) {
        setWordRead(false);
        setRateLimitNotice(true);
        return;
      }
      setRateLimitNotice(false);
      setNewRewards(result.newlyEarnedRewards);
    });
  }

  function handleSubmitAnswer() {
    if (!inputValue.trim()) return;
    startTransition(async () => {
      const result = await submitSpellingAttemptAction({
        childProfileId,
        exerciseItemId: item.id,
        submittedAnswer: inputValue,
      });
      setFeedback(result);
      setNewRewards(result.newlyEarnedRewards);
    });
  }

  function handleRetry() {
    setInputValue('');
    setFeedback(null);
    setNewRewards([]);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">{exercise.title}</h1>
        <Link
          href={backHref}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
        >
          Beenden
        </Link>
      </div>
      <p className="text-sm text-stone-600">
        Aufgabe {index + 1} von {exercise.items.length}
      </p>

      {isWordReading ? (
        <div className="flex flex-col items-center gap-6 rounded-xl border border-stone-200 bg-white p-10">
          <p className="text-4xl font-bold text-stone-900">{item.prompt}</p>
          {rateLimitNotice && <RateLimitHint />}
          {!wordRead ? (
            <button
              type="button"
              onClick={handleWordReadDone}
              disabled={isPending}
              className="rounded-full bg-amber-700 px-6 py-3 text-lg font-bold text-white shadow disabled:opacity-60"
            >
              Ich habe es gelesen
            </button>
          ) : (
            <>
              {newRewards.length > 0 && (
                <ul className="flex w-full flex-col gap-2 text-left">
                  {newRewards.map((reward, rewardIndex) => (
                    <RewardBadge key={`${reward.code}-${rewardIndex}`} reward={reward} />
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={goToNext}
                className="rounded-full bg-green-700 px-6 py-3 text-lg font-bold text-white shadow"
              >
                Weiter
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6">
          {isDictation ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-stone-600">Hör gut zu und schreib auf, was du hörst.</p>
              <button
                type="button"
                onClick={() => item.audioText && speak(item.audioText)}
                className="rounded-md border border-stone-300 px-4 py-2 font-medium text-stone-700"
              >
                Vorlesen
              </button>
            </div>
          ) : (
            <p className="text-center text-3xl font-bold tracking-wide text-stone-900">
              {item.prompt}
            </p>
          )}

          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={isPending || feedback !== null}
            aria-label="Deine Antwort"
            className="rounded-md border border-stone-300 px-3 py-2 text-center text-lg"
          />

          {feedback === null ? (
            <button
              type="button"
              onClick={handleSubmitAnswer}
              disabled={isPending || !inputValue.trim()}
              className="self-center rounded-md bg-amber-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              Antworten
            </button>
          ) : (
            <div
              role="status"
              className={`rounded-md px-4 py-3 text-center text-sm ${
                feedback.isCorrect ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'
              }`}
            >
              {feedback.rateLimited ? (
                <p>Kurze Pause — das war schnell hintereinander! Versuch es gleich noch einmal.</p>
              ) : feedback.isCorrect ? (
                <p>Super gemacht!</p>
              ) : feedback.canRetry ? (
                <p>Fast! Versuch es noch einmal.</p>
              ) : (
                <p>Die richtige Schreibweise ist: {feedback.solution}</p>
              )}
              {newRewards.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 text-left">
                  {newRewards.map((reward, rewardIndex) => (
                    <RewardBadge key={`${reward.code}-${rewardIndex}`} reward={reward} />
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-center gap-3">
                {!feedback.isCorrect && feedback.canRetry ? (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-md border border-amber-400 bg-white px-3 py-1.5 font-medium text-amber-800"
                  >
                    Nochmal versuchen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToNext}
                    className="rounded-md bg-amber-700 px-4 py-2 font-medium text-white"
                  >
                    Weiter
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
