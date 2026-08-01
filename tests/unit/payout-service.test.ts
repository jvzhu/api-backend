import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockTransfersCreate = jest.fn();

jest.mock('../../src/config/stripe', () => ({
  getStripeClient: jest.fn(() => ({
    transfers: {
      create: mockTransfersCreate,
    },
  })),
}));

import { User } from '../../src/models/User';
import { Royalty } from '../../src/models/Royalty';
import { Payout } from '../../src/models/Payout';
import { createPayout, listPayouts } from '../../src/services/payout-service';
import { AppError } from '../../src/utils/app-error';

let mongoServer: MongoMemoryServer | undefined;

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
  }
  await mongoose.connect(process.env.MONGODB_URI as string);
}, 60_000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const createUser = async (overrides: Record<string, unknown> = {}) => {
  return User.create({
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'hashedpassword',
    stripeAccountId: 'acct_test123',
    ...overrides,
  });
};

describe('createPayout', () => {
  it('throws 404 when user not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(createPayout(fakeId, { currency: 'USD' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 404 when stripe account not connected', async () => {
    const user = await createUser({ stripeAccountId: undefined });
    await expect(createPayout(String(user._id), { currency: 'USD' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Stripe account not connected',
    });
  });

  it('throws 404 when no pending royalties exist', async () => {
    const user = await createUser();
    await expect(createPayout(String(user._id), { currency: 'USD' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('creates a payout and marks royalties paid', async () => {
    const user = await createUser();
    const r1 = await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2024',
      amount: 5000,
      currency: 'USD',
      status: 'pending',
    });
    const r2 = await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2025',
      amount: 3000,
      currency: 'USD',
      status: 'pending',
    });

    mockTransfersCreate.mockResolvedValueOnce({ id: 'tr_test_abc' });

    const payout = await createPayout(String(user._id), { currency: 'USD' });

    expect(payout.amount).toBe(8000);
    expect(payout.status).toBe('paid');
    expect(payout.stripeTransferId).toBe('tr_test_abc');
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8000,
        currency: 'usd',
        destination: 'acct_test123',
      }),
    );

    const updatedR1 = await Royalty.findById(r1._id);
    const updatedR2 = await Royalty.findById(r2._id);
    expect(updatedR1?.status).toBe('paid');
    expect(updatedR2?.status).toBe('paid');
  });

  it('creates payout for specific royalty ids', async () => {
    const user = await createUser();
    const r1 = await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2024',
      amount: 5000,
      currency: 'USD',
      status: 'pending',
    });
    await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2025',
      amount: 3000,
      currency: 'USD',
      status: 'pending',
    });

    mockTransfersCreate.mockResolvedValueOnce({ id: 'tr_test_partial' });

    const payout = await createPayout(String(user._id), {
      royaltyIds: [String(r1._id)],
      currency: 'USD',
    });

    expect(payout.amount).toBe(5000);
    expect(payout.royalties).toHaveLength(1);
  });

  it('throws 400 when royalty not in pending status', async () => {
    const user = await createUser();
    const r1 = await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2024',
      amount: 5000,
      currency: 'USD',
      status: 'paid',
    });

    await expect(
      createPayout(String(user._id), { royaltyIds: [String(r1._id)], currency: 'USD' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 502 on Stripe failure and does not mark royalties paid', async () => {
    const user = await createUser();
    const r1 = await Royalty.create({
      owner: user._id,
      source: 'Eliva Press',
      period: '2024',
      amount: 5000,
      currency: 'USD',
      status: 'pending',
    });

    mockTransfersCreate.mockRejectedValueOnce(new Error('Stripe network error'));

    await expect(createPayout(String(user._id), { currency: 'USD' })).rejects.toMatchObject({
      statusCode: 502,
    });

    const unchanged = await Royalty.findById(r1._id);
    expect(unchanged?.status).toBe('pending');

    const failedPayout = await Payout.findOne({ owner: user._id });
    expect(failedPayout?.status).toBe('failed');
    expect(failedPayout?.stripeTransferId).toBeUndefined();
  });
});

describe('listPayouts', () => {
  it('returns paginated payouts for a user', async () => {
    const user = await createUser();
    await Payout.create([
      { owner: user._id, royalties: [], amount: 1000, currency: 'USD', status: 'paid', stripeTransferId: 'tr_a' },
      { owner: user._id, royalties: [], amount: 2000, currency: 'USD', status: 'created', stripeTransferId: 'tr_b' },
    ]);

    const result = await listPayouts(String(user._id), { page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' });

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
  });

  it('filters payouts by status', async () => {
    const user = await createUser();
    await Payout.create([
      { owner: user._id, royalties: [], amount: 1000, currency: 'USD', status: 'paid', stripeTransferId: 'tr_a' },
      { owner: user._id, royalties: [], amount: 2000, currency: 'USD', status: 'created', stripeTransferId: 'tr_b' },
    ]);

    const result = await listPayouts(String(user._id), { page: 1, limit: 10, status: 'paid', sortBy: 'createdAt', order: 'desc' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe('paid');
  });
});
