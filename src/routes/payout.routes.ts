import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Payout } from '../models/Payout';
import { createPayout, listPayouts } from '../services/payout-service';
import { AppError } from '../utils/app-error';
import { createPayoutSchema, listPayoutsSchema, payoutIdSchema } from '../validators/royalties';

export const payoutRouter = Router();

payoutRouter.use(requireAuth);

// POST / – create payout
payoutRouter.post('/', validate(createPayoutSchema), async (req, res) => {
  const payout = await createPayout(req.user!.id, {
    currency: req.body.currency,
    royaltyIds: req.body.royaltyIds,
  });

  res.status(201).json({ payout });
});

// GET / – list payouts
payoutRouter.get('/', validate(listPayoutsSchema), async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await listPayouts(req.user!.id, { page, limit });
  res.json(result);
});

// GET /:id – payout detail (owner or admin)
payoutRouter.get('/:id', validate(payoutIdSchema), async (req, res) => {
  const payoutId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  const filter = isAdmin ? { _id: payoutId } : { _id: payoutId, owner: ownerId };
  const payout = await Payout.findOne(mongoose.sanitizeFilter(filter));
  if (!payout) {
    throw new AppError('Payout not found', 404);
  }

  res.json({ payout });
});
