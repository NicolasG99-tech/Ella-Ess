import type Stripe from 'stripe';
import { db } from '@/lib/server/db';
import { getStripeClient } from '@/lib/server/stripe';
import { getPlanTierByPriceId } from '@/lib/billing/plans';
import { logAuditEvent } from '@/lib/server/audit';
import { sendPaymentMethodChangedEmail } from '@/lib/server/email';
import type { SubscriptionStatus } from '@/generated/prisma/enums';

/**
 * Liefert die Stripe-Kunden-ID eines Users, legt bei Bedarf einen neuen
 * Stripe-Kunden an. Wiederverwendbar über mehrere Checkout-Versuche hinweg
 * (siehe Kommentar an User.stripeCustomerId in prisma/schema.prisma) — ohne
 * dieses Zwischenspeichern würde jeder abgebrochene Checkout einen weiteren,
 * verwaisten Kunden in Stripe anlegen.
 *
 * @param userId - ID des bereits authentifizierten Users (parent).
 * @param email - Aktuelle E-Mail-Adresse, wird bei Neuanlage an Stripe übergeben.
 * @sideeffect Legt ggf. einen Stripe-Kunden an und schreibt dessen ID in User.stripeCustomerId.
 */
export async function getOrCreateStripeCustomerId(userId: string, email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/**
 * Liest die aktuelle Subscription eines Users (falls vorhanden).
 */
export function getSubscription(userId: string) {
  return db.subscription.findUnique({ where: { userId } });
}

/**
 * Prüft, ob ein User Zugriff auf kostenpflichtige Inhalte haben sollte.
 * Bewusst als eigene, benannte Funktion statt eines Inline-Status-Vergleichs
 * an jeder Aufrufstelle — falls sich die Definition von "aktiv" später
 * ändert (z. B. `past_due` für eine Kulanzfrist noch als aktiv zu werten),
 * gibt es dafür genau eine Stelle zum Anpassen.
 *
 * "trialing" ist hier absichtlich mit aufgeführt, obwohl aktuell kein
 * Tarif mit Testphase konfiguriert ist (siehe plans.ts) — falls später doch
 * eine Testphase eingeführt wird, muss dieser Helfer nicht mehr angefasst werden.
 */
const ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getSubscription(userId);
  return subscription !== null && ACTIVE_STATUSES.includes(subscription.status);
}

/**
 * Synchronisiert den lokalen Subscription-Datensatz aus einem Stripe-
 * Subscription-Objekt — die einzige Stelle, die `db.subscription` schreibt,
 * damit lokaler Stand und Stripe nie über zwei unabhängige Code-Pfade
 * auseinanderlaufen können. Wird ausschließlich vom Webhook-Handler
 * aufgerufen (`src/app/api/webhooks/stripe/route.ts`), NIE direkt aus einer
 * Server Action heraus — der einzige verlässliche Zeitpunkt, zu dem der
 * tatsächliche Stripe-Status feststeht, ist ein von Stripe zugestelltes
 * Event, nicht die Rückkehr von einer Checkout-Weiterleitung (die kann vom
 * Nutzer abgebrochen oder das Event verzögert zugestellt werden).
 *
 * @param stripeSubscription - Vollständiges Subscription-Objekt aus dem
 *   Stripe-Event-Payload.
 * @sideeffect Legt einen Subscription-Datensatz an/aktualisiert ihn,
 *   schreibt einen Audit-Log-Eintrag und löst bei einem Tarifwechsel eine
 *   Benachrichtigungs-Mail aus.
 */
export async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  const user = await db.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) {
    // Sollte nicht vorkommen (jede Subscription wurde über
    // getOrCreateStripeCustomerId() für einen bekannten User angelegt) —
    // bewusst nur geloggt statt geworfen, damit ein einzelnes unerwartetes
    // Event nicht die gesamte Webhook-Zustellung (inkl. anderer, unabhängiger
    // Events in derselben Anfrage) zum Scheitern bringt.
    console.error(`[Stripe-Webhook] Kein User zu Stripe-Kunde ${customerId} gefunden.`);
    return;
  }

  const priceId = stripeSubscription.items.data[0]?.price.id;
  const planTier = priceId ? getPlanTierByPriceId(priceId) : null;
  if (!priceId || !planTier) {
    console.error(
      `[Stripe-Webhook] Unbekannte Price-ID "${priceId}" bei Subscription ${stripeSubscription.id} ` +
        '— stimmt der Preis mit STRIPE_PRICE_BASIC/FAMILY/SCHOOL überein?',
    );
    return;
  }

  const currentPeriodEndSeconds = stripeSubscription.items.data[0]?.current_period_end;
  const currentPeriodEnd = currentPeriodEndSeconds
    ? new Date(currentPeriodEndSeconds * 1000)
    : new Date();

  const status = mapStripeSubscriptionStatus(stripeSubscription.status, stripeSubscription.id);
  const previous = await db.subscription.findUnique({ where: { userId: user.id } });

  await db.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planTier,
      status,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    update: {
      planTier,
      status,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'subscription.sync',
    targetType: 'Subscription',
    targetId: stripeSubscription.id,
    // Roher Stripe-Status zusätzlich, damit ein auf `incomplete` gemappter
    // unbekannter Status im Audit-Log nachvollziehbar bleibt; gekürzt als
    // Defense in Depth gegen unerwartet lange Werte.
    metadata: { planTier, status, stripeStatus: String(stripeSubscription.status).slice(0, 64) },
  });

  const isNewTier = !previous || previous.planTier !== planTier;
  const isNewStatus = !previous || previous.status !== status;
  if (isNewTier || isNewStatus) {
    await sendPaymentMethodChangedEmail(
      user.email,
      describeSubscriptionChange(planTier, status, stripeSubscription.cancel_at_period_end),
    );
  }
}

// Lookup-Tabelle statt `switch`: Stripes `Status` enthält `string & {}`,
// wodurch TypeScript im switch nicht auf die Literal-Typen verengt.
// Objekt ohne Prototyp, damit ein unerwarteter Status wie "constructor"
// nicht versehentlich eine geerbte Object-Eigenschaft trifft.
const STRIPE_STATUS_MAP: Readonly<Record<string, SubscriptionStatus | undefined>> = Object.assign(
  Object.create(null) as Record<string, SubscriptionStatus>,
  {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'unpaid',
    paused: 'paused',
  } satisfies Record<SubscriptionStatus, SubscriptionStatus>,
);

/**
 * Bildet den Stripe-Subscription-Status explizit auf das Prisma-Enum
 * `SubscriptionStatus` ab.
 *
 * Warum nicht einfach durchreichen: Stripe typisiert `Subscription.Status`
 * bewusst offen (bekannte Werte + beliebiger String), weil Stripe jederzeit
 * neue Status einführen kann. Das Prisma-Enum ist dagegen geschlossen — ein
 * unbekannter Wert würde erst beim DB-Schreiben mit einem Laufzeitfehler
 * scheitern (Webhook → 500 → endlose Stripe-Wiederholungen, lokaler Stand
 * veraltet). Darum wird hier jeder bekannte Wert einzeln zugeordnet und ein
 * unbekannter Wert bewusst auf `incomplete` gesetzt: „fail closed“ — er
 * zählt nicht zu ACTIVE_STATUSES, gewährt also keinen kostenpflichtigen
 * Zugang, bis jemand den neuen Status geprüft und hier ergänzt hat. Das
 * `console.error` macht den Fall im Log sichtbar. (`paused` ist bereits
 * Teil des Enums und wird regulär übernommen — ebenfalls ohne Zugang.)
 *
 * @param stripeStatus - `status` aus dem Stripe-Subscription-Objekt.
 * @param stripeSubscriptionId - Nur für die Log-Meldung bei unbekanntem Status.
 * @returns Der passende Enum-Wert, bei unbekanntem Status `incomplete`.
 * @sideeffect Schreibt bei unbekanntem Status eine Fehlermeldung ins Log.
 */
export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
  stripeSubscriptionId: string,
): SubscriptionStatus {
  const mapped = STRIPE_STATUS_MAP[stripeStatus];
  if (mapped) return mapped;
  console.error(
    // JSON.stringify + Kürzung: verhindert Zeilenumbrüche/Steuerzeichen
    // (Log-Injection) und überlange Werte im Log.
    `[Stripe-Webhook] Unbekannter Subscription-Status ${JSON.stringify(String(stripeStatus).slice(0, 64))} bei ${stripeSubscriptionId} ` +
      '— wird als "incomplete" (kein Zugang) gespeichert; Mapping in subscriptionService.ts ergänzen.',
  );
  return 'incomplete';
}

function describeSubscriptionChange(
  planTier: string,
  status: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
): string {
  const planName = planTier.charAt(0).toUpperCase() + planTier.slice(1);
  if (status === 'canceled') {
    return `Dein Abo (Tarif "${planName}") wurde beendet.`;
  }
  if (cancelAtPeriodEnd) {
    return `Dein Abo (Tarif "${planName}") wurde zum Ende der aktuellen Laufzeit gekündigt.`;
  }
  if (status === 'past_due' || status === 'unpaid') {
    return `Für dein Abo (Tarif "${planName}") konnte die letzte Zahlung nicht abgebucht werden. Bitte prüfe deine Zahlungsmethode.`;
  }
  // Ohne diesen Zweig fiele z. B. `paused` oder ein unbekannter (→ incomplete)
  // Status in die „aktiver Tarif“-Meldung und würde Eltern fälschlich einen
  // laufenden Zugang bestätigen.
  if (!ACTIVE_STATUSES.includes(status)) {
    return `Der Status deines Abos (Tarif "${planName}") hat sich geändert; der Zugang ist derzeit nicht aktiv. Details findest du unter „Mein Abo“.`;
  }
  return `Dein Abo wurde aktualisiert: aktiver Tarif ist jetzt "${planName}".`;
}

/**
 * Entfernt die lokale Subscription-Zeile, wenn Stripe eine Subscription
 * endgültig löscht (nicht zu verwechseln mit "gekündigt zum Periodenende" —
 * das bleibt bis zum tatsächlichen Ende `status: canceled`, siehe oben).
 * Wird ausschließlich vom Webhook-Handler bei
 * `customer.subscription.deleted` aufgerufen.
 *
 * @param stripeSubscriptionId - Stripe-ID der gelöschten Subscription.
 * @sideeffect Löscht 0 oder 1 Subscription-Zeile; idempotent (deleteMany
 *   statt delete), damit eine wiederholte Stripe-Zustellung nicht mit
 *   „Record not found“ scheitert.
 */
export async function deleteLocalSubscription(stripeSubscriptionId: string): Promise<void> {
  await db.subscription.deleteMany({ where: { stripeSubscriptionId } });
}
