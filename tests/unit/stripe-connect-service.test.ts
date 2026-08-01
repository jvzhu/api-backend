import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Stripe from 'stripe';

const mockAccountsCreate = jest.fn();
const mockAccountLinksCreate = jest.fn();
const mockAccountsRetrieve = jest.fn();

jest.mock('../../src/config/stripe', () => ({
  getStripeClient: jest.fn(() => ({
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
    },
    accountLinks: {
      create: mockAccountLinksCreate,
    },
  })),
}));

import { User } from '../../src/models/User';
import {
  createConnectedAccount,
  createOnboardingLink,
  getAccountStatus,
} from '../../src/services/stripe-connect-service';
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

  if (mongoServer) {
    await mongoServer.stop();
  }
});

const createUser = async (overrides: Record<string, unknown> = {}) =>
  User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    ...overrides,
  });

describe('createConnectedAccount', () => {
  it('creates a new Stripe Express account and stores the account ID', async () => {
    const user = await createUser();
    mockAccountsCreate.mockResolvedValueOnce({ id: 'acct_new123' });

    const result = await createConnectedAccount(String(user._id));

    expect(result).toEqual({ stripeAccountId: 'acct_new123', created: true });
    expect(mockAccountsCreate).toHaveBeenCalledWith({ type: 'express', email: 'test@example.com' });

    const updated = await User.findById(user._id);
    expect(updated?.stripeAccountId).toBe('acct_new123');
  });

  it('is idempotent — returns existing account without calling Stripe again', async () => {
    const user = await createUser({ stripeAccountId: 'acct_existing' });

    const result = await createConnectedAccount(String(user._id));

    expect(result).toEqual({ stripeAccountId: 'acct_existing', created: false });
    expect(mockAccountsCreate).not.toHaveBeenCalled();
  });

  it('throws 404 when user does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(createConnectedAccount(fakeId)).rejects.toThrow(AppError);
    await expect(createConnectedAccount(fakeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('maps Stripe errors to 502 AppError', async () => {
    const user = await createUser();
    const stripeError = new Stripe.errors.StripeAPIError({
      message: 'upstream failure',
      type: 'api_error',
      headers: {},
      requestId: 'req_1',
      statusCode: 500,
    });
    mockAccountsCreate.mockRejectedValueOnce(stripeError);

    await expect(createConnectedAccount(String(user._id))).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('createOnboardingLink', () => {
  it('creates and returns an onboarding link', async () => {
    const user = await createUser({ stripeAccountId: 'acct_abc' });
    const futureTs = Math.floor(Date.now() / 1000) + 300;
    mockAccountLinksCreate.mockResolvedValueOnce({
      url: 'https://connect.stripe.com/setup/e/abc',
      expires_at: futureTs,
    });

    const result = await createOnboardingLink(String(user._id));

    expect(result.url).toBe('https://connect.stripe.com/setup/e/abc');
    expect(result.expiresAt).toEqual(new Date(futureTs * 1000));
    expect(mockAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_abc', type: 'account_onboarding' }),
    );
  });

  it('throws 404 when user has no connected account', async () => {
    const user = await createUser();
    await expect(createOnboardingLink(String(user._id))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when user does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(createOnboardingLink(fakeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('maps Stripe errors to 502 AppError', async () => {
    const user = await createUser({ stripeAccountId: 'acct_abc' });
    const stripeError = new Stripe.errors.StripeAPIError({
      message: 'link failed',
      type: 'api_error',
      headers: {},
      requestId: 'req_2',
      statusCode: 500,
    });
    mockAccountLinksCreate.mockRejectedValueOnce(stripeError);

    await expect(createOnboardingLink(String(user._id))).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('getAccountStatus', () => {
  it('returns account status summary', async () => {
    const user = await createUser({ stripeAccountId: 'acct_xyz' });
    mockAccountsRetrieve.mockResolvedValueOnce({
      id: 'acct_xyz',
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    });

    const result = await getAccountStatus(String(user._id));

    expect(result).toEqual({
      id: 'acct_xyz',
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    });
    expect(mockAccountsRetrieve).toHaveBeenCalledWith('acct_xyz');
  });

  it('throws 404 when user has no connected account', async () => {
    const user = await createUser();
    await expect(getAccountStatus(String(user._id))).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when user does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(getAccountStatus(fakeId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('maps Stripe errors to 502 AppError', async () => {
    const user = await createUser({ stripeAccountId: 'acct_xyz' });
    const stripeError = new Stripe.errors.StripeAPIError({
      message: 'retrieve failed',
      type: 'api_error',
      headers: {},
      requestId: 'req_3',
      statusCode: 500,
    });
    mockAccountsRetrieve.mockRejectedValueOnce(stripeError);

    await expect(getAccountStatus(String(user._id))).rejects.toMatchObject({ statusCode: 502 });
  });
});
