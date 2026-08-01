import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

const royaltyBody = {
  source: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  period: z.string().trim().min(1).max(50),
  amount: z.number().int().min(0),
  currency: z.string().trim().length(3).toLowerCase().default('usd'),
  status: z.enum(['pending', 'paid', 'failed']).optional(),
};

export const createRoyaltySchema = z.object({
  body: z.object({
    ...royaltyBody,
    owner: objectIdSchema.optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const updateRoyaltySchema = z.object({
  body: z
    .object({
      source: z.string().trim().min(1).max(200).optional(),
      title: z.string().trim().min(1).max(300).optional(),
      period: z.string().trim().min(1).max(50).optional(),
      amount: z.number().int().min(0).optional(),
      currency: z.string().trim().length(3).toLowerCase().optional(),
      status: z.enum(['pending', 'paid', 'failed']).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided'),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const royaltyIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const listRoyaltiesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema.extend({
    source: z.string().trim().max(200).optional(),
    status: z.enum(['pending', 'paid', 'failed']).optional(),
    period: z.string().trim().max(50).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'period', 'source']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const csvRowSchema = z.object({
  source: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  period: z.string().trim().min(1).max(50),
  amount: z
    .string()
    .trim()
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Amount must be a non-negative number')
    .transform((v) => Math.round(parseFloat(v) * 100)),
  currency: z
    .string()
    .trim()
    .length(3)
    .toLowerCase()
    .default('usd'),
});

export const createPayoutSchema = z.object({
  body: z.object({
    currency: z.string().trim().length(3).toLowerCase(),
    royaltyIds: z.array(objectIdSchema).optional(),
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
  query: paginationQuerySchema,
});
