import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateUsername,
  updateBalance,
  updateRunners,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public Authentication endpoints with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Protected endpoints
router.get('/me', authMiddleware, getMe);
router.put('/username', authMiddleware, updateUsername);
router.put('/balance', authMiddleware, updateBalance);
router.put('/runners', authMiddleware, updateRunners);

export default router;
