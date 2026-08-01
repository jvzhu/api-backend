import { getStripe } from '../config/stripe';
import { getConfig } from '../config/env';
import { User } from '../models/User';
import { AppError } from '../utils/app-error';

export const getOrCreateStripeAccount = async (userId: string): Promise<string> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.stripeAccountId) {
    return String(user.stripeAccountId);
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({ type: 'express' });

  await User.findByIdAndUpdate(userId, { stripeAccountId: account.id });

  return account.id;
};

export const createOnboardingLink = async (userId: string): Promise<string> => {
  const stripeAccountId = await getOrCreateStripeAccount(userId);
  const config = getConfig();
  const stripe = getStripe();

  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: config.STRIPE_CONNECT_REFRESH_URL,
    return_url: config.STRIPE_CONNECT_RETURN_URL,
    type: 'account_onboarding',
  });

  return link.url;
};

export const getStripeAccountStatus = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user || !user.stripeAccountId) {
    throw new AppError('Stripe account not connected', 404);
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(String(user.stripeAccountId));

  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
};
