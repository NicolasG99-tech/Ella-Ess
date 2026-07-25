import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Nutzungsbedingungen — Lese-Abenteuer' };

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold text-stone-900">Nutzungsbedingungen (Entwurf)</h1>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Dies ist ein Platzhaltertext für den MVP, kein rechtlich geprüfter Text. Vor einem echten
        Einsatz muss diese Seite von einem Juristen / einer Juristin erstellt werden.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Kein diagnostisches Angebot</h2>
      <p className="text-stone-700">
        Lese-Abenteuer ist ein Bildungsprodukt. Es diagnostiziert keine Lese-Rechtschreib-Störung
        oder Legasthenie, trifft keine medizinischen Aussagen und ersetzt keine Logopädie oder
        Lerntherapie. Details siehe <code>docs/EDUCATIONAL_MODEL.md</code>.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Elternverantwortung</h2>
      <p className="text-stone-700">
        Elternkonten werden ausschließlich von Erwachsenen angelegt und verwaltet. Kinder nutzen die
        App über ein von den Eltern verwaltetes Kinderprofil, ohne eigenes Konto.
      </p>
    </div>
  );
}
