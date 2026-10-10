import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserForPage } from '@/lib/server/authz';
import { getSubscription } from '@/lib/billing/subscriptionService';
import { getPlanDefinition } from '@/lib/billing/plans';
import { CancelSubscriptionButton } from '@/features/billing/CancelSubscriptionButton';

export const metadata: Metadata = { title: 'Mein Abo — Lese-Abenteuer' };

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Testphase',
  active: 'Aktiv',
  past_due: 'Zahlung überfällig',
  canceled: 'Gekündigt',
  incomplete: 'Unvollständig',
  incomplete_expired: 'Abgelaufen',
  unpaid: 'Unbezahlt',
  paused: 'Pausiert',
};

export default async function SubscriptionPage() {
  const user = await requireUserForPage('/dashboard/abo');
  const subscription = await getSubscription(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Mein Abo</h1>
      </div>

      {!subscription ? (
        <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-600">Du hast aktuell kein aktives Abo.</p>
          <Link
            href="/preise"
            className="self-start rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white"
          >
            Tarife ansehen
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-6">
          <div>
            <p className="text-sm text-stone-600">Aktueller Tarif</p>
            <p className="text-lg font-semibold text-stone-900">
              {getPlanDefinition(subscription.planTier).name}
            </p>
          </div>
          <div>
            <p className="text-sm text-stone-600">Status</p>
            <p className="text-stone-900">{STATUS_LABELS[subscription.status] ?? subscription.status}</p>
          </div>
          <div>
            <p className="text-sm text-stone-600">
              {subscription.cancelAtPeriodEnd ? 'Zugang endet am' : 'Nächste Verlängerung am'}
            </p>
            <p className="text-stone-900">
              {subscription.currentPeriodEnd.toLocaleDateString('de-DE', { dateStyle: 'long' })}
            </p>
          </div>
          {subscription.cancelAtPeriodEnd && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Dein Abo wurde bereits gekündigt und läuft zum oben genannten Datum aus. Du kannst die
              Kündigung im Kundenportal auch wieder rückgängig machen.
            </p>
          )}

          {/* Kündigungsbutton (§ 312k BGB): dauerhaft sichtbar, ohne erneute
              Zugangsdaten-Eingabe erreichbar — leitet zum Stripe-
              Kundenportal weiter, das die eigentliche Kündigungsfunktion
              bereitstellt (createBillingPortalSessionAction). */}
          <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
            <CancelSubscriptionButton />
          </div>
        </section>
      )}

      <Link href="/dashboard" className="text-sm text-amber-800 underline">
        Zurück zur Übersicht
      </Link>
    </div>
  );
}
