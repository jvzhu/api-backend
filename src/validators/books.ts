import { z } from 'zod';

const isbnSchema = z.string().regex(/^\d{13}$/, 'ISBN must be a 13-digit string');

export const bookIsbnSchema = z.object({
  body: z.object({}),
  params: z.object({
    isbn: isbnSchema,
  }),
  query: z.object({}),
});
