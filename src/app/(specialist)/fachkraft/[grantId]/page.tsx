import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthzError, requireOwnActiveGrant } from '@/lib/server/authz';
import { getChildAssessment } from '@/lib/progress/assessmentService';
import {
  listFeedbackForGrant,
  listFeedbackRequestsForGrant,
} from '@/lib/specialist/specialistService';
import { AssessmentSheet } from '@/features/progress/AssessmentSheet';
import { SpecialistFeedbackForm } from '@/features/specialist/SpecialistFeedbackForm';
import { updateFeedbackRequestStatusAction } from '@/features/specialist/actions';

export const metadata: Metadata = { title: 'Kinderprofil — Fachkräfte-Bereich' };

interface SpecialistGrantPageProps {
  params: Promise<{ grantId: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default async function SpecialistGrantPage({ params }: SpecialistGrantPageProps) {
  const { grantId } = await params;

  let grant;
  try {
    ({ grant } = await requireOwnActiveGrant(grantId));
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const [assessment, requests, feedbackHistory] = await Promise.all([
    getChildAssessment(grant.childProfileId),
    listFeedbackRequestsForGrant(grantId),
    listFeedbackForGrant(grantId),
  ]);

  const openRequests = requests.filter((request) => request.status === 'open');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Assessment-Bogen: {grant.childProfile.displayName}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Rein lesende Ansicht auf Basis der in der App sichtbaren Übungsdaten — keine
          Rohaudiodaten, keine Diagnose.
        </p>
      </div>

      <AssessmentSheet assessment={assessment} />

      {openRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-stone-900">Offene Anfragen der Eltern</h2>
          <ul className="flex flex-col gap-2">
            {openRequests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3"
              >
                <div>
                  {request.message && <p className="text-sm text-stone-800">{request.message}</p>}
                  <p className="text-xs text-stone-500">{DATE_FORMAT.format(request.createdAt)}</p>
                </div>
                <form
                  action={updateFeedbackRequestStatusAction.bind(
                    null,
                    grantId,
                    request.id,
                    'closed',
                  )}
                >
                  <button type="submit" className="text-sm font-medium underline">
                    Als erledigt markieren
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4 border-t border-stone-200 pt-8">
        <h2 className="text-lg font-semibold text-stone-900">Rückmeldung an die Eltern</h2>
        <SpecialistFeedbackForm childAccessGrantId={grantId} />
      </section>

      {feedbackHistory.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-stone-900">Bisherige Rückmeldungen</h2>
          <ul className="flex flex-col gap-2">
            {feedbackHistory.map((entry) => (
              <li key={entry.id} className="rounded-md border border-stone-200 bg-white p-3">
                <p className="text-sm text-stone-800">{entry.note}</p>
                <p className="mt-1 text-xs text-stone-500">{DATE_FORMAT.format(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/fachkraft" className="text-sm text-amber-800 underline">
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
