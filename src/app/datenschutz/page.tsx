import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Datenschutz — Lese-Abenteuer' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold text-stone-900">Datenschutzerklärung (Entwurf)</h1>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Dies ist eine verständliche Demo-Erklärung für den MVP, kein rechtlich geprüfter Text. Vor
        einem echten Einsatz muss diese Seite von einem Juristen / einer Juristin geprüft und an die
        tatsächliche Datenverarbeitung angepasst werden (siehe <code>docs/SECURITY.md</code>).
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Was wir speichern</h2>
      <p className="text-stone-700">
        Von Eltern: E-Mail-Adresse, Passwort (als Hash, nie im Klartext), optional ein Name. Von
        Kindern: ein Spitzname, ein Geburtsjahr, Avatar-Auswahl und Lernfortschritt — keine eigene
        E-Mail-Adresse, kein echter Name erforderlich.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Audio</h2>
      <p className="text-stone-700">
        Beim lauten Vorlesen wird Audio nur so lange verarbeitet, wie für die Auswertung nötig, und
        danach nicht dauerhaft gespeichert.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Deine Rechte</h2>
      <p className="text-stone-700">
        Du kannst als Elternteil jederzeit ein Kinderprofil löschen oder dein Konto vollständig
        löschen lassen (Funktion folgt in einem späteren Meilenstein).
      </p>
    </div>
  );
}
