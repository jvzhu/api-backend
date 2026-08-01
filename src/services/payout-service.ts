import mongoose from 'mongoose';
import { getStripeClient } from '../config/stripe';
import { Payout } from '../models/Payout';
import { Royalty } from '../models/Royalty';
import { User } from '../models/User';
import { AppError } from '../utils/app-error';

export const createPayout = async (
  userId: string,
  options: { royaltyIds?: string[]; currency: string },
): Promise<InstanceType<typeof Payout>> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.stripeAccountId) {
    throw new AppError('Stripe account not connected', 404);
  }

  const stripeAccountId = user.stripeAccountId as string;
  const currency = options.currency.toUpperCase();

  // Build query for royalties
  let royalties: InstanceType<typeof Royalty>[];

  if (options.royaltyIds && options.royaltyIds.length > 0) {
    royalties = await Royalty.find({
      _id: { $in: options.royaltyIds.map((id) => new mongoose.Types.ObjectId(id)) },
      owner: new mongoose.Types.ObjectId(userId),
    });

    if (royalties.length !== options.royaltyIds.length) {
      throw new AppError('One or more royalties not found or do not belong to this user', 404);
    }

    const nonPending = royalties.filter((r) => r.status !== 'pending');
    if (nonPending.length > 0) {
      throw new AppError('One or more royalties are not in pending status', 400);
    }

    const wrongCurrency = royalties.filter(
      (r) => (r.currency as string).toUpperCase() !== currency,
    );
    if (wrongCurrency.length > 0) {
      throw new AppError(`One or more royalties do not match currency ${currency}`, 400);
    }
  } else {
    royalties = await Royalty.find({
      owner: new mongoose.Types.ObjectId(userId),
      status: 'pending',
      currency,
    });

    if (royalties.length === 0) {
      throw new AppError('No pending royalties found for this currency', 404);
    }
  }

  const amount = royalties.reduce((sum, r) => sum + (r.amount as number), 0);
  const royaltyIds = royalties.map((r) => r._id);

  // Persist payout as "created" first (without stripeTransferId) to get an id for
  // metadata, and commit it before calling Stripe so no external network call
  // happens inside a MongoDB transaction.
  const payout = new Payout({
    owner: new mongoose.Types.ObjectId(userId),
    royalties: royaltyIds,
    amount,
    currency,
    status: 'created',
  });
  await payout.save();

  // Call Stripe outside of any transaction
  const stripe = getStripeClient();
  let transfer: { id: string };
  try {
    transfer = await stripe.transfers.create({
      amount,
      currency: currency.toLowerCase(),
      destination: stripeAccountId,
      metadata: { payoutId: String(payout._id) },
    });
  } catch (stripeError) {
    // Compensating action: mark the persisted payout as failed
    payout.status = 'failed';
    await payout.save();
    throw new AppError(
      `Stripe transfer failed: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`,
      502,
    );
  }

  // Update payout with transfer id and mark royalties paid in a short transaction
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    payout.stripeTransferId = transfer.id;
    payout.status = 'paid';
    await payout.save({ session });

    // Only update royalties that are still pending and unclaimed to guard
    // against concurrent payouts/webhook updates while the Stripe call was
    // in flight. If any royalty was modified concurrently, abort and rely on
    // the webhook reconciliation path to settle the payout.
    const updateResult = await Royalty.updateMany(
      { _id: { $in: royaltyIds }, status: 'pending', payoutId: null },
      { status: 'paid', payoutId: payout._id },
      { session },
    );

    if (updateResult.modifiedCount !== royaltyIds.length) {
      throw new AppError(
        'One or more royalties were modified concurrently; payout will be reconciled via webhook',
        409,
      );
    }

    await session.commitTransaction();
  } catch (updateError) {
    await session.abortTransaction().catch(() => undefined);
    // Compensating action: the Stripe transfer succeeded but the DB update did
    // not commit. Record the transfer id on the payout (outside the aborted
    // transaction) so webhook reconciliation can settle it later.
    await Payout.updateOne(
      { _id: payout._id },
      { $set: { stripeTransferId: transfer.id } },
    ).catch(() => undefined);
    throw updateError;
  } finally {
    await session.endSession();
  }

  return payout;
};

export const listPayouts = async (
  userId: string,
  options: { page: number; limit: number; status?: 'created' | 'paid' | 'failed'; sortBy: string; order: 'asc' | 'desc' },
): Promise<{ data: InstanceType<typeof Payout>[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const { page, limit, status, sortBy, order } = options;

  const filter: Record<string, unknown> = {
    owner: new mongoose.Types.ObjectId(userId),
  };

  if (typeof status !== 'undefined') {
    const allowedStatuses = new Set(['created', 'paid', 'failed']);
    if (typeof status !== 'string' || !allowedStatuses.has(status)) {
      throw new AppError('Invalid payout status', 400);
    }
    filter.status = status;
  }

  const safeFilter = mongoose.sanitizeFilter(filter);

  const [data, total] = await Promise.all([
    Payout.find(safeFilter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payout.countDocuments(safeFilter),
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
