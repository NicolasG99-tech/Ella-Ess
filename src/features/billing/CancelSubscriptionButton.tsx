'use client';

import { useTransition } from 'react';
import { createBillingPortalSessionAction } from '@/features/billing/actions';

// Wortlaut "Verträge hier kündigen" ist bewusst wörtlich aus § 312k BGB
// übernommen ("mit den Wörtern 'Verträge hier kündigen' oder einer
// entsprechend eindeutigen Formulierung zu beschriften") statt einer freien
// Umschreibung — vermeidet jede Diskussion, ob eine Umformulierung noch
// "entsprechend eindeutig" wäre. Öffnet das Stripe-Kundenportal, das dort
// auch das eigentliche Kündigen durchführt (kein zusätzlicher Login nötig,
// siehe createBillingPortalSessionAction).
export function CancelSubscriptionButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => createBillingPortalSessionAction())}
      className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 disabled:opacity-60"
    >
      {isPending ? 'Wird geöffnet …' : 'Verträge hier kündigen'}
    </button>
  );
}
