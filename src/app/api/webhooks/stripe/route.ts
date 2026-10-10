import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/server/stripe';
import { syncSubscriptionFromStripe, deleteLocalSubscription } from '@/lib/billing/subscriptionService';

// Stripe-Webhook-Empfänger. Bewusst ein eigener Route Handler statt einer
// Server Action — Server Actions sind ausschließlich für vom eigenen
// Next.js-Client aufgerufene, CSRF-geschützte Aktionen gedacht (Origin/Host-
// Abgleich, siehe docs/SECURITY.md); ein Webhook kommt dagegen von einem
// fremden Server (Stripe) und braucht stattdessen Signaturprüfung.
//
// Verarbeitet ausschließlich die drei Subscription-Lifecycle-Events, die für
// den lokalen Datenstand relevant sind — "checkout.session.completed" wird
// bewusst NICHT gesondert behandelt, weil "customer.subscription.created"
// (das bei jedem erfolgreichen Checkout im Modus "subscription" ebenfalls
// zugestellt wird) bereits das vollständige Subscription-Objekt enthält und
// somit ausreicht, ohne einen zusätzlichen Stripe-API-Aufruf zum Nachladen
// der Subscription-Details zu benötigen.
const RELEVANT_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(request: Request): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe-Webhook] STRIPE_WEBHOOK_SECRET ist nicht gesetzt.');
    return NextResponse.json({ error: 'Webhook nicht konfiguriert.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Fehlende Stripe-Signatur.' }, { status: 400 });
  }

  // WICHTIG: Der unveränderte Rohtext des Bodies wird für die
  // Signaturprüfung benötigt — ein vorheriges request.json() würde die
  // exakte Byte-Repräsentation verlieren und jede Signaturprüfung zum
  // Scheitern bringen. Next.js' Route Handler parsen den Body nicht
  // automatisch (anders als klassische Pages-API-Routen mit aktiviertem
  // bodyParser), request.text() liefert daher bereits den Rohtext.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[Stripe-Webhook] Signaturprüfung fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Ungültige Signatur.' }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    // Absichtlich mit 200 quittiert (nicht 404/400) — ein für uns
    // irrelevantes, aber gültig signiertes Event ist kein Fehler, und Stripe
    // wiederholt die Zustellung bei jeder Nicht-2xx-Antwort automatisch.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    const subscription = event.data.object as Stripe.Subscription;
    if (event.type === 'customer.subscription.deleted') {
      await deleteLocalSubscription(subscription.id);
    } else {
      await syncSubscriptionFromStripe(subscription);
    }
  } catch (error) {
    // Absichtlich 500 statt 200 bei einem echten Verarbeitungsfehler —
    // Stripe wiederholt die Zustellung dann automatisch (mit Backoff), statt
    // dass das Event stillschweigend verloren geht.
    console.error(`[Stripe-Webhook] Verarbeitung von ${event.type} fehlgeschlagen:`, error);
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
