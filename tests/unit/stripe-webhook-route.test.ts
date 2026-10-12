// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  syncSubscriptionFromStripe: vi.fn(),
  deleteLocalSubscription: vi.fn(),
}));

vi.mock('@/lib/server/stripe', () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
}));
vi.mock('@/lib/billing/subscriptionService', () => ({
  syncSubscriptionFromStripe: mocks.syncSubscriptionFromStripe,
  deleteLocalSubscription: mocks.deleteLocalSubscription,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const SECRET = 'whsec_test';
const BODY = '{"id":"evt_1",  "spaced":true}'; // bewusst unnormalisiertes JSON (Doppel-Leerzeichen)

function makeRequest(headers: Record<string, string> = { 'stripe-signature': 't=1,v1=abc' }) {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body: BODY,
  });
}

function eventOf(type: string, object: Record<string, unknown> = { id: 'sub_1' }) {
  return { type, data: { object } };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
});

describe('POST /api/webhooks/stripe', () => {
  it('500, wenn STRIPE_WEBHOOK_SECRET fehlt', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it('400 ohne stripe-signature-Header, constructEvent wird nicht aufgerufen', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it('400, wenn constructEvent wirft; keine Service-Aufrufe', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
    expect(mocks.deleteLocalSubscription).not.toHaveBeenCalled();
  });

  it('übergibt Roh-Body, Signatur und Secret an constructEvent', async () => {
    mocks.constructEvent.mockReturnValue(eventOf('invoice.paid'));
    await POST(makeRequest({ 'stripe-signature': 'sig_xyz' }));
    expect(mocks.constructEvent).toHaveBeenCalledWith(BODY, 'sig_xyz', SECRET);
  });

  it('irrelevantes Event: 200 mit ignored, keine Service-Aufrufe', async () => {
    mocks.constructEvent.mockReturnValue(eventOf('invoice.paid'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, ignored: 'invoice.paid' });
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
    expect(mocks.deleteLocalSubscription).not.toHaveBeenCalled();
  });

  it.each(['customer.subscription.created', 'customer.subscription.updated'])(
    '%s -> syncSubscriptionFromStripe',
    async (type) => {
      const object = { id: 'sub_9', status: 'active' };
      mocks.constructEvent.mockReturnValue(eventOf(type, object));
      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true });
      expect(mocks.syncSubscriptionFromStripe).toHaveBeenCalledWith(object);
      expect(mocks.deleteLocalSubscription).not.toHaveBeenCalled();
    },
  );

  it('deleted -> deleteLocalSubscription(subscription.id)', async () => {
    mocks.constructEvent.mockReturnValue(eventOf('customer.subscription.deleted', { id: 'sub_del' }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.deleteLocalSubscription).toHaveBeenCalledWith('sub_del');
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it('500, wenn der Service wirft (Stripe soll wiederholen)', async () => {
    mocks.constructEvent.mockReturnValue(eventOf('customer.subscription.updated'));
    mocks.syncSubscriptionFromStripe.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it('500, wenn deleteLocalSubscription wirft', async () => {
    mocks.constructEvent.mockReturnValue(eventOf('customer.subscription.deleted'));
    mocks.deleteLocalSubscription.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
