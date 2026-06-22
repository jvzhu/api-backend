import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
