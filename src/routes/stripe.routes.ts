import { Request, Response, Router } from 'express';
import express from 'express';
import { getConfig } from '../config/env';
import { getStripeClient } from '../config/stripe';
import { Payout } from '../models/Payout';
import { Royalty } from '../models/Royalty';
import { AppError } from '../utils/app-error';

export const stripeRouter = Router();

// Webhook MUST use raw body – this router is mounted before express.json() in app.ts
stripeRouter.post('/webhooks', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const { STRIPE_WEBHOOK_SECRET } = getConfig();

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    throw new AppError('Missing stripe-signature header', 400);
  }

  let event;
  try {
    const stripe = getStripeClient();
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
