import mongoose from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: 'Invalid MongoDB ObjectId',
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
