import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/config';
import { initFirebaseDatabase } from './database/firebase';
import authRoutes from './routes/authRoutes';

const app = express();

// Trust proxy for rate limiting behind reverse proxies/Capacitor
app.set('trust proxy', 1);

// CORS configuration supporting web and mobile Capacitor origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Capacitor)
      if (!origin) return callback(null, true);
      if (
        config.corsOrigins.includes(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Firebase Cloud Firestore Database & Seed initial records
initFirebaseDatabase().catch((err) => {
  console.error('[Firebase Init Error]', err);
});

// Health Check (support both /api/health and /health)
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'online',
    system: 'Nexora Technologies Authentication Engine',
    database: 'Firebase Cloud Firestore',
    projectId: 'nexora-d0290',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth Routes (support both /api/auth and /auth)
app.use(['/api/auth', '/auth'], authRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal system error occurred.',
  });
});

// Root API index
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    system: 'Nexora Technologies Authentication Engine',
    version: '1.0.0',
  });
});

// Start local HTTP server when running standalone (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Nexora Technologies Server running on port ${config.port}`);
    console.log(`🔥 Database: Firebase Cloud Firestore (Project: nexora-d0290)`);
    console.log(`🔒 Authentication API available at http://localhost:${config.port}/api/auth`);
    console.log(`💡 Health check at http://localhost:${config.port}/api/health`);
    console.log(`====================================================`);
  });
}

export default app;
