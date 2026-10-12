import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Impressum — Lese-Abenteuer' };

// Anbieterangaben aus dem Impressum von nicolazz.com (Stand 2026-10-12), Name
// auf den bürgerlichen Namen korrigiert (§ 5 DDG verlangt ihn, kein
// Künstlername). Übergangslösung: Die App soll später über eine GmbH laufen —
// dann hier Firma, Vertretungsberechtigte, Registereintrag und USt-ID ergänzen.
// Keine USt-ID-Angabe, solange Kleinunternehmer (§ 19 UStG) ohne USt-ID.
// E-Mail ist ebenfalls eine Übergangslösung: Entscheidung 2026-10-12, die App
// bekommt eine eigene Domain + Kontaktadresse — sobald vorhanden, hier ersetzen
// (und EMAIL_FROM_ADDRESS in .env passend setzen).
const PROVIDER = {
  name: 'Nicolas Graf',
  street: 'Reineckerstraße 40',
  city: '09126 Chemnitz',
  country: 'Deutschland',
  email: 'musik@nicolazz.com',
  phone: '0174 3870799',
} as const;

export default function ImprintPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold text-stone-900">Impressum (Entwurf)</h1>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Mockup für den MVP, kein rechtlich geprüfter Text. Die App soll später über eine GmbH
        betrieben werden — dann sind Firma, Geschäftsführung, Handelsregister und USt-ID zu
        ergänzen. Vorher juristische Durchsicht (siehe <code>docs/SECURITY.md</code>).
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Angaben gemäß § 5 DDG</h2>
      <address className="not-italic text-stone-700">
        {PROVIDER.name}
        <br />
        {PROVIDER.street}
        <br />
        {PROVIDER.city}
        <br />
        {PROVIDER.country}
      </address>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">Kontakt</h2>
      <p className="text-stone-700">
        E-Mail:{' '}
        <a href={`mailto:${PROVIDER.email}`} className="underline">
          {PROVIDER.email}
        </a>
        <br />
        Telefon: {PROVIDER.phone}
      </p>
      <p className="text-stone-700">
        Schulen und Einrichtungen: Angebote für den Tarif „Schule“ gibt es auf Anfrage über die
        oben genannte E-Mail-Adresse.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">
        Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
      </h2>
      <address className="not-italic text-stone-700">
        {PROVIDER.name}, {PROVIDER.street}, {PROVIDER.city}
      </address>

      {/* Bewusst KEIN Link zur EU-Online-Streitbeilegungsplattform (anders als
          auf nicolazz.com): Die OS-Plattform wurde zum 20.07.2025 eingestellt,
          die Hinweispflicht ist entfallen. Die Erklärung nach § 36 VSBG bleibt
          für Online-Verträge mit Verbrauchern (Abo) dagegen relevant. */}
      <h2 className="mt-4 text-lg font-semibold text-stone-900">Verbraucherstreitbeilegung</h2>
      <p className="text-stone-700">
        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </div>
  );
}
