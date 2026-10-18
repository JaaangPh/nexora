import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  getMe,
  getPublicRunnerPrices,
  getPublicRunnerRules,
  getReferralStats,
  updateUsername,
  updateProfileImage,
  getPayoutAccounts,
  savePayoutAccount,
  deletePayoutAccount,
  updateRunners,
  repairRunner,
  purchaseRunner,
  getWorkoutSnapshot,
  saveWorkoutSnapshot,
  clearWorkoutSnapshot,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  beginWithdrawalTotpSetup,
  createWithdrawal,
  getWithdrawalHistory,
  getWithdrawalTotpStatus,
  verifyWithdrawalTotpSetup,
} from '../controllers/withdrawalController.js';

const router = Router();
const withdrawalSetupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authenticator setup attempts. Please wait and try again.' },
});
const withdrawalCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many withdrawal verification attempts. Please wait and try again.' },
});

// Public Authentication endpoints with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authMiddleware, logout);

// Protected endpoints
router.get('/me', authMiddleware, getMe);
router.get('/runner-prices', getPublicRunnerPrices);
router.get('/runner-rules', getPublicRunnerRules);
router.get('/referrals', authMiddleware, getReferralStats);
router.get('/workout', authMiddleware, getWorkoutSnapshot);
router.put('/workout', authMiddleware, saveWorkoutSnapshot);
router.delete('/workout', authMiddleware, clearWorkoutSnapshot);
router.put('/username', authMiddleware, updateUsername);
router.put('/profile-image', authMiddleware, updateProfileImage);
router.get('/payout-accounts', authMiddleware, getPayoutAccounts);
router.post('/payout-accounts', authMiddleware, savePayoutAccount);
router.delete('/payout-accounts/:provider', authMiddleware, deletePayoutAccount);
router.get('/withdrawals/totp', authMiddleware, getWithdrawalTotpStatus);
router.post('/withdrawals/totp/setup', authMiddleware, withdrawalSetupLimiter, beginWithdrawalTotpSetup);
router.post('/withdrawals/totp/verify', authMiddleware, withdrawalCodeLimiter, verifyWithdrawalTotpSetup);
router.post('/withdrawals', authMiddleware, withdrawalCodeLimiter, createWithdrawal);
router.get('/withdrawals', authMiddleware, getWithdrawalHistory);
router.post('/runners/purchase', authMiddleware, purchaseRunner);
router.put('/runners', authMiddleware, updateRunners);
router.post('/runners/repair', authMiddleware, repairRunner);

export default router;
