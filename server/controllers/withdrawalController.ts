import { Response } from 'express';
import crypto from 'node:crypto';
import { toDataURL } from 'qrcode';
import { config } from '../config/config.js';
import { firestore } from '../database/firebase.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  findValidTotpCounter,
  generateTotpSecret,
  TOTP_PERIOD_SECONDS,
} from '../services/totp.js';
import {
  amountToCents,
  calculateWithdrawalAmounts,
  MINIMUM_PAYOUT_CENTS,
} from '../services/withdrawalRules.js';

const TOTP_SETUP_EXPIRY_MS = 10 * 60 * 1000;
const PAYOUT_PROVIDERS = new Set(['gcash', 'maya', 'gotyme']);

function getAccountPayout(accounts: unknown, provider: string): {
  provider: string;
  accountNumber: string;
  accountHolder: string;
} | null {
  if (!Array.isArray(accounts)) return null;
  const account = accounts.find((item) =>
    item &&
    typeof item === 'object' &&
    (item as Record<string, unknown>).provider === provider &&
    typeof (item as Record<string, unknown>).accountNumber === 'string' &&
    typeof (item as Record<string, unknown>).accountHolder === 'string'
  ) as Record<string, string> | undefined;
  if (!account) return null;
  return {
    provider,
    accountNumber: account.accountNumber,
    accountHolder: account.accountHolder,
  };
}

export async function getWithdrawalTotpStatus(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }
  try {
    const snapshot = await firestore.collection('users').doc(req.user.id).get();
    if (!snapshot.exists) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    res.json({ success: true, configured: typeof snapshot.data()?.withdrawalTotpSecret === 'string' });
  } catch (error) {
    console.error('[Withdrawal Authenticator Status Error]', error);
    res.status(500).json({ success: false, message: 'Could not check authenticator setup.' });
  }
}

export async function beginWithdrawalTotpSetup(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }

  try {
    const userRef = firestore.collection('users').doc(req.user.id);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (typeof userSnapshot.data()?.withdrawalTotpSecret === 'string') {
      res.status(409).json({ success: false, message: 'Withdrawal authenticator is already connected.' });
      return;
    }

    const user = userSnapshot.data()!;
    const pendingSecretIsValid =
      typeof user.pendingWithdrawalTotpSecret === 'string' &&
      typeof user.pendingWithdrawalTotpExpiresAt === 'number' &&
      user.pendingWithdrawalTotpExpiresAt > Date.now();
    const secret = pendingSecretIsValid
      ? decryptTotpSecret(user.pendingWithdrawalTotpSecret, config.jwtSecret)
      : generateTotpSecret();
    if (!pendingSecretIsValid) {
      await userRef.update({
        pendingWithdrawalTotpSecret: encryptTotpSecret(secret, config.jwtSecret),
        pendingWithdrawalTotpExpiresAt: Date.now() + TOTP_SETUP_EXPIRY_MS,
      });
    }

    const accountLabel = encodeURIComponent(`Stepora:${req.user.phoneNumber}`);
    const issuer = encodeURIComponent('Stepora');
    const uri = `otpauth://totp/${accountLabel}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
    const qrCodeDataUrl = await toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
    res.json({ success: true, qrCodeDataUrl, manualEntryKey: secret });
  } catch (error) {
    console.error('[Withdrawal Authenticator Setup Error]', error);
    res.status(500).json({ success: false, message: 'Could not create authenticator setup. Please try again.' });
  }
}

export async function verifyWithdrawalTotpSetup(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }

  try {
    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection('users').doc(req.user!.id);
      const snapshot = await transaction.get(userRef);
      const user = snapshot.data();
      if (!snapshot.exists || !user) throw new Error('ACCOUNT_NOT_FOUND');
      if (typeof user.withdrawalTotpSecret === 'string') throw new Error('TOTP_ALREADY_CONFIGURED');
      if (
        typeof user.pendingWithdrawalTotpSecret !== 'string' ||
        typeof user.pendingWithdrawalTotpExpiresAt !== 'number' ||
        user.pendingWithdrawalTotpExpiresAt < Date.now()
      ) throw new Error('TOTP_SETUP_EXPIRED');

      const secret = decryptTotpSecret(user.pendingWithdrawalTotpSecret, config.jwtSecret);
      const counter = findValidTotpCounter(secret, req.body?.code);
      if (counter === null) throw new Error('TOTP_CODE_INVALID');

      transaction.update(userRef, {
        withdrawalTotpSecret: user.pendingWithdrawalTotpSecret,
        withdrawalTotpLastUsedCounter: counter,
        pendingWithdrawalTotpSecret: null,
        pendingWithdrawalTotpExpiresAt: null,
      });
    });
    res.json({ success: true, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (message === 'TOTP_ALREADY_CONFIGURED') {
      res.status(409).json({ success: false, message: 'Withdrawal authenticator is already connected.' });
      return;
    }
    if (message === 'TOTP_SETUP_EXPIRED') {
      res.status(410).json({ success: false, message: 'Authenticator setup expired. Generate a new QR code.' });
      return;
    }
    if (message === 'TOTP_CODE_INVALID') {
      res.status(400).json({ success: false, message: 'That authenticator code is not valid.' });
      return;
    }
    console.error('[Withdrawal Authenticator Verify Error]', error);
    res.status(500).json({ success: false, message: 'Could not verify authenticator setup.' });
  }
}

export async function createWithdrawal(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }

  const payoutAmountCents = amountToCents(req.body?.amount);
  const provider = req.body?.provider;
  const code = req.body?.code;
  const amounts = payoutAmountCents === null
    ? null
    : calculateWithdrawalAmounts(payoutAmountCents);
  if (
    payoutAmountCents === null ||
    payoutAmountCents < MINIMUM_PAYOUT_CENTS ||
    !amounts ||
    typeof provider !== 'string' ||
    !PAYOUT_PROVIDERS.has(provider) ||
    typeof code !== 'string' ||
    !/^\d{6}$/.test(code)
  ) {
    res.status(400).json({ success: false, message: 'Enter a payout amount of at least ₱100, choose a payout account, and enter a six-digit authenticator code.' });
    return;
  }

  const { feeCents, totalDeductedCents } = amounts;
  const orderId = `WD-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const userRef = firestore.collection('users').doc(req.user.id);
  const withdrawalRef = firestore.collection('payment_withdrawals').doc(orderId);

  try {
    const withdrawal = await firestore.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const user = userSnapshot.data();
      if (!userSnapshot.exists || !user) throw new Error('ACCOUNT_NOT_FOUND');

      if (typeof user.withdrawalTotpSecret !== 'string') throw new Error('TOTP_SETUP_REQUIRED');
      const secret = decryptTotpSecret(user.withdrawalTotpSecret, config.jwtSecret);
      const counter = findValidTotpCounter(secret, code, Number(user.withdrawalTotpLastUsedCounter ?? -1));
      if (counter === null) throw new Error('TOTP_CODE_INVALID');

      const payoutAccount = getAccountPayout(user.payoutAccounts, provider);
      if (!payoutAccount) throw new Error('PAYOUT_ACCOUNT_NOT_FOUND');

      const currentBalance = Number(user.balance ?? 0);
      const balanceCents = Math.round(currentBalance * 100);
      if (!Number.isFinite(currentBalance) || !Number.isSafeInteger(balanceCents)) {
        throw new Error('INVALID_BALANCE');
      }
      if (balanceCents < totalDeductedCents) throw new Error('INSUFFICIENT_BALANCE');

      const nextBalance = (balanceCents - totalDeductedCents) / 100;
      const record = {
        orderId,
        userId: req.user!.id,
        status: 'pending',
        amount: payoutAmountCents / 100,
        amountCents: payoutAmountCents,
        fee: feeCents / 100,
        feeCents,
        totalDeducted: totalDeductedCents / 100,
        totalDeductedCents,
        payoutAmount: payoutAmountCents / 100,
        payoutAmountCents,
        bankCode: payoutAccount.provider,
        accountHolder: payoutAccount.accountHolder,
        accountNumber: payoutAccount.accountNumber,
        createdAt: now,
        updatedAt: now,
      };

      transaction.update(userRef, {
        balance: nextBalance,
        withdrawalTotpLastUsedCounter: counter,
      });
      transaction.create(withdrawalRef, record);
      return { ...record, balance: nextBalance };
    });
    res.status(201).json({ success: true, withdrawal });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (message === 'TOTP_SETUP_REQUIRED') {
      res.status(409).json({ success: false, message: 'Connect Google Authenticator before withdrawing.' });
      return;
    }
    if (message === 'TOTP_CODE_INVALID') {
      res.status(400).json({ success: false, message: 'Enter a valid, unused authenticator code.' });
      return;
    }
    if (message === 'PAYOUT_ACCOUNT_NOT_FOUND') {
      res.status(400).json({ success: false, message: 'That payout account is no longer saved. Choose another account.' });
      return;
    }
    if (message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ success: false, message: 'Your balance is not enough to cover this withdrawal amount.' });
      return;
    }
    if (message === 'INVALID_BALANCE') {
      res.status(409).json({ success: false, message: 'The account balance is invalid. Contact support.' });
      return;
    }
    console.error('[Withdrawal Create Error]', error);
    res.status(500).json({ success: false, message: 'Could not submit withdrawal request.' });
  }
}

export async function getWithdrawalHistory(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }
  try {
    const snapshot = await firestore.collection('payment_withdrawals')
      .where('userId', '==', req.user.id)
      .get();
    const withdrawals = snapshot.docs.map((document) => {
      const record = document.data();
      return {
        orderId: String(record.orderId || document.id),
        status: typeof record.status === 'string' ? record.status : 'pending',
        amount: Number(record.payoutAmount ?? record.amount ?? 0),
        fee: Number(record.fee ?? 0),
        payoutAmount: Number(record.payoutAmount ?? record.amount ?? 0),
        totalDeducted: Number(record.totalDeducted ?? record.amount ?? 0),
        bankCode: typeof record.bankCode === 'string' ? record.bankCode : '',
        accountHolder: typeof record.accountHolder === 'string' ? record.accountHolder : '',
        accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : '',
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
        reviewedAt: typeof record.reviewedAt === 'string' ? record.reviewedAt : undefined,
      };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('[Withdrawal History Error]', error);
    res.status(500).json({ success: false, message: 'Could not retrieve withdrawal history.' });
  }
}
