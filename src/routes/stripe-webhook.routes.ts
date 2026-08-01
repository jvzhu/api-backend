import { Router, Request, Response, NextFunction } from 'express';
import { getStripeClient } from '../config/stripe';
import { getConfig } from '../config/env';
import { Payout } from '../models/Payout';
import { Royalty } from '../models/Royalty';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';

export const stripeWebhookRouter = Router();

// Mount at /api/stripe/webhooks with express.raw() applied in app.ts for this path only.
// The router handles POST / (root, since it's mounted at the full path).
stripeWebhookRouter.post(
  '/',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { STRIPE_WEBHOOK_SECRET } = getConfig();

    if (!STRIPE_WEBHOOK_SECRET) {
      next(new AppError('Webhook secret not configured', 500));
      return;
    }

    const sigHeader = req.headers['stripe-signature'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!sig) {
      next(new AppError('Missing stripe-signature header', 400));
      return;
    }

    let event;
    try {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      next(new AppError(`Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`, 400));
      return;
    }

    try {
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

          logger.info(`Payout ${String(payout._id)} marked failed due to transfer.reversed for transfer ${transfer.id}`);
        }
      }
      // Return 200 for all handled and unhandled event types
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
);
