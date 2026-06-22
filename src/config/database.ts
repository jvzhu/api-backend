import mongoose from 'mongoose';
import { getConfig } from './env';
import { logger } from './logger';

export const connectDatabase = async (): Promise<void> => {
  const { MONGODB_URI } = getConfig();
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB');
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};
