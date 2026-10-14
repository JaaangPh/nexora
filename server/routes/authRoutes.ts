import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateUsername,
  updateProfileImage,
  getPayoutAccounts,
  savePayoutAccount,
  deletePayoutAccount,
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
router.put('/profile-image', authMiddleware, updateProfileImage);
router.get('/payout-accounts', authMiddleware, getPayoutAccounts);
router.post('/payout-accounts', authMiddleware, savePayoutAccount);
router.delete('/payout-accounts/:provider', authMiddleware, deletePayoutAccount);
router.post('/runners/purchase', authMiddleware, purchaseRunner);
router.put('/runners', authMiddleware, updateRunners);

export default router;
