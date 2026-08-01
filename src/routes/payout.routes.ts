import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Payout } from '../models/Payout';
import { createPayout, listPayouts } from '../services/payout-service';
import { AppError } from '../utils/app-error';
import { createPayoutSchema, listPayoutsSchema, payoutIdSchema } from '../validators/payouts';

export const payoutRouter = Router();

payoutRouter.use(requireAuth);

// POST /api/payouts
payoutRouter.post('/', validate(createPayoutSchema), async (req, res) => {
  const { royaltyIds, currency } = req.body as { royaltyIds?: string[]; currency: string };
  const payout = await createPayout(req.user!.id, { royaltyIds, currency });
  res.status(201).json({ payout });
});

// GET /api/payouts
payoutRouter.get('/', validate(listPayoutsSchema), async (req, res) => {
  const { page, limit, status, sortBy, order } = req.query as unknown as {
    page: number;
    limit: number;
    status?: 'created' | 'paid' | 'failed';
    sortBy: string;
    order: 'asc' | 'desc';
  };

  const result = await listPayouts(req.user!.id, { page, limit, status, sortBy, order });
  res.json(result);
});

// GET /api/payouts/:id
payoutRouter.get('/:id', validate(payoutIdSchema), async (req, res) => {
  const payoutId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const filter: Record<string, unknown> = { _id: payoutId };
  if (!isAdmin) filter.owner = new mongoose.Types.ObjectId(req.user!.id);

  const payout = await Payout.findOne(filter);
  if (!payout) {
    throw new AppError('Payout not found', 404);
  }

  res.json({ payout });
});
