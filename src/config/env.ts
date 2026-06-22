import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/api-backend'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development-refresh-secret'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export type AppConfig = z.infer<typeof envSchema>;

export const getConfig = (): AppConfig => {
  const parsed = envSchema.parse(process.env);

  if (
    parsed.NODE_ENV === 'production' &&
    (parsed.JWT_ACCESS_SECRET === 'development-access-secret' ||
      parsed.JWT_REFRESH_SECRET === 'development-refresh-secret')
  ) {
    throw new Error('Production JWT secrets must be overridden with secure values.');
  }

  return parsed;
};
