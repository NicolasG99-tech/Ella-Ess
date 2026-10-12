import type { PlanTier } from '@/generated/prisma/enums';
import { MAX_CHILD_PROFILES_PER_PARENT } from '@/lib/validation/child-profile';

// Tarif-Katalog — Ergebnis der Produktentscheidung "Jetzt Zahlungsmodell"
// (2026-07-28): Stripe als Zahlungsanbieter, gestaffelte Tarife statt eines
// einzelnen Preises oder Preis-pro-Kind, vorerst ohne kostenlose Testphase.
//
// WICHTIG zu "school": Es gibt aktuell noch KEIN eigenes Schul-/
// Organisationsdatenmodell (Kinderprofile hängen strukturell weiterhin an
// genau einem Elternkonto, siehe prisma/schema.prisma, ChildProfile.parentId)
// — derselbe, bereits an anderer Stelle dokumentierte Gap wie beim
// Sitzungs-Timeout (siehe docs/SECURITY.md, "Sitzungs-Timeout,
// Schulkonfiguration"). Der "school"-Tarif ist daher bewusst als
// VORBEREITUNG zu verstehen: derselbe Kinderprofil-Deckel wie "family", aber
// bereits als eigener Stripe-Preis/eigene Rechnungsadresse buchbar, sodass
// Schulen schon jetzt zahlen können, ohne auf das vollständige
// Organisationskonzept warten zu müssen. Sobald dieses Konzept existiert,
// wird maxChildProfiles hier realistisch nach oben angepasst.
export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  /** Name der Env-Variable, die die Stripe-Price-ID für diesen Tarif enthält. */
  priceEnvVar: 'STRIPE_PRICE_BASIC' | 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_SCHOOL';
  maxChildProfiles: number;
  /**
   * Monatlicher Anzeigepreis in Cent, inkl. MwSt. — `null` bedeutet „Preis auf
   * Anfrage“ (kein Self-Service-Checkout).
   *
   * Nur zur ANZEIGE auf /preise: Abgerechnet wird ausschließlich der in Stripe
   * hinterlegte Preis (Price-ID aus `priceEnvVar`). Beide Werte müssen daher
   * von Hand identisch gehalten werden — siehe .env.example, Abschnitt
   * „Zahlungssystem“, Schritt 1. Bewusst kein Live-Abruf des Preises bei
   * Stripe: Die Preisseite soll ohne Stripe-Konfiguration renderbar bleiben
   * (lokale Entwicklung, Demo-Zugang).
   */
  monthlyPriceCents: number | null;
  features: string[];
}

export const PLAN_CATALOG: PlanDefinition[] = [
  {
    tier: 'basic',
    name: 'Basic',
    description: 'Für den Einstieg mit einem Kind.',
    priceEnvVar: 'STRIPE_PRICE_BASIC',
    maxChildProfiles: 1,
    // Preisentscheidung Nicolas, 2026-10-12: Einstieg ~15 €/Monat inkl. MwSt.
    monthlyPriceCents: 1500,
    features: [
      'Ein Kinderprofil',
      'Alle Geschichten, Übungen und Belohnungen',
      'Fortschrittsübersicht für Eltern',
    ],
  },
  {
    tier: 'family',
    name: 'Familie',
    description: 'Für Familien mit mehreren Kindern.',
    priceEnvVar: 'STRIPE_PRICE_FAMILY',
    maxChildProfiles: MAX_CHILD_PROFILES_PER_PARENT,
    // Preisentscheidung Nicolas, 2026-10-12.
    monthlyPriceCents: 2200,
    features: [
      `Bis zu ${MAX_CHILD_PROFILES_PER_PARENT} Kinderprofile`,
      'Alle Geschichten, Übungen und Belohnungen',
      'Fortschrittsübersicht für Eltern',
      'Freigabe für Fachkräfte (Logopädie/Ergotherapie)',
    ],
  },
  {
    tier: 'school',
    name: 'Schule',
    description:
      'Für Lehrkräfte und Schulen. Hinweis: nutzt aktuell noch dasselbe Kinderprofil-Limit wie „Familie" — ' +
      'ein vollständiges Klassen-/Organisationskonzept ist in Planung.',
    priceEnvVar: 'STRIPE_PRICE_SCHOOL',
    maxChildProfiles: MAX_CHILD_PROFILES_PER_PARENT,
    // Preisentscheidung Nicolas, 2026-10-12: Schulen individuell auf Anfrage,
    // solange es kein Klassen-/Organisationskonzept gibt (siehe oben).
    monthlyPriceCents: null,
    features: [
      `Bis zu ${MAX_CHILD_PROFILES_PER_PARENT} Kinderprofile (Klassenweite Verwaltung in Planung)`,
      'Alle Geschichten, Übungen und Belohnungen',
      'Freigabe für Lehrkräfte',
      'Längeres Sitzungs-Zeitfenster für den Schuleinsatz (in Planung, siehe docs/SECURITY.md)',
    ],
  },
];

export function getPlanDefinition(tier: PlanTier): PlanDefinition {
  const plan = PLAN_CATALOG.find((p) => p.tier === tier);
  if (!plan) {
    // Kann nur bei einem inkonsistenten Deployment auftreten (Enum in
    // schema.prisma erweitert, Katalog hier vergessen) — bewusst ein harter
    // Fehler statt eines stillen Fallbacks, damit so ein Fehler sofort auffällt.
    throw new Error(`Kein Tarif-Katalogeintrag für PlanTier "${tier}" gefunden.`);
  }
  return plan;
}

/** Ob ein Tarif direkt über /preise per Stripe-Checkout buchbar ist (sonst „auf Anfrage“). */
export function isSelfServicePlan(plan: PlanDefinition): boolean {
  return plan.monthlyPriceCents !== null;
}

/**
 * Formatiert den monatlichen Anzeigepreis eines Tarifs für die Preisseite.
 * @param plan - Tarif aus `PLAN_CATALOG`.
 * @returns z. B. „15,00 €“, oder „Preis auf Anfrage“ bei Tarifen ohne Listenpreis.
 */
export function formatMonthlyPrice(plan: PlanDefinition): string {
  if (plan.monthlyPriceCents === null) return 'Preis auf Anfrage';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    plan.monthlyPriceCents / 100,
  );
}

/**
 * Liest die Stripe-Price-ID eines Tarifs aus der Umgebung.
 * @throws wenn die zugehörige Env-Variable nicht gesetzt ist — ein Tarif
 *   ohne konfigurierte Price-ID darf nie stillschweigend einen falschen Preis
 *   berechnen.
 * @throws wenn der Tarif „auf Anfrage“ ist — sonst könnte ein manipulierter
 *   Aufruf von createCheckoutSessionAction() einen Tarif buchen, für den die
 *   Preisseite gar keinen Preis genannt hat (Preistransparenz vor Vertragsschluss).
 */
export function getStripePriceId(tier: PlanTier): string {
  const plan = getPlanDefinition(tier);
  if (!isSelfServicePlan(plan)) {
    throw new Error(`Tarif "${tier}" ist nur auf Anfrage buchbar, nicht per Self-Service-Checkout.`);
  }
  const priceId = process.env[plan.priceEnvVar];
  if (!priceId) {
    throw new Error(
      `${plan.priceEnvVar} ist nicht gesetzt — siehe .env.example, Abschnitt "Zahlungssystem".`,
    );
  }
  return priceId;
}

/** Findet den Tarif, zu dem eine gegebene Stripe-Price-ID gehört (für den Webhook-Handler). */
export function getPlanTierByPriceId(priceId: string): PlanTier | null {
  const plan = PLAN_CATALOG.find((p) => process.env[p.priceEnvVar] === priceId);
  return plan?.tier ?? null;
}
