import { createServer } from 'node:http';
import { connectDatabase } from './config/database';
import { getConfig } from './config/env';
import { logger } from './config/logger';
import { createApp } from './app';

const startServer = async (): Promise<void> => {
  await connectDatabase();
  const config = getConfig();
  const app = createApp();
  const server = createServer(app);

  server.listen(config.PORT, () => {
    logger.info(`Server listening on port ${config.PORT}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
