import Stripe from 'stripe';

// Zentraler Stripe-Client-Singleton, analog zum globalThis-Cache-Muster in
// src/lib/server/db.ts (verhindert, dass Next.js' Dev-Reload bei jeder
// Codeänderung einen neuen Client instanziiert).
//
// API-Version bewusst FEST gepinnt (nicht "aktuellste automatisch"): Stripe
// kann Breaking Changes zwischen API-Versionen einführen (z.B. veränderte
// Feldnamen in Webhook-Payloads) — ein fest gepinnter Wert sorgt dafür, dass
// ein Stripe-seitiges Update nicht unbemerkt den Webhook-Handler bricht.
// Beim gezielten Hochziehen auf eine neuere Version: Stripes Migrationsguide
// prüfen, nicht einfach den String ändern (siehe z.B. den Wegfall von
// Subscription.current_period_end zugunsten von
// SubscriptionItem.current_period_end in der "Basil"-Version vom 2025-03-31 —
// genau dieses Feld liest src/lib/billing/subscriptionService.ts).
// Stand Juli 2026 aktuelle stabile Version, siehe Stripe-Changelog.
const STRIPE_API_VERSION = '2026-06-24.dahlia' as Stripe.LatestApiVersion;

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // Bewusst erst beim tatsächlichen Zugriff werfen (nicht beim Modul-Import) —
    // sonst würde ein Server-Start ohne konfigurierten Stripe-Key an jeder
    // Stelle fehlschlagen, die dieses Modul transitiv importiert, auch wenn
    // die aufrufende Funktion (noch) gar nicht erreicht wird. Lokale
    // Entwicklung ohne Zahlungsfunktion bleibt so unverändert möglich.
    throw new Error(
      'STRIPE_SECRET_KEY ist nicht gesetzt. Siehe .env.example — ohne diesen Schlüssel ' +
        'funktionieren Checkout, Kundenportal und Webhook-Verarbeitung nicht.',
    );
  }
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

export function getStripeClient(): Stripe {
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = createStripeClient();
  }
  return globalForStripe.stripe;
}
