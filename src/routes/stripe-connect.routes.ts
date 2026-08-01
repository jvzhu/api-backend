import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createConnectedAccount, createOnboardingLink, getAccountStatus } from '../services/stripe-connect-service';

export const stripeConnectRouter = Router();

stripeConnectRouter.use(requireAuth);

stripeConnectRouter.post('/accounts', async (req, res) => {
  const { stripeAccountId, created } = await createConnectedAccount(req.user!.id);
  res.status(created ? 201 : 200).json({ stripeAccountId });
});

stripeConnectRouter.post('/onboarding-link', async (req, res) => {
  const { url, expiresAt } = await createOnboardingLink(req.user!.id);
  res.json({ url, expiresAt });
});

stripeConnectRouter.get('/account', async (req, res) => {
  const status = await getAccountStatus(req.user!.id);
  res.json(status);
});
