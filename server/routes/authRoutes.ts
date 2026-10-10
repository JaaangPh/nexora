import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  validateInvite,
  getActiveInvites,
  createInviteCode,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { authLimiter, inviteLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public Authentication endpoints with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/validate-invite', inviteLimiter, validateInvite);

// Public helper to show seed invite codes for demo & QA verification
router.get('/invites', getActiveInvites);

// Protected endpoints
router.get('/me', authMiddleware, getMe);
router.post('/admin/invite-codes', authMiddleware, createInviteCode);

export default router;
