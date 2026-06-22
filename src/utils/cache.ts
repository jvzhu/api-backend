type CacheEntry = {
  statusCode: number;
  payload: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export const getCacheEntry = (key: string): CacheEntry | undefined => {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry;
};

export const setCacheEntry = (key: string, payload: unknown, statusCode = 200, ttlMs = 30_000): void => {
  cache.set(key, {
    payload,
    statusCode,
    expiresAt: Date.now() + ttlMs,
  });
};

export const invalidateCache = (predicate: (key: string) => boolean): void => {
  for (const key of cache.keys()) {
    if (predicate(key)) {
      cache.delete(key);
    }
  }
};

export const clearCache = (): void => {
  cache.clear();
};
