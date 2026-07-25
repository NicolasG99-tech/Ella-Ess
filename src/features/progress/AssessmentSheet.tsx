import type { ChildAssessment } from '@/lib/progress/assessmentService';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Strukturierter Assessment-Bogen für Fachkräfte und Lehrkräfte — gemeinsam
// genutzt von /fachkraft/[grantId] und /lehrer/[grantId], damit beide
// Berufsgruppen dieselbe, generisch aus den Übungsdaten abgeleitete
// Auswertung sehen (siehe assessmentService.ts). Bewusst druckfreundlich
// (klare Abschnitte, Tabellen) für die Einbindung in eigene Unterlagen —
// ohne Anspruch auf ein konkretes externes Diagnostikverfahren.
export function AssessmentSheet({ assessment }: { assessment: ChildAssessment }) {
  return (
    <div className="flex flex-col gap-8 print:gap-6">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-600">Erste Aktivität</p>
          <p className="font-medium text-stone-900">
            {assessment.firstActivityAt ? DATE_FORMAT.format(assessment.firstActivityAt) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-600">Letzte Aktivität</p>
          <p className="font-medium text-stone-900">
            {assessment.lastActivityAt ? DATE_FORMAT.format(assessment.lastActivityAt) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-600">Geschichten abgeschlossen</p>
          <p className="font-medium text-stone-900">{assessment.completedSessionCount}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-600">Tage geübt</p>
          <p className="font-medium text-stone-900">{assessment.distinctPracticeDays}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">Fähigkeitsbereiche</h2>
        <p className="text-sm text-stone-600">
          Nach Übungsbedarf sortiert (geringster Beherrschungsgrad zuerst).
        </p>
        {assessment.skills.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Übungsdaten vorhanden.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Bereich</th>
                  <th className="px-3 py-2">Einschätzung</th>
                  <th className="px-3 py-2">Zuletzt geübt</th>
                </tr>
              </thead>
              <tbody>
                {assessment.skills.map((skill) => (
                  <tr key={skill.skillName} className="border-t border-stone-200">
                    <td className="px-3 py-2 font-medium text-stone-900">{skill.skillName}</td>
                    <td className="px-3 py-2">{skill.label}</td>
                    <td className="px-3 py-2">{DATE_FORMAT.format(skill.lastPracticedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">Lesegenauigkeit — Wortebene</h2>
        {assessment.wordErrorBreakdown.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Lesesitzung mit auswertbaren Wörtern.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Einordnung</th>
                  <th className="px-3 py-2">Anzahl Wörter</th>
                </tr>
              </thead>
              <tbody>
                {assessment.wordErrorBreakdown.map((entry) => (
                  <tr key={entry.state} className="border-t border-stone-200">
                    <td className="px-3 py-2">{entry.label}</td>
                    <td className="px-3 py-2 font-medium text-stone-900">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">Rechtschreibung nach Aufgabentyp</h2>
        {assessment.exerciseAccuracyByType.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Rechtschreibübung abgeschlossen.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Aufgabentyp</th>
                  <th className="px-3 py-2">Abgeschlossen</th>
                  <th className="px-3 py-2">Richtig beim ersten Versuch</th>
                </tr>
              </thead>
              <tbody>
                {assessment.exerciseAccuracyByType.map((entry) => (
                  <tr key={entry.exerciseType} className="border-t border-stone-200">
                    <td className="px-3 py-2 font-medium text-stone-900">{entry.label}</td>
                    <td className="px-3 py-2">{entry.completedCount}</td>
                    <td className="px-3 py-2">{entry.correctFirstTryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-stone-900">Leseverständnis nach Fragetyp</h2>
        {assessment.comprehensionAccuracyByType.length === 0 ? (
          <p className="text-sm text-stone-600">Noch keine Verständnisfrage beantwortet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2">Fragetyp</th>
                  <th className="px-3 py-2">Richtig (1. Versuch)</th>
                </tr>
              </thead>
              <tbody>
                {assessment.comprehensionAccuracyByType.map((entry) => (
                  <tr key={entry.questionType} className="border-t border-stone-200">
                    <td className="px-3 py-2 font-medium text-stone-900">{entry.label}</td>
                    <td className="px-3 py-2">
                      {entry.correct} von {entry.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="rounded-md border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-700">
        Diese Auswertung ist automatisiert aus den Übungsdaten der App abgeleitet — keine Diagnose
        und kein Ersatz für eine reguläre fachliche Untersuchung. Automatische Spracherkennung kann
        ungenau sein.
      </p>
    </div>
  );
}
