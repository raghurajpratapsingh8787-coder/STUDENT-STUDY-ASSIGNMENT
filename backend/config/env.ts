import crypto from 'crypto';

const runtimeJwtFallback = crypto.randomBytes(32).toString('hex');

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  jwtSecret: (process.env.JWT_SECRET || '').trim() || runtimeJwtFallback,
  adminPasscode: (process.env.ADMIN_PASSCODE || '').trim(),
  appUrl: (process.env.APP_URL || '').trim(),
};
