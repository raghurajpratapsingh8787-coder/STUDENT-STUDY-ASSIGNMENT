import mongoose from 'mongoose';
import { env } from './env.ts';

let mongoConnected = false;

export function isMongoConnected(): boolean {
  return mongoConnected && mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<'mongodb' | 'local-store'> {
  if (!env.mongodbUri) {
    mongoConnected = false;
    console.info('[DB] MONGODB_URI not configured; using persistent local document store.');
    return 'local-store';
  }

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    mongoConnected = true;
    console.info('[DB] Connected to MongoDB via Mongoose.');
    return 'mongodb';
  } catch (err) {
    mongoConnected = false;
    console.warn(
      '[DB] Could not connect to MONGODB_URI, falling back to local document store:',
      err instanceof Error ? err.message : String(err)
    );
    return 'local-store';
  }
}
