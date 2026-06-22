import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const baseUserBody = {
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(['admin', 'user']).optional(),
  profile: z
    .object({
      bio: z.string().max(280).optional(),
      avatarUrl: z.url().optional(),
      timezone: z.string().max(100).optional(),
    })
    .optional(),
};

export const createUserSchema = z.object({
  body: z.object({
    ...baseUserBody,
    password: passwordSchema,
  }),
  params: z.object({}),
  query: z.object({}),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.email().transform((value) => value.toLowerCase()).optional(),
      password: passwordSchema.optional(),
      role: z.enum(['admin', 'user']).optional(),
      profile: z
        .object({
          bio: z.string().max(280).optional(),
          avatarUrl: z.url().optional(),
          timezone: z.string().max(100).optional(),
        })
        .optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided'),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const userIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const listUsersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema.extend({
    search: z.string().trim().max(100).optional(),
  }),
});
