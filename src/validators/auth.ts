import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().transform((value) => value.toLowerCase()),
    password: passwordSchema,
  }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(8),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  params: z.object({}),
  query: z.object({}),
});
