// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

// Ergänzung zu stripe-webhook-route.test.ts: Dort ist constructEvent gemockt.
// Hier läuft die ECHTE Signaturprüfung des Stripe-SDK (rein lokal, kein
// Netzwerkzugriff), damit nachgewiesen ist, dass gefälschte/manipulierte
// Anfragen tatsächlich abgelehnt werden.
const realStripe = new Stripe('sk_test_dummy');

const mocks = vi.hoisted(() => ({
  syncSubscriptionFromStripe: vi.fn(),
  deleteLocalSubscription: vi.fn(),
}));

vi.mock('@/lib/server/stripe', () => ({ getStripeClient: () => realStripe }));
vi.mock('@/lib/billing/subscriptionService', () => ({
  syncSubscriptionFromStripe: mocks.syncSubscriptionFromStripe,
  deleteLocalSubscription: mocks.deleteLocalSubscription,
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const SECRET = 'whsec_test_secret';
const PAYLOAD = JSON.stringify({
  id: 'evt_1',
  object: 'event',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1', object: 'subscription' } },
});

function signedRequest(body: string, header: string) {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header },
    body,
  });
}

function header(opts: { payload?: string; secret?: string; timestamp?: number } = {}) {
  return realStripe.webhooks.generateTestHeaderString({
    payload: opts.payload ?? PAYLOAD,
    secret: opts.secret ?? SECRET,
    timestamp: opts.timestamp,
  });
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

describe('POST /api/webhooks/stripe — echte Signaturprüfung', () => {
  it('akzeptiert korrekt signiertes Event', async () => {
    const res = await POST(signedRequest(PAYLOAD, header()));
    expect(res.status).toBe(200);
    expect(mocks.syncSubscriptionFromStripe).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_1' }),
    );
  });

  it('lehnt manipulierten Body ab (400)', async () => {
    const tampered = PAYLOAD.replace('sub_1', 'sub_2');
    const res = await POST(signedRequest(tampered, header()));
    expect(res.status).toBe(400);
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it('lehnt mit falschem Secret signiertes Event ab (400)', async () => {
    const res = await POST(signedRequest(PAYLOAD, header({ secret: 'whsec_wrong' })));
    expect(res.status).toBe(400);
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it('lehnt veralteten Zeitstempel ab (Replay-Schutz, Toleranz 300 s)', async () => {
    const old = Math.floor(Date.now() / 1000) - 600;
    const res = await POST(signedRequest(PAYLOAD, header({ timestamp: old })));
    expect(res.status).toBe(400);
    expect(mocks.syncSubscriptionFromStripe).not.toHaveBeenCalled();
  });
});
