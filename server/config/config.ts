import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'nexora_super_secure_jwt_secret_key_2025_prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://localhost,capacitor://localhost').split(','),
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'server', 'database', 'nexora.sqlite'),
  cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
