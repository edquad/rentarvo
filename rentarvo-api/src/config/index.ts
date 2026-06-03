import dotenv from 'dotenv';
import { existsSync } from 'fs';

const envPath = existsSync('../../.env') ? '../../.env' : '.env';
dotenv.config({ path: envPath });

export const config = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-replace-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
    localDir: process.env.UPLOAD_DIR || './uploads',
    maxMb: parseInt(process.env.MAX_UPLOAD_MB || '25', 10),
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      prefix: process.env.S3_PREFIX || 'rentarvo',
    },
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
};
