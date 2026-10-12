// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  subFindUnique: vi.fn(),
  subUpsert: vi.fn(),
  subDeleteMany: vi.fn(),
  getPlanTierByPriceId: vi.fn(),
  logAuditEvent: vi.fn(),
  sendPaymentMethodChangedEmail: vi.fn(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    subscription: {
      findUnique: mocks.subFindUnique,
      upsert: mocks.subUpsert,
      deleteMany: mocks.subDeleteMany,
    },
  },
}));
vi.mock('@/lib/server/stripe', () => ({ getStripeClient: vi.fn() }));
vi.mock('@/lib/billing/plans', () => ({ getPlanTierByPriceId: mocks.getPlanTierByPriceId }));
vi.mock('@/lib/server/audit', () => ({ logAuditEvent: mocks.logAuditEvent }));
vi.mock('@/lib/server/email', () => ({
  sendPaymentMethodChangedEmail: mocks.sendPaymentMethodChangedEmail,
}));

import {
  syncSubscriptionFromStripe,
  mapStripeSubscriptionStatus,
  deleteLocalSubscription,
} from '@/lib/billing/subscriptionService';

const PERIOD_END_SECONDS = 1_800_000_000;

type Overrides = Record<string, unknown>;
function makeSub(overrides: Overrides = {}) {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_basic' }, current_period_end: PERIOD_END_SECONDS }] },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.userFindUnique.mockResolvedValue({ id: 'user_1', email: 'eltern@example.com' });
  mocks.getPlanTierByPriceId.mockReturnValue('basic');
  mocks.subFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('syncSubscriptionFromStripe', () => {
  it('akzeptiert customer als String', async () => {
    await syncSubscriptionFromStripe(makeSub({ customer: 'cus_str' }));
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { stripeCustomerId: 'cus_str' } });
  });

  it('akzeptiert customer als Objekt', async () => {
    await syncSubscriptionFromStripe(makeSub({ customer: { id: 'cus_obj' } }));
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { stripeCustomerId: 'cus_obj' } });
  });

  it('ohne User: kein upsert, kein Audit, keine Mail', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    await syncSubscriptionFromStripe(makeSub());
    expect(mocks.subUpsert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    expect(mocks.sendPaymentMethodChangedEmail).not.toHaveBeenCalled();
  });

  it('unbekannte Price-ID: kein upsert', async () => {
    mocks.getPlanTierByPriceId.mockReturnValue(null);
    await syncSubscriptionFromStripe(makeSub());
    expect(mocks.subUpsert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    expect(mocks.sendPaymentMethodChangedEmail).not.toHaveBeenCalled();
  });

  it('fehlende Price-ID (keine Items): kein upsert', async () => {
    await syncSubscriptionFromStripe(makeSub({ items: { data: [] } }));
    expect(mocks.getPlanTierByPriceId).not.toHaveBeenCalled();
    expect(mocks.subUpsert).not.toHaveBeenCalled();
  });

  it('Normalfall: upsert mit korrekten Feldern und Audit-Event', async () => {
    await syncSubscriptionFromStripe(makeSub({ cancel_at_period_end: true }));

    const expected = {
      userId: 'user_1',
      planTier: 'basic',
      status: 'active',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_basic',
      currentPeriodEnd: new Date(PERIOD_END_SECONDS * 1000),
      cancelAtPeriodEnd: true,
    };
    expect(mocks.getPlanTierByPriceId).toHaveBeenCalledWith('price_basic');
    expect(mocks.subUpsert).toHaveBeenCalledTimes(1);
    const arg = mocks.subUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user_1' });
    expect(arg.create).toEqual(expected);
    expect(arg.update).toEqual({
      planTier: 'basic',
      status: 'active',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_basic',
      currentPeriodEnd: new Date(PERIOD_END_SECONDS * 1000),
      cancelAtPeriodEnd: true,
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user_1',
        action: 'subscription.sync',
        targetType: 'Subscription',
        targetId: 'sub_1',
      }),
    );
  });

  it.each([
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused',
  ])('übernimmt Status "%s" 1:1', async (status) => {
    await syncSubscriptionFromStripe(makeSub({ status }));
    expect(mocks.subUpsert.mock.calls[0][0].create.status).toBe(status);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('unbekannter Status wird als incomplete gespeichert und geloggt', async () => {
    await syncSubscriptionFromStripe(makeSub({ status: 'some_future_status' }));
    expect(mocks.subUpsert.mock.calls[0][0].create.status).toBe('incomplete');
    expect(mocks.subUpsert.mock.calls[0][0].update.status).toBe('incomplete');
    expect(errorSpy).toHaveBeenCalled();
    expect(mocks.logAuditEvent.mock.calls[0][0].metadata).toEqual({
      planTier: 'basic',
      status: 'incomplete',
      stripeStatus: 'some_future_status',
    });
  });

  it('Wechsel von active auf unbekannten Status entzieht Zugang und informiert', async () => {
    mocks.subFindUnique.mockResolvedValue({ planTier: 'basic', status: 'active' });
    await syncSubscriptionFromStripe(makeSub({ status: 'some_future_status' }));
    expect(mocks.subUpsert.mock.calls[0][0].update.status).toBe('incomplete');
    expect(mocks.sendPaymentMethodChangedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendPaymentMethodChangedEmail.mock.calls[0][1]).toContain(
      'Zugang ist derzeit nicht aktiv',
    );
  });

  it('kürzt überlange/mehrzeilige Status in Log und Audit', async () => {
    const evil = 'x\n[FAKE] '.repeat(50);
    await syncSubscriptionFromStripe(makeSub({ status: evil }));
    expect(mocks.logAuditEvent.mock.calls[0][0].metadata.stripeStatus).toHaveLength(64);
    const logLine = String(errorSpy.mock.calls[0][0]);
    expect(logLine).not.toContain('\n');
  });

  describe('Benachrichtigungs-Mail', () => {
    it('bei neuer Subscription', async () => {
      await syncSubscriptionFromStripe(makeSub());
      expect(mocks.sendPaymentMethodChangedEmail).toHaveBeenCalledTimes(1);
      expect(mocks.sendPaymentMethodChangedEmail.mock.calls[0][0]).toBe('eltern@example.com');
    });

    it('bei Tarifwechsel', async () => {
      mocks.subFindUnique.mockResolvedValue({ planTier: 'family', status: 'active' });
      await syncSubscriptionFromStripe(makeSub());
      expect(mocks.sendPaymentMethodChangedEmail).toHaveBeenCalledTimes(1);
    });

    it('bei Statuswechsel', async () => {
      mocks.subFindUnique.mockResolvedValue({ planTier: 'basic', status: 'past_due' });
      await syncSubscriptionFromStripe(makeSub());
      expect(mocks.sendPaymentMethodChangedEmail).toHaveBeenCalledTimes(1);
    });

    it('NICHT bei gleichem Tarif und Status', async () => {
      mocks.subFindUnique.mockResolvedValue({ planTier: 'basic', status: 'active' });
      await syncSubscriptionFromStripe(makeSub());
      expect(mocks.subUpsert).toHaveBeenCalled();
      expect(mocks.sendPaymentMethodChangedEmail).not.toHaveBeenCalled();
    });

    async function mailText(overrides: Overrides) {
      await syncSubscriptionFromStripe(makeSub(overrides));
      return mocks.sendPaymentMethodChangedEmail.mock.calls[0][1] as string;
    }

    it('canceled: "wurde beendet"', async () => {
      expect(await mailText({ status: 'canceled' })).toContain('wurde beendet');
    });

    it('past_due: Zahlungshinweis', async () => {
      expect(await mailText({ status: 'past_due' })).toContain('Zahlung nicht abgebucht werden');
    });

    it('paused: "Zugang ist derzeit nicht aktiv"', async () => {
      expect(await mailText({ status: 'paused' })).toContain('Zugang ist derzeit nicht aktiv');
    });

    it('unbekannter Status: "Zugang ist derzeit nicht aktiv"', async () => {
      expect(await mailText({ status: 'some_future_status' })).toContain(
        'Zugang ist derzeit nicht aktiv',
      );
    });

    it('active: "aktiver Tarif ist jetzt"', async () => {
      expect(await mailText({ status: 'active' })).toContain('aktiver Tarif ist jetzt "Basic"');
    });
  });
});

describe('mapStripeSubscriptionStatus', () => {
  it('bekannte Werte werden unverändert zurückgegeben', () => {
    expect(mapStripeSubscriptionStatus('active', 'sub_1')).toBe('active');
    expect(mapStripeSubscriptionStatus('paused', 'sub_1')).toBe('paused');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('unbekannter Wert -> incomplete und console.error', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mapStripeSubscriptionStatus('brand_new' as any, 'sub_1')).toBe('incomplete');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('"constructor" trifft keine geerbte Object-Eigenschaft', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mapStripeSubscriptionStatus('constructor' as any, 'sub_1')).toBe('incomplete');
  });
});

describe('deleteLocalSubscription', () => {
  it('ruft deleteMany mit der Stripe-Subscription-ID auf', async () => {
    await deleteLocalSubscription('sub_42');
    expect(mocks.subDeleteMany).toHaveBeenCalledWith({ where: { stripeSubscriptionId: 'sub_42' } });
  });
});
