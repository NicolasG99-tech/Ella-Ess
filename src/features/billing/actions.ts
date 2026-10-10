'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/server/authz';
import { getStripeClient } from '@/lib/server/stripe';
import { getStripePriceId } from '@/lib/billing/plans';
import { getOrCreateStripeCustomerId, getSubscription } from '@/lib/billing/subscriptionService';
import type { PlanTier } from '@/generated/prisma/enums';

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000';
}

/**
 * Startet einen Stripe-Checkout für den angegebenen Tarif und leitet direkt
 * zur von Stripe gehosteten Checkout-Seite weiter.
 *
 * Rechtlicher Hinweis (§ 312j BGB, „Buttonlösung"): Der eigentliche,
 * vertragsschließende Klick findet auf der von Stripe gehosteten
 * Checkout-Seite statt (Stripes eigener Bezahlen-Button zeigt Preis und
 * Zahlungspflicht bereits konform an). Der Button, der DIESE Funktion
 * aufruft, muss trotzdem eindeutig als "kostenpflichtig" erkennbar
 * beschriftet sein (siehe PricingPage.tsx) — Transparenz sollte nicht erst
 * auf der zweiten Seite beginnen, auch wenn der rechtlich bindende Klick
 * dort liegt.
 *
 * @param planTier - Gewählter Tarif (siehe lib/billing/plans.ts).
 * @sideeffect Legt bei Bedarf einen Stripe-Kunden an (getOrCreateStripeCustomerId).
 *   Leitet per redirect() zur Stripe-Checkout-URL weiter — kehrt bei Erfolg
 *   nicht zurück.
 */
export async function createCheckoutSessionAction(planTier: PlanTier): Promise<never> {
  const user = await requireUser();
  // getStripePriceId() ruft intern bereits getPlanDefinition() auf und wirft
  // bei einem unbekannten Tarif — kein zusätzlicher Aufruf hier nötig.
  const priceId = getStripePriceId(planTier);

  const existing = await getSubscription(user.id);
  if (existing) {
    // Bereits ein Abo vorhanden — Tarifwechsel läuft über das Kundenportal
    // (dort kann Stripe anteilige Verrechnung/Proration korrekt abbilden),
    // nicht über einen zweiten Checkout.
    redirect('/dashboard/abo');
  }

  const customerId = await getOrCreateStripeCustomerId(user.id, user.email);
  const stripe = getStripeClient();
  const baseUrl = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/abo?checkout=erfolgreich`,
    cancel_url: `${baseUrl}/preise?checkout=abgebrochen`,
    // Zeigt die Umsatzsteuer transparent auf der Stripe-Seite an, sofern in
    // Stripe Tax konfiguriert — siehe .env.example/Stripe-Dashboard-Hinweis.
    // Ohne Stripe-Tax-Konfiguration hat dieses Feld keine Wirkung.
    automatic_tax: { enabled: true },
    metadata: { userId: user.id, planTier },
  });

  if (!session.url) {
    throw new Error('Stripe hat keine Checkout-URL geliefert.');
  }

  redirect(session.url);
}

/**
 * Erstellt eine Stripe-Billing-Portal-Session und leitet dorthin weiter.
 * Erfüllt die Kündigungsbutton-Pflicht aus § 312k BGB: Das Stripe-
 * Kundenportal bietet eine dauerhaft erreichbare, ohne erneute
 * Zugangsdaten-Eingabe nutzbare Kündigungsfunktion — siehe
 * AboSection.tsx für den sichtbaren „Verträge hier kündigen"-Button, der
 * diese Funktion aufruft.
 *
 * @sideeffect Leitet per redirect() zur Stripe-Portal-URL weiter — kehrt bei
 *   Erfolg nicht zurück.
 */
export async function createBillingPortalSessionAction(): Promise<never> {
  const user = await requireUser();
  const subscription = await getSubscription(user.id);
  if (!subscription) {
    throw new Error('Kein Abo vorhanden — das Kundenportal setzt einen Stripe-Kunden mit Abo voraus.');
  }

  const customerId = await getOrCreateStripeCustomerId(user.id, user.email);
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppBaseUrl()}/dashboard/abo`,
  });

  redirect(session.url);
}
