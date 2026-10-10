'use client';

import { useTransition } from 'react';
import { createCheckoutSessionAction } from '@/features/billing/actions';
import type { PlanTier } from '@/generated/prisma/enums';

// Beschriftung bewusst mit dem Wort "kostenpflichtig" statt nur
// "Abonnieren" — der eigentliche, § 312j-BGB-relevante Bestellbutton liegt
// zwar auf Stripes gehosteter Checkout-Seite (siehe Kommentar in
// features/billing/actions.ts), dieser Button hier soll aber schon vor dem
// Wechsel dorthin unmissverständlich sein, statt die Zahlungspflicht erst
// auf der zweiten Seite offenzulegen.
export function CheckoutButton({ planTier, planName }: { planTier: PlanTier; planName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => createCheckoutSessionAction(planTier))}
      className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {isPending ? 'Wird geöffnet …' : `${planName} kostenpflichtig abonnieren`}
    </button>
  );
}
