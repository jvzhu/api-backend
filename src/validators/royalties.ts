import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

// ISBN: 10 or 13 digits, allowing hyphens/spaces, permitting legacy X check digit
export const isbnSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      const cleaned = val.replace(/[-\s]/g, '');
      return /^(\d{9}[\dX]|\d{13})$/i.test(cleaned);
    },
    { message: 'Invalid ISBN: must be 10 or 13 digits (hyphens/spaces allowed, X permitted as check digit)' },
  );

export const normalizeIsbn = (isbn: string): string => isbn.replace(/[-\s]/g, '').toUpperCase();

const royaltyBody = {
  source: z.string().trim().min(1).max(100),
  title: z.string().trim().max(200).optional(),
  isbn: isbnSchema.transform(normalizeIsbn).optional(),
  period: z.string().trim().min(1).max(20),
  amount: z.number().int('Amount must be an integer (minor units / cents)'),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
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
      source: z.string().trim().min(1).max(100).optional(),
      title: z.string().trim().max(200).optional(),
      isbn: isbnSchema.transform(normalizeIsbn).optional(),
      period: z.string().trim().min(1).max(20).optional(),
      amount: z.number().int('Amount must be an integer (minor units / cents)').optional(),
      currency: z.string().trim().length(3).toUpperCase().optional(),
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
    source: z.string().trim().max(100).optional(),
    status: z.enum(['pending', 'paid', 'failed']).optional(),
    period: z.string().trim().max(20).optional(),
    isbn: z.string().trim().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'period', 'amount', 'source']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// CSV row validator (pre-normalization)
export const csvRowSchema = z.object({
  source: z.string().trim().min(1).max(100),
  title: z.string().trim().max(200).optional().default(''),
  isbn: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .refine(
      (v) => {
        if (v === undefined) return true;
        const cleaned = v.replace(/[-\s]/g, '');
        return /^(\d{9}[\dX]|\d{13})$/i.test(cleaned);
      },
      { message: 'Invalid ISBN' },
    )
    .transform((v) => (v !== undefined ? normalizeIsbn(v) : undefined)),
  period: z.string().trim().min(1).max(20),
  amount: z
    .string()
    .trim()
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), { message: 'Amount must be a number' })
    .transform((v) => Math.round(parseFloat(v) * 100)),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
});
