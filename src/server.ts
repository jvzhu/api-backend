import { app } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';

async function bootstrap(): Promise<void> {
  await connectDb();
  app.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap server', err);
  process.exit(1);
});
