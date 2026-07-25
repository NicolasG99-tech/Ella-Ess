import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-amber-50 px-6 py-16 text-center">
      <main className="flex max-w-xl flex-col items-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight text-amber-900">Lese-Abenteuer</h1>
        <p className="text-lg leading-8 text-amber-800">
          Eine gamifizierte Lese-Lernapp für Kinder von 7 bis 10 Jahren. Eltern erstellen ein Konto
          und Kinderprofile; das Vorlesen selbst folgt in einem späteren Meilenstein.
        </p>
        <div className="flex gap-4">
          <Link
            href="/register"
            className="rounded-md bg-amber-800 px-5 py-2.5 font-medium text-white"
          >
            Konto erstellen
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-amber-800 px-5 py-2.5 font-medium text-amber-900"
          >
            Anmelden
          </Link>
        </div>
      </main>
    </div>
  );
}
