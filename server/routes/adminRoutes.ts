import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  beginAdminTotpSetup,
  changeAdminPassword,
  createAdminAccount,
  getAdminAccounts,
  getAdminAnnouncement,
  getAdminActiveWorkouts,
  getAdminTransactions,
  getAdminRunnerPrices,
  getAdminRunnerRules,
  getAdminUserProfile,
  reviewWithdrawal,
  startAdminLogin,
  updateAdminRunnerPrice,
  updateAdminAnnouncement,
  updateAdminRunnerRule,
  grantAdminRunner,
  verifyAdminTotp,
  adminSessionMiddleware,
} from '../controllers/adminController.js';

const router = Router();
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many administrator sign-in attempts. Please wait and try again.' },
});

router.post('/auth/login', adminAuthLimiter, startAdminLogin);
router.post('/auth/totp/setup', adminAuthLimiter, beginAdminTotpSetup);
router.post('/auth/totp/verify', adminAuthLimiter, verifyAdminTotp);
router.get('/transactions', adminSessionMiddleware, getAdminTransactions);
router.get('/runner-prices', adminSessionMiddleware, getAdminRunnerPrices);
router.put('/runner-prices', adminSessionMiddleware, updateAdminRunnerPrice);
router.get('/runner-rules', adminSessionMiddleware, getAdminRunnerRules);
router.put('/runner-rules', adminSessionMiddleware, updateAdminRunnerRule);
router.post('/runners/grant', adminSessionMiddleware, grantAdminRunner);
router.get('/active-workouts', adminSessionMiddleware, getAdminActiveWorkouts);
router.get('/announcement', adminSessionMiddleware, getAdminAnnouncement);
router.put('/announcement', adminSessionMiddleware, updateAdminAnnouncement);
router.get('/users/:userId', adminSessionMiddleware, getAdminUserProfile);
router.put('/withdrawals/:orderId/review', adminSessionMiddleware, reviewWithdrawal);
router.put('/auth/password', adminAuthLimiter, adminSessionMiddleware, changeAdminPassword);
router.get('/accounts', adminSessionMiddleware, getAdminAccounts);
router.post('/accounts', adminAuthLimiter, adminSessionMiddleware, createAdminAccount);

export default router;
