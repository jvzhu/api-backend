import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../helpers/test-app';
import { User } from '../../src/models/User';
import { Royalty } from '../../src/models/Royalty';
import { Payout } from '../../src/models/Payout';

const mockTransfersCreate = jest.fn();
const mockWebhooksConstructEvent = jest.fn();

jest.mock('../../src/config/stripe', () => ({
  getStripeClient: jest.fn(() => ({
    transfers: {
      create: mockTransfersCreate,
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  })),
}));

const registerAndLogin = async (email: string, password = 'StrongPass1') => {
  await request(app).post('/api/auth/register').send({ name: 'Payout User', email, password });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
};

const authHeader = (token: string) => ({ Authorization: 'Bearer ' + token });

const seedUserWithStripe = async (email: string) => {
  const token = await registerAndLogin(email);
  await User.findOneAndUpdate({ email }, { stripeAccountId: 'acct_test123' });
  return token;
};

describe('POST /api/payouts', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const email = `payout-${Date.now()}@example.com`;
    token = await seedUserWithStripe(email);
    const user = await User.findOne({ email });
    userId = String(user!._id);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/payouts').send({ currency: 'USD' });
    expect(res.status).toBe(401);
  });

  it('creates a payout for all pending royalties', async () => {
    await Royalty.create([
      { owner: userId, source: 'Eliva Press', period: '2024', amount: 5000, currency: 'USD', status: 'pending' },
      { owner: userId, source: 'Bookshop.org', period: '2026-07', amount: 1850, currency: 'USD', status: 'pending' },
    ]);

    mockTransfersCreate.mockResolvedValueOnce({ id: 'tr_integration_test' });

    const res = await request(app)
      .post('/api/payouts')
      .set(authHeader(token))
      .send({ currency: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body.payout.amount).toBe(6850);
    expect(res.body.payout.status).toBe('paid');
    expect(res.body.payout.stripeTransferId).toBe('tr_integration_test');
  });

  it('returns 404 when no pending royalties', async () => {
    const res = await request(app)
      .post('/api/payouts')
      .set(authHeader(token))
      .send({ currency: 'USD' });

    expect(res.status).toBe(404);
  });

  it('returns 502 on Stripe failure', async () => {
    await Royalty.create({
      owner: userId, source: 'Test', period: '2024', amount: 1000, currency: 'USD', status: 'pending',
    });
    mockTransfersCreate.mockRejectedValueOnce(new Error('Stripe down'));

    const res = await request(app)
      .post('/api/payouts')
      .set(authHeader(token))
      .send({ currency: 'USD' });

    expect(res.status).toBe(502);
  });
});

describe('GET /api/payouts', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const email = `payout-list-${Date.now()}@example.com`;
    token = await seedUserWithStripe(email);
    const user = await User.findOne({ email });
    userId = String(user!._id);
  });

  it('returns payouts for the user', async () => {
    await Payout.create({ owner: userId, royalties: [], amount: 1000, currency: 'USD', status: 'paid', stripeTransferId: 'tr_a' });

    const res = await request(app).get('/api/payouts').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });
});

describe('GET /api/payouts/:id', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const email = `payout-get-${Date.now()}@example.com`;
    token = await seedUserWithStripe(email);
    const user = await User.findOne({ email });
    userId = String(user!._id);
  });

  it('returns a specific payout', async () => {
    const payout = await Payout.create({
      owner: userId, royalties: [], amount: 2000, currency: 'USD', status: 'paid', stripeTransferId: 'tr_x',
    });

    const res = await request(app).get('/api/payouts/' + String(payout._id)).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.payout.amount).toBe(2000);
  });

  it('returns 404 for non-existent payout', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get('/api/payouts/' + fakeId).set(authHeader(token));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/stripe/webhooks', () => {
  it('returns 400 without stripe-signature header', async () => {
    // Set STRIPE_WEBHOOK_SECRET for this test
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'transfer.reversed' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad-sig')
      .send(JSON.stringify({ type: 'transfer.reversed' }));

    expect(res.status).toBe(400);
  });

  it('handles transfer.reversed and marks payout failed', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    const email = `webhook-${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ name: 'WH User', email, password: 'StrongPass1' });
    const user = await User.findOne({ email });
    const userId = String(user!._id);

    const royalty = await Royalty.create({
      owner: userId, source: 'Test', period: '2024', amount: 1000, currency: 'USD', status: 'paid',
    });

    const payout = await Payout.create({
      owner: userId,
      royalties: [royalty._id],
      amount: 1000,
      currency: 'USD',
      status: 'paid',
      stripeTransferId: 'tr_reversed_test',
    });

    await Royalty.findByIdAndUpdate(royalty._id, { payoutId: payout._id });

    const fakeEvent = {
      type: 'transfer.reversed',
      data: { object: { id: 'tr_reversed_test' } },
    };

    mockWebhooksConstructEvent.mockReturnValueOnce(fakeEvent);

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send(JSON.stringify(fakeEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const updatedPayout = await Payout.findById(payout._id);
    expect(updatedPayout!.status).toBe('failed');

    const updatedRoyalty = await Royalty.findById(royalty._id);
    expect(updatedRoyalty!.status).toBe('pending');
  });

  it('returns 200 for unhandled event types', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    mockWebhooksConstructEvent.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'any-sig')
      .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

    expect(res.status).toBe(200);
  });
});
