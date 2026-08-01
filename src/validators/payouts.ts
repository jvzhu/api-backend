import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

export const createPayoutSchema = z.object({
  body: z.object({
    royaltyIds: z.array(objectIdSchema).min(1).optional(),
    currency: z.string().trim().length(3).toUpperCase().default('USD'),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const payoutIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const listPayoutsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema.extend({
    status: z.enum(['created', 'paid', 'failed']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'amount']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});
