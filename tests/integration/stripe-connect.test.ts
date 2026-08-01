import request from 'supertest';
import { app } from '../helpers/test-app';

jest.mock('../../src/services/stripe-connect-service', () => ({
  createConnectedAccount: jest.fn(),
  createOnboardingLink: jest.fn(),
  getAccountStatus: jest.fn(),
}));

import {
  createConnectedAccount,
  createOnboardingLink,
  getAccountStatus,
} from '../../src/services/stripe-connect-service';
import { AppError } from '../../src/utils/app-error';

const mockCreate = createConnectedAccount as jest.MockedFunction<typeof createConnectedAccount>;
const mockOnboarding = createOnboardingLink as jest.MockedFunction<typeof createOnboardingLink>;
const mockStatus = getAccountStatus as jest.MockedFunction<typeof getAccountStatus>;

const registerAndLogin = async (email = 'stripe@example.com', password = 'StrongPass1') => {
  await request(app).post('/api/auth/register').send({ name: 'Stripe User', email, password });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
};

describe('POST /api/stripe/connect/accounts', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/stripe/connect/accounts');
    expect(res.status).toBe(401);
  });

  it('returns 201 when a new account is created', async () => {
    const token = await registerAndLogin('stripe1@example.com');
    mockCreate.mockResolvedValueOnce({ stripeAccountId: 'acct_new', created: true });

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .post('/api/stripe/connect/accounts')
      .set('Authorization', bearer);

    expect(res.status).toBe(201);
    expect(res.body.stripeAccountId).toBe('acct_new');
  });

  it('returns 200 when account already exists', async () => {
    const token = await registerAndLogin('stripe2@example.com');
    mockCreate.mockResolvedValueOnce({ stripeAccountId: 'acct_existing', created: false });

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .post('/api/stripe/connect/accounts')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.stripeAccountId).toBe('acct_existing');
  });

  it('returns 502 on Stripe error', async () => {
    const token = await registerAndLogin('stripe3@example.com');
    mockCreate.mockRejectedValueOnce(new AppError('Stripe error: upstream failure', 502));

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .post('/api/stripe/connect/accounts')
      .set('Authorization', bearer);

    expect(res.status).toBe(502);
  });
});

describe('POST /api/stripe/connect/onboarding-link', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/stripe/connect/onboarding-link');
    expect(res.status).toBe(401);
  });

  it('returns the onboarding URL and expiry', async () => {
    const token = await registerAndLogin('stripe4@example.com');
    const expiresAt = new Date(Date.now() + 300_000);
    mockOnboarding.mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/e/abc', expiresAt });

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .post('/api/stripe/connect/onboarding-link')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://connect.stripe.com/setup/e/abc');
    expect(res.body.expiresAt).toBeDefined();
  });

  it('returns 404 when no connected account exists', async () => {
    const token = await registerAndLogin('stripe5@example.com');
    mockOnboarding.mockRejectedValueOnce(new AppError('No connected Stripe account found. Create one first.', 404));

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .post('/api/stripe/connect/onboarding-link')
      .set('Authorization', bearer);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/stripe/connect/account', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/stripe/connect/account');
    expect(res.status).toBe(401);
  });

  it('returns account status', async () => {
    const token = await registerAndLogin('stripe6@example.com');
    mockStatus.mockResolvedValueOnce({
      id: 'acct_xyz',
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    });

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .get('/api/stripe/connect/account')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'acct_xyz',
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    });
  });

  it('returns 404 when no connected account exists', async () => {
    const token = await registerAndLogin('stripe7@example.com');
    mockStatus.mockRejectedValueOnce(new AppError('No connected Stripe account found. Create one first.', 404));

    const bearer = 'Bearer ' + token;
    const res = await request(app)
      .get('/api/stripe/connect/account')
      .set('Authorization', bearer);

    expect(res.status).toBe(404);
  });
});
