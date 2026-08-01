import Stripe from 'stripe';
import { getStripeClient } from '../config/stripe';
import { getConfig } from '../config/env';
import { User } from '../models/User';
import { AppError } from '../utils/app-error';

const mapStripeError = (error: unknown): never => {
  if (error instanceof Stripe.errors.StripeError) {
    throw new AppError(`Stripe error: ${error.message}`, 502);
  }

  throw error;
};

export const createConnectedAccount = async (userId: string): Promise<{ stripeAccountId: string; created: boolean }> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.stripeAccountId) {
    return { stripeAccountId: user.stripeAccountId as string, created: false };
  }

  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email as string,
    });

    user.stripeAccountId = account.id;
    await user.save();

    return { stripeAccountId: account.id, created: true };
  } catch (error) {
    return mapStripeError(error);
  }
};

export const createOnboardingLink = async (userId: string): Promise<{ url: string; expiresAt: Date }> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.stripeAccountId) {
    throw new AppError('No connected Stripe account found. Create one first.', 404);
  }

  const stripeAccountId = user.stripeAccountId as string;
  const { STRIPE_CONNECT_REFRESH_URL, STRIPE_CONNECT_RETURN_URL } = getConfig();

  try {
    const stripe = getStripeClient();
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: STRIPE_CONNECT_REFRESH_URL,
      return_url: STRIPE_CONNECT_RETURN_URL,
      type: 'account_onboarding',
    });

    return {
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000),
    };
  } catch (error) {
    return mapStripeError(error);
  }
};

export const getAccountStatus = async (
  userId: string,
): Promise<{ id: string; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean }> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.stripeAccountId) {
    throw new AppError('No connected Stripe account found. Create one first.', 404);
  }

  const stripeAccountId = user.stripeAccountId as string;

  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return {
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    };
  } catch (error) {
    return mapStripeError(error);
  }
};
