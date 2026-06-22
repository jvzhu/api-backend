import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';
import { clearCache } from '../../src/utils/cache';

let mongoServer: MongoMemoryServer;

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-12345';

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
  }

  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  clearCache();
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

export const app = createApp();
