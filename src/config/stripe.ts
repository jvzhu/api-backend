import Stripe from 'stripe';
import { getConfig } from './env';

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const { STRIPE_SECRET_KEY } = getConfig();
    stripeInstance = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeInstance;
};
