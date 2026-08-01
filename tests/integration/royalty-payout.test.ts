import request from 'supertest';
import mongoose from 'mongoose';
import { User } from '../../src/models/User';
import { Royalty } from '../../src/models/Royalty';
import { Payout } from '../../src/models/Payout';
import { app } from '../helpers/test-app';

// Mock Stripe so tests never hit real API
jest.mock('../../src/config/stripe', () => ({
  getStripe: jest.fn().mockReturnValue({
    transfers: {
      create: jest.fn().mockResolvedValue({ id: 'tr_mock_123' }),
    },
    accounts: {
      create: jest.fn().mockResolvedValue({ id: 'acct_mock_456' }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'acct_mock_456',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/mock' }),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }),
}));

describe('Royalty CRUD integration', () => {
  let userToken: string;
  let adminToken: string;
  let userId: string;

  const registerAndLogin = async (email: string, password = 'StrongPass1') => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email,
      password,
    });
    return { token: reg.body.accessToken as string, userId: reg.body.user?.id as string };
  };

  beforeEach(async () => {
    const user = await registerAndLogin('user@royalties.test');
    userToken = user.token;
    userId = user.userId;

    await registerAndLogin('admin@royalties.test');
    await User.findOneAndUpdate({ email: 'admin@royalties.test' }, { role: 'admin' });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@royalties.test',
      password: 'StrongPass1',
    });
    adminToken = adminLogin.body.accessToken as string;
  });

  it('creates a royalty entry', async () => {
    const res = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({
        source: 'Eliva Press',
        title: 'My Book',
        period: '2026-06',
        amount: 1234,
        currency: 'usd',
      });

    expect(res.status).toBe(201);
    expect(res.body.royalty.source).toBe('Eliva Press');
    expect(res.body.royalty.amount).toBe(1234);
    expect(res.body.royalty.status).toBe('pending');
  });

  it('rejects royalty creation without auth', async () => {
    const res = await request(app).post('/api/royalties').send({
      source: 'Press',
      title: 'Book',
      period: '2026-01',
      amount: 100,
      currency: 'usd',
    });
    expect(res.status).toBe(401);
  });

  it('lists royalties with pagination', async () => {
    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press A', title: 'Book 1', period: '2026-01', amount: 100, currency: 'usd' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press B', title: 'Book 2', period: '2026-02', amount: 200, currency: 'usd' });

    const res = await request(app)
      .get('/api/royalties?page=1&limit=10')
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters royalties by status', async () => {
    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 100, currency: 'usd', status: 'pending' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book 2', period: '2026-02', amount: 200, currency: 'usd', status: 'paid' });

    const res = await request(app)
      .get('/api/royalties?status=pending')
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('pending');
  });

  it('gets a royalty by id', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    const royaltyId = create.body.royalty.id as string;

    const res = await request(app)
      .get('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(200);
    expect(res.body.royalty.id).toBe(royaltyId);
  });

  it('returns 404 for royalty not belonging to user', async () => {
    const other = await registerAndLogin('other@royalties.test');
    const create = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + other.token)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    const royaltyId = create.body.royalty.id as string;

    const res = await request(app)
      .get('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(404);
  });

  it('admin can get any royalty', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    const royaltyId = create.body.royalty.id as string;

    const res = await request(app)
      .get('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + adminToken);

    expect(res.status).toBe(200);
  });

  it('updates a royalty', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    const royaltyId = create.body.royalty.id as string;

    const res = await request(app)
      .put('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + userToken)
      .send({ amount: 999 });

    expect(res.status).toBe(200);
    expect(res.body.royalty.amount).toBe(999);
  });

  it('deletes a royalty', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    const royaltyId = create.body.royalty.id as string;

    const del = await request(app)
      .delete('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + userToken);

    expect(del.status).toBe(204);

    const get = await request(app)
      .get('/api/royalties/' + royaltyId)
      .set('Authorization', 'Bearer ' + userToken);

    expect(get.status).toBe(404);
  });

  it('returns summary totals by currency and status', async () => {
    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book 1', period: '2026-01', amount: 1000, currency: 'usd', status: 'pending' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book 2', period: '2026-02', amount: 2000, currency: 'usd', status: 'paid' });

    const res = await request(app)
      .get('/api/royalties/summary')
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveLength(1);
    const usd = res.body.summary[0];
    expect(usd.currency).toBe('usd');
    const statuses = usd.statuses as Array<{ status: string; total: number }>;
    const pending = statuses.find((s) => s.status === 'pending');
    const paid = statuses.find((s) => s.status === 'paid');
    expect(pending?.total).toBe(1000);
    expect(paid?.total).toBe(2000);
  });
});

describe('CSV import integration', () => {
  let userToken: string;

  beforeEach(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'CSV User',
      email: 'csv@royalties.test',
      password: 'StrongPass1',
    });
    userToken = reg.body.accessToken as string;
  });

  it('imports valid CSV rows and reports results', async () => {
    const csv = 'source,title,period,amount,currency\nEliva Press,My Book A,2026-01,12.34,usd\nEliva Press,My Book B,2026-02,5.00,eur';

    const res = await request(app)
      .post('/api/royalties/import')
      .set('Authorization', 'Bearer ' + userToken)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.errors).toHaveLength(0);

    const list = await request(app)
      .get('/api/royalties?limit=10')
      .set('Authorization', 'Bearer ' + userToken);
    expect(list.body.pagination.total).toBe(2);
    const amounts = (list.body.data as Array<{ amount: number }>).map((r) => r.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([500, 1234]);
  });

  it('skips invalid rows and continues import', async () => {
    const csv = 'source,title,period,amount,currency\nGood Press,Good Book,2026-01,10.00,usd\n,Bad Book,2026-01,-1.00,usd\nAnother Press,Another Book,2026-02,20.00,eur';

    const res = await request(app)
      .post('/api/royalties/import')
      .set('Authorization', 'Bearer ' + userToken)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].row).toBe(2);
  });

  it('accepts multipart file upload', async () => {
    const csv = 'source,title,period,amount,currency\nEliva,Book,2026-06,7.50,usd';

    const res = await request(app)
      .post('/api/royalties/import')
      .set('Authorization', 'Bearer ' + userToken)
      .attach('file', Buffer.from(csv), { filename: 'royalties.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
  });

  it('returns 400 when no CSV provided', async () => {
    const res = await request(app)
      .post('/api/royalties/import')
      .set('Authorization', 'Bearer ' + userToken)
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Payout integration', () => {
  let userToken: string;
  let userId: string;

  const { getStripe } = jest.requireMock('../../src/config/stripe') as {
    getStripe: jest.Mock;
  };

  beforeEach(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Payout User',
      email: 'payout@test.test',
      password: 'StrongPass1',
    });
    userToken = reg.body.accessToken as string;
    userId = reg.body.user?.id as string;
  });

  it('returns 404 when stripe account not connected', async () => {
    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 1000, currency: 'usd' });

    const res = await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    expect(res.status).toBe(404);
  });

  it('creates a payout when stripe account is connected', async () => {
    await User.findByIdAndUpdate(userId, { stripeAccountId: 'acct_test_123' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 1000, currency: 'usd' });

    getStripe.mockReturnValue({
      transfers: {
        create: jest.fn().mockResolvedValue({ id: 'tr_test_success' }),
      },
    });

    const res = await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    expect(res.status).toBe(201);
    expect(res.body.payout.stripeTransferId).toBe('tr_test_success');
    expect(res.body.payout.status).toBe('paid');
    expect(res.body.payout.amount).toBe(1000);

    const royalties = await Royalty.find({ owner: new mongoose.Types.ObjectId(userId) });
    expect(royalties.every((r) => r.status === 'paid')).toBe(true);
  });

  it('returns 400 when no pending royalties', async () => {
    await User.findByIdAndUpdate(userId, { stripeAccountId: 'acct_test_123' });

    const res = await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    expect(res.status).toBe(400);
  });

  it('lists payouts', async () => {
    await User.findByIdAndUpdate(userId, { stripeAccountId: 'acct_test_123' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 500, currency: 'usd' });

    getStripe.mockReturnValue({
      transfers: {
        create: jest.fn().mockResolvedValue({ id: 'tr_list_test' }),
      },
    });

    await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    const res = await request(app)
      .get('/api/payouts?page=1&limit=10')
      .set('Authorization', 'Bearer ' + userToken);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 502 on Stripe transfer failure', async () => {
    await User.findByIdAndUpdate(userId, { stripeAccountId: 'acct_test_123' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 1000, currency: 'usd' });

    getStripe.mockReturnValue({
      transfers: {
        create: jest.fn().mockRejectedValue(new Error('Stripe network error')),
      },
    });

    const res = await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    expect(res.status).toBe(502);

    const royalties = await Royalty.find({ owner: new mongoose.Types.ObjectId(userId) });
    expect(royalties.every((r) => r.status === 'pending')).toBe(true);
  });
});

describe('Stripe webhook integration', () => {
  const { getStripe } = jest.requireMock('../../src/config/stripe') as {
    getStripe: jest.Mock;
  };

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'transfer.reversed' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid webhook signature', async () => {
    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockImplementation(() => {
          throw new Error('invalid signature');
        }),
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid_sig')
      .send(JSON.stringify({ type: 'test' }));

    expect(res.status).toBe(400);
  });

  it('handles transfer.reversed event and reverts royalties to pending', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Webhook User',
      email: 'webhook@test.test',
      password: 'StrongPass1',
    });
    const userId = reg.body.user?.id as string;
    const userToken = reg.body.accessToken as string;

    await User.findByIdAndUpdate(userId, { stripeAccountId: 'acct_webhook_123' });

    await request(app)
      .post('/api/royalties')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ source: 'Press', title: 'Book', period: '2026-01', amount: 1000, currency: 'usd' });

    getStripe.mockReturnValue({
      transfers: {
        create: jest.fn().mockResolvedValue({ id: 'tr_webhook_123' }),
      },
    });

    const payoutRes = await request(app)
      .post('/api/payouts')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ currency: 'usd' });

    expect(payoutRes.status).toBe(201);

    const mockEvent = {
      type: 'transfer.reversed',
      data: { object: { id: 'tr_webhook_123' } },
    };

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(mockEvent),
      },
    });

    const webhookRes = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(mockEvent));

    expect(webhookRes.status).toBe(200);

    const payout = await Payout.findOne({ stripeTransferId: 'tr_webhook_123' });
    expect(payout?.status).toBe('failed');

    const royalties = await Royalty.find({ owner: new mongoose.Types.ObjectId(userId) });
    expect(royalties.every((r) => r.status === 'pending')).toBe(true);
  });

  it('ignores unknown webhook events with 200', async () => {
    const mockEvent = {
      type: 'payment_intent.created',
      data: { object: {} },
    };

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(mockEvent),
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhooks')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid_sig')
      .send(JSON.stringify(mockEvent));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
