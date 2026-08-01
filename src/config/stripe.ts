import Stripe from 'stripe';
import { getConfig } from './env';

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    const { STRIPE_SECRET_KEY } = getConfig();
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
};
