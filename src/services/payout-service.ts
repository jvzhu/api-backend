import mongoose from 'mongoose';
import { getStripe } from '../config/stripe';
import { Payout } from '../models/Payout';
import { Royalty } from '../models/Royalty';
import { User } from '../models/User';
import { AppError } from '../utils/app-error';

export const createPayout = async (
  userId: string,
  input: { royaltyIds?: string[]; currency: string },
): Promise<InstanceType<typeof Payout>> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const stripeAccountId = user.stripeAccountId as string | null | undefined;
  if (!stripeAccountId) {
    throw new AppError('Stripe account not connected', 404);
  }

  const ownerId = new mongoose.Types.ObjectId(userId);
  const currency = input.currency.toLowerCase();

  let pendingRoyalties;

  if (input.royaltyIds && input.royaltyIds.length > 0) {
    const ids = input.royaltyIds.map((id) => new mongoose.Types.ObjectId(id));
    pendingRoyalties = await Royalty.find(
      mongoose.sanitizeFilter({ _id: { $in: ids }, owner: ownerId, status: 'pending', currency }),
    );

    if (pendingRoyalties.length !== input.royaltyIds.length) {
      throw new AppError(
        'One or more royalties not found, not pending, wrong currency, or do not belong to this user',
        400,
      );
    }
  } else {
    pendingRoyalties = await Royalty.find(
      mongoose.sanitizeFilter({ owner: ownerId, status: 'pending', currency }),
    );

    if (pendingRoyalties.length === 0) {
      throw new AppError('No pending royalties found for this currency', 400);
    }
  }

  const totalAmount = pendingRoyalties.reduce((sum, r) => sum + (r.amount as number), 0);
  const royaltyIds = pendingRoyalties.map((r) => r._id);

  // Create payout record first (status: 'created')
  const payout = await Payout.create({
    owner: ownerId,
    royalties: royaltyIds,
    amount: totalAmount,
    currency,
    status: 'created',
  });

  // Attempt Stripe transfer
  let transfer;
  try {
    const stripe = getStripe();
    transfer = await stripe.transfers.create({
      amount: totalAmount,
      currency,
      destination: stripeAccountId,
      metadata: { payoutId: String(payout._id) },
    });
  } catch {
    // Stripe failed – leave royalties as pending, surface error to caller
    await Payout.findByIdAndDelete(payout._id);
    throw new AppError('Stripe transfer failed', 502);
  }

  // Stripe succeeded – persist transfer and mark royalties paid
  payout.stripeTransferId = transfer.id;
  payout.status = 'paid';
  await payout.save();

  await Royalty.updateMany(
    { _id: { $in: royaltyIds } },
    { status: 'paid', payoutId: payout._id },
  );

  return payout;
};

export const listPayouts = async (
  userId: string,
  { page, limit }: { page: number; limit: number },
) => {
  const ownerId = new mongoose.Types.ObjectId(userId);
  const filter = mongoose.sanitizeFilter({ owner: ownerId });

  const [data, total] = await Promise.all([
    Payout.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payout.countDocuments(filter),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
