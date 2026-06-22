import { NextFunction, Request, Response } from 'express';
import { getCacheEntry, setCacheEntry } from '../utils/cache';

export const cacheResponse = (ttlMs = 30_000) => (req: Request, res: Response, next: NextFunction): void => {
  const key = `${req.method}:${req.originalUrl}:${req.user?.id ?? 'anonymous'}`;
  const cached = getCacheEntry(key);

  if (cached) {
    res.status(cached.statusCode).json(cached.payload);
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    setCacheEntry(key, body, res.statusCode, ttlMs);
    return originalJson(body);
  }) as typeof res.json;

  next();
};
