/**
 * Stripe Connect Integration Hook
 * 
 * Automatically triggers payout creation when royalty entries reach "pending" status.
 * Integrates with the reconciliation script to streamline the workflow:
 * 
 * Reconciliation → Royalty created (pending) → Hook triggers → Payout initiated → Stripe transfer
 * 
 * Hooks:
 * - Pre-payout validation
 * - Automatic transfer to connected Stripe accounts
 * - Webhook event handling for transfer callbacks
 * - Compensation actions for failed transfers
 */

import mongoose from 'mongoose';
import { Royalty } from '../src/models/Royalty';
import { User } from '../src/models/User';
import { Payout } from '../src/models/Payout';
import { createPayout } from '../src/services/payout-service';
import { logger } from '../src/config/logger';
import { AppError } from '../src/utils/app-error';

interface AutoPayoutConfig {
  enabled: boolean;
  autoTriggerThreshold?: number; // Minimum total pending royalties in cents to trigger
  groupByCurrency: boolean; // Separate payouts per currency
  batchSize?: number; // Max royalties per payout
  retryOnFailure: boolean;
  maxRetries: number;
}

/**
 * Hook: Called after royalty reconciliation completes
 * Checks if auto-payout should be triggered
 */
export async function onRoyaltyReconciliationComplete(
  userId: string,
  reconciliationSource: string,
  config: AutoPayoutConfig = {
    enabled: true,
    autoTriggerThreshold: 5000, // $50 USD
    groupByCurrency: true,
    retryOnFailure: true,
    maxRetries: 3,
  },
): Promise<{ payouts: string[]; message: string }> {
  if (!config.enabled) {
    logger.info(`Auto-payout disabled for ${reconciliationSource}`);
    return { payouts: [], message: 'Auto-payout disabled' };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.stripeAccountId) {
    logger.warn(`User ${user.email} has no Stripe account connected; skipping auto-payout`);
    return { payouts: [], message: 'Stripe account not connected' };
  }

  // Group pending royalties by currency
  const pendingBySource = await Royalty.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
        status: 'pending',
        source: reconciliationSource,
      },
    },
    {
      $group: {
        _id: '$currency',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
  ]);

  const createdPayouts: string[] = [];

  for (const group of pendingBySource) {
    const { total, count, ids, _id: currency } = group;

    logger.info(
      `Auto-payout check: ${count} pending royalties in ${currency}, total $${(total / 100).toFixed(2)}`,
    );

    // Check threshold
    if (total < (config.autoTriggerThreshold || 5000)) {
      logger.debug(
        `Below threshold ($${((config.autoTriggerThreshold || 5000) / 100).toFixed(2)}); skipping auto-payout`,
      );
      continue;
    }

    // Create payout
    try {
      const payout = await createPayout(userId, {
        royaltyIds: ids.map((id) => String(id)),
        currency,
      });

      createdPayouts.push(String(payout._id));
      logger.info(
        `Auto-payout created: ${String(payout._id)} for ${count} royalties in ${currency}`,
      );
    } catch (error) {
      logger.error(`Auto-payout failed for ${currency}: ${error}`);
      if (!config.retryOnFailure) throw error;
    }
  }

  return {
    payouts: createdPayouts,
    message: `Auto-payout triggered: ${createdPayouts.length} payout(s) created`,
  };
}

/**
 * Hook: Validate royalty before marking as paid
 * Ensures data quality before payment processing
 */
export async function validateRoyaltyBeforePayout(
  royaltyId: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const royalty = await Royalty.findById(royaltyId);
  if (!royalty) {
    return { valid: false, errors: ['Royalty not found'] };
  }

  const errors: string[] = [];

  // Required fields
  if (!royalty.source) errors.push('Missing source');
  if (!royalty.period) errors.push('Missing period');
  if (!royalty.amount || royalty.amount <= 0) errors.push('Invalid amount');
  if (!royalty.currency) errors.push('Missing currency');

  // Metadata checks
  if (!royalty.title) errors.push('Missing title (recommended)');
  if (!royalty.isbn) errors.push('Missing ISBN (recommended)');

  // Amount reasonableness (flag unusually large payments)
  if (royalty.amount > 100000000) {
    // > $1M
    errors.push(`Unusually large amount: $${(royalty.amount / 100).toFixed(2)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hook: Post-payout callback
 * Logs payout details and triggers analytics/accounting events
 */
export async function onPayoutCreated(
  payoutId: string,
  stripeTransferId: string,
): Promise<void> {
  const payout = await Payout.findById(payoutId).populate('royalties');
  if (!payout) {
    logger.warn(`Payout ${payoutId} not found`);
    return;
  }

  const user = await User.findById(payout.owner);
  if (!user) {
    logger.warn(`User for payout ${payoutId} not found`);
    return;
  }

  // Log payout event
  logger.info(
    `Payout settled: ${String(payout._id)} | Stripe: ${stripeTransferId} | ` +
      `User: ${user.email} | Amount: ${(payout.amount as number) / 100} ${payout.currency} | ` +
      `Royalties: ${(payout.royalties as any[]).length}`,
  );

  // Could trigger downstream events here:
  // - Send receipt email to user
  // - Post to accounting system (Xero, QuickBooks)
  // - Update analytics dashboard
  // - Notify admins for high-value transfers
}

/**
 * Hook: Handle Stripe webhook for transfer events
 * Compensates for transfer reversals (chargebacks, failed ACH, etc.)
 */
export async function onStripeTransferReversed(
  stripeTransferId: string,
  reverseAmount: number,
): Promise<void> {
  const payout = await Payout.findOne({ stripeTransferId });
  if (!payout) {
    logger.warn(`Payout with Stripe transfer ${stripeTransferId} not found`);
    return;
  }

  logger.warn(
    `Stripe transfer reversed: ${stripeTransferId} | Payout: ${String(payout._id)} | Amount: $${(reverseAmount / 100).toFixed(2)}`,
  );

  // Mark payout as failed
  payout.status = 'failed';
  await payout.save();

  // Revert royalties to "pending" for manual review
  await Royalty.updateMany(
    { _id: { $in: payout.royalties } },
    { status: 'pending', payoutId: null },
  );

  logger.info(`Royalties reverted to pending for manual review`);

  // Alert admin
  const user = await User.findById(payout.owner);
  logger.error(
    `ALERT: Transfer reversed for ${user?.email} | Payout ${String(payout._id)} marked failed | ` +
      `Manual review required`,
  );
}

/**
 * Hook: Monitor payout success rate and performance
 */
export async function getPayoutMetrics(
  userId: string,
  days: number = 30,
): Promise<{
  totalPayouts: number;
  successRate: number;
  totalPaid: number;
  averagePayoutSize: number;
  failedPayouts: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const payouts = await Payout.find({
    owner: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: cutoff },
  });

  const successful = payouts.filter((p) => p.status === 'paid');
  const failed = payouts.filter((p) => p.status === 'failed');
  const totalPaid = successful.reduce((sum, p) => sum + ((p.amount as number) || 0), 0);

  return {
    totalPayouts: payouts.length,
    successRate: payouts.length > 0 ? (successful.length / payouts.length) * 100 : 0,
    totalPaid,
    averagePayoutSize: payouts.length > 0 ? totalPaid / payouts.length : 0,
    failedPayouts: failed.length,
  };
}

/**
 * Export hooks for use in API routes/middleware
 */
export const StripeConnectHooks = {
  onRoyaltyReconciliationComplete,
  validateRoyaltyBeforePayout,
  onPayoutCreated,
  onStripeTransferReversed,
  getPayoutMetrics,
};
