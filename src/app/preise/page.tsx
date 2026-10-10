import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/server/auth';
import { PLAN_CATALOG } from '@/lib/billing/plans';
import { CheckoutButton } from '@/features/billing/CheckoutButton';

export const metadata: Metadata = { title: 'Tarife — Lese-Abenteuer' };

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Tarife</h1>
        <p className="mt-2 text-stone-600">
          Alle Tarife enthalten sämtliche Geschichten, Übungen und Belohnungen. Der Unterschied liegt in
          der Anzahl der Kinderprofile und ein paar Zusatzfunktionen für Fachkräfte/Lehrkräfte.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLAN_CATALOG.map((plan) => (
          <div
            key={plan.tier}
            className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6"
          >
            <div>
              <h2 className="text-xl font-bold text-stone-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-stone-600">{plan.description}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm text-stone-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {isLoggedIn ? (
              <CheckoutButton planTier={plan.tier} planName={plan.name} />
            ) : (
              // Nicht angemeldet: erst zum Login/zur Registrierung, dann von
              // dort zurück hierher — createCheckoutSessionAction() setzt
              // eine bestehende Anmeldung voraus (requireUser()).
              <Link
                href={`/login?callbackUrl=${encodeURIComponent('/preise')}`}
                className="rounded-md bg-amber-700 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Anmelden, um {plan.name} zu abonnieren
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-stone-500">
        Die Bezahlung läuft über unseren Zahlungsdienstleister Stripe. Der Vertrag kommt erst mit dem
        Klick auf den zahlungspflichtigen Button auf der Stripe-Bezahlseite zustande. Du kannst dein Abo
        jederzeit über &bdquo;Mein Abo&rdquo; im Elternbereich kündigen.
      </p>
    </div>
  );
}
