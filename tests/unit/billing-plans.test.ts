import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAN_CATALOG,
  formatMonthlyPrice,
  getPlanDefinition,
  getStripePriceId,
  isSelfServicePlan,
} from '@/lib/billing/plans';

describe('Tarif-Katalog (Anzeigepreise)', () => {
  afterEach(() => {
    delete process.env.STRIPE_PRICE_BASIC;
    delete process.env.STRIPE_PRICE_SCHOOL;
  });

  it('nennt für Basic 15 € und für Familie 22 € pro Monat', () => {
    expect(getPlanDefinition('basic').monthlyPriceCents).toBe(1500);
    expect(getPlanDefinition('family').monthlyPriceCents).toBe(2200);
  });

  it('formatiert Preise deutsch mit Euro-Zeichen', () => {
    expect(formatMonthlyPrice(getPlanDefinition('basic'))).toMatch(/^15,00\s€$/);
  });

  it('zeigt den Schul-Tarif als „Preis auf Anfrage“', () => {
    const school = getPlanDefinition('school');
    expect(isSelfServicePlan(school)).toBe(false);
    expect(formatMonthlyPrice(school)).toBe('Preis auf Anfrage');
  });

  it('jeder Tarif mit Listenpreis hat einen positiven, ganzzahligen Cent-Betrag', () => {
    for (const plan of PLAN_CATALOG.filter(isSelfServicePlan)) {
      expect(Number.isInteger(plan.monthlyPriceCents)).toBe(true);
      expect(plan.monthlyPriceCents).toBeGreaterThan(0);
    }
  });

  it('verweigert die Stripe-Price-ID für „auf Anfrage“-Tarife, auch wenn sie gesetzt ist', () => {
    process.env.STRIPE_PRICE_SCHOOL = 'price_school_test';
    expect(() => getStripePriceId('school')).toThrow(/auf Anfrage/);
  });

  it('liefert die Stripe-Price-ID für Self-Service-Tarife', () => {
    process.env.STRIPE_PRICE_BASIC = 'price_basic_test';
    expect(getStripePriceId('basic')).toBe('price_basic_test');
  });
});
