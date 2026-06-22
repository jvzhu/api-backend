import { getConfig } from './env';

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const write = (level: LogLevel, message: string, meta?: unknown): void => {
  const activeLevel = levels[getConfig().LOG_LEVEL];
  if (levels[level] > activeLevel) {
    return;
  }

  const serializedMeta =
    meta instanceof Error
      ? {
          name: meta.name,
          message: meta.message,
          stack: meta.stack,
        }
      : meta;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(serializedMeta ? { meta: serializedMeta } : {}),
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  console.log(serialized);
};

export const logger = {
  error: (message: string, meta?: unknown): void => write('error', message, meta),
  warn: (message: string, meta?: unknown): void => write('warn', message, meta),
  info: (message: string, meta?: unknown): void => write('info', message, meta),
  http: (message: string, meta?: unknown): void => write('http', message, meta),
  debug: (message: string, meta?: unknown): void => write('debug', message, meta),
};
