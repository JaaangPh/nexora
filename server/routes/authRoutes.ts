import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateUsername,
  updateBalance,
  updateRunners,
  purchaseRunner,
  getWorkoutSnapshot,
  saveWorkoutSnapshot,
  clearWorkoutSnapshot,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public Authentication endpoints with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authMiddleware, logout);

// Protected endpoints
router.get('/me', authMiddleware, getMe);
router.get('/workout', authMiddleware, getWorkoutSnapshot);
router.put('/workout', authMiddleware, saveWorkoutSnapshot);
router.delete('/workout', authMiddleware, clearWorkoutSnapshot);
router.put('/username', authMiddleware, updateUsername);
router.put('/balance', authMiddleware, updateBalance);
router.post('/runners/purchase', authMiddleware, purchaseRunner);
router.put('/runners', authMiddleware, updateRunners);

export default router;
