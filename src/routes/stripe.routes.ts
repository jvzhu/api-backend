import { Request, Response, Router } from 'express';
import express from 'express';
import { getConfig } from '../config/env';
import { getStripe } from '../config/stripe';
import { Payout } from '../models/Payout';
import { Royalty } from '../models/Royalty';
import { requireAuth } from '../middleware/auth';
import {
  createOnboardingLink,
  getOrCreateStripeAccount,
  getStripeAccountStatus,
} from '../services/stripe-connect-service';
import { AppError } from '../utils/app-error';

export const stripeRouter = Router();

// Webhook MUST use raw body – mounted before express.json() in app.ts
stripeRouter.post('/webhooks', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const { STRIPE_WEBHOOK_SECRET } = getConfig();

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    throw new AppError('Missing stripe-signature header', 400);
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError('Webhook signature verification failed', 400);
  }

  if (event.type === 'transfer.reversed') {
    const transfer = event.data.object as { id: string };
    const payout = await Payout.findOne({ stripeTransferId: transfer.id });
    if (payout) {
      payout.status = 'failed';
      await payout.save();

      await Royalty.updateMany(
        { _id: { $in: payout.royalties } },
        { status: 'pending', payoutId: null },
      );
    }
  }

  res.status(200).json({ received: true });
});

// Connect routes – require auth
stripeRouter.use(requireAuth);

// POST /connect/accounts – create or return existing Stripe Express account
stripeRouter.post('/connect/accounts', async (req, res) => {
  const accountId = await getOrCreateStripeAccount(req.user!.id);
  res.status(201).json({ accountId });
});

// POST /connect/onboarding-link – generate onboarding URL
stripeRouter.post('/connect/onboarding-link', async (req, res) => {
  const url = await createOnboardingLink(req.user!.id);
  res.json({ url });
});

// GET /connect/account – account status
stripeRouter.get('/connect/account', async (req, res) => {
  const status = await getStripeAccountStatus(req.user!.id);
  res.json(status);
});
