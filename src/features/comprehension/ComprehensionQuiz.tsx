'use client';

import { useMemo, useState, useTransition } from 'react';
import { submitComprehensionAnswerAction } from '@/features/comprehension/actions';

export interface ComprehensionQuestionData {
  id: string;
  order: number;
  type: 'multiple_choice' | 'ordering' | 'statement' | 'inference';
  prompt: string;
  options: string[] | null;
}

interface ComprehensionQuizProps {
  childProfileId: string;
  sessionId: string;
  questions: ComprehensionQuestionData[];
  onAllComplete: () => void;
}

function formatCorrectAnswer(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Richtig' : 'Falsch';
  if (Array.isArray(value)) return value.join(' → ');
  return null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface AnswerFeedback {
  isCorrect: boolean;
  canRetry: boolean;
  hintText: string | null;
  correctAnswer: unknown;
  rateLimited?: boolean;
}

export function ComprehensionQuiz({
  childProfileId,
  sessionId,
  questions,
  onAllComplete,
}: ComprehensionQuizProps) {
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const question = questions[index];
  const shuffledOptions = useMemo(
    () => (question?.options ? shuffle(question.options) : []),
    [question],
  );
  const remainingOptions = useMemo(
    () => shuffledOptions.filter((option) => !orderedItems.includes(option)),
    [shuffledOptions, orderedItems],
  );

  if (!question) {
    return null;
  }

  function resetForNextQuestion() {
    setSelectedOption(null);
    setOrderedItems([]);
    setFeedback(null);
  }

  function handleSubmit(submittedAnswer: unknown) {
    startTransition(async () => {
      const result = await submitComprehensionAnswerAction({
        childProfileId,
        sessionId,
        questionId: question.id,
        submittedAnswer,
      });
      setFeedback(result);
    });
  }

  function handleRetry() {
    setSelectedOption(null);
    setOrderedItems([]);
    setFeedback(null);
  }

  function handleNext() {
    if (index + 1 < questions.length) {
      setIndex((current) => current + 1);
      resetForNextQuestion();
    } else {
      onAllComplete();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium text-amber-700">
          Frage {index + 1} von {questions.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">{question.prompt}</h1>
      </div>

      {question.type === 'statement' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedOption('true');
              handleSubmit(true);
            }}
            disabled={isPending || feedback !== null}
            className="flex-1 rounded-lg border-2 border-amber-300 bg-white px-4 py-4 text-lg font-semibold text-stone-800 disabled:opacity-60"
          >
            Richtig
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedOption('false');
              handleSubmit(false);
            }}
            disabled={isPending || feedback !== null}
            className="flex-1 rounded-lg border-2 border-amber-300 bg-white px-4 py-4 text-lg font-semibold text-stone-800 disabled:opacity-60"
          >
            Falsch
          </button>
        </div>
      ) : question.type === 'ordering' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stone-600">Deine Reihenfolge:</span>
            <ol className="flex flex-col gap-2">
              {orderedItems.map((item, position) => (
                <li
                  key={item}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-stone-800"
                >
                  {position + 1}. {item}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            {remainingOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setOrderedItems((current) => [...current, option])}
                disabled={isPending || feedback !== null}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-800 disabled:opacity-60"
              >
                {option}
              </button>
            ))}
          </div>
          {feedback === null && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOrderedItems([])}
                disabled={isPending || orderedItems.length === 0}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-60"
              >
                Zurücksetzen
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(orderedItems)}
                disabled={isPending || orderedItems.length !== (question.options?.length ?? 0)}
                className="rounded-md bg-amber-700 px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                Antworten
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {question.options?.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelectedOption(option)}
              disabled={isPending || feedback !== null}
              className={`rounded-lg border-2 px-4 py-3 text-left text-lg font-medium disabled:opacity-60 ${
                selectedOption === option
                  ? 'border-amber-600 bg-amber-100 text-amber-950'
                  : 'border-stone-200 bg-white text-stone-800'
              }`}
            >
              {option}
            </button>
          ))}
          {feedback === null && (
            <button
              type="button"
              onClick={() => selectedOption && handleSubmit(selectedOption)}
              disabled={isPending || !selectedOption}
              className="mt-2 self-start rounded-md bg-amber-700 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              Antworten
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${
            feedback.isCorrect ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {feedback.rateLimited ? (
            <div className="flex flex-col gap-2">
              <p>Kurze Pause — das war schnell hintereinander! Versuch es gleich noch einmal.</p>
              <button
                type="button"
                onClick={handleRetry}
                className="self-start rounded-md border border-amber-400 bg-white px-3 py-1.5 font-medium text-amber-800"
              >
                Nochmal versuchen
              </button>
            </div>
          ) : feedback.isCorrect ? (
            <p>Super gemacht! Das war richtig.</p>
          ) : feedback.canRetry ? (
            <div className="flex flex-col gap-2">
              <p>Fast! {feedback.hintText ?? 'Schau dir die Geschichte noch einmal an.'}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="self-start rounded-md border border-amber-400 bg-white px-3 py-1.5 font-medium text-amber-800"
              >
                Nochmal versuchen
              </button>
            </div>
          ) : (
            <p>
              Kein Problem — beim nächsten Mal klappt es bestimmt.
              {formatCorrectAnswer(feedback.correctAnswer) && (
                <> Richtig wäre gewesen: {formatCorrectAnswer(feedback.correctAnswer)}</>
              )}
            </p>
          )}

          {(feedback.isCorrect || !feedback.canRetry) && (
            <button
              type="button"
              onClick={handleNext}
              className="mt-3 rounded-md bg-amber-700 px-4 py-2 font-medium text-white"
            >
              {index + 1 < questions.length ? 'Nächste Frage' : 'Fertig'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
