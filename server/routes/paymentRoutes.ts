import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createDeposit, getDepositStatus, handleTurboPayCallback } from '../controllers/paymentController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const multipartFields = multer({ limits: { fields: 20, fieldSize: 2048, parts: 20, fieldNameSize: 100 } }).none();
const depositLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many deposit requests. Please wait a minute and try again.' },
});

router.post('/callback', multipartFields, handleTurboPayCallback);
router.post('/deposits', authMiddleware, depositLimiter, createDeposit);
router.get('/deposits/:orderId', authMiddleware, getDepositStatus);

export default router;
