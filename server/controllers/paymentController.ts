import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthRequest } from '../middleware/auth.js';
import { firestore } from '../database/firebase.js';
import {
  createTurboPaySignature,
  createTurboPayTransfer,
  getTurboPayCredentials,
  getTurboPayConfig,
  TurboPayTransferRejectedError,
  TurboPayPayload,
  verifyTurboPaySignature,
} from '../services/turbopay.js';

type DepositBankCode = 'gcash' | 'PMP' | 'GOT' | 'qrph' | 'usdt-trc20';
type DepositStatus = 'pending' | 'paid' | 'failed';

const DEPOSIT_BANK_CODES = new Set<DepositBankCode>(['gcash', 'PMP', 'GOT', 'qrph', 'usdt-trc20']);
const DEPOSITS_COLLECTION = 'payment_deposits';

function toCents(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) return null;
  return cents;
}

function toSafeGatewayPayload(value: unknown): TurboPayPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload: TurboPayPayload = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field !== 'string' && typeof field !== 'number') return null;
    payload[key] = field;
  }
  return payload;
}

function readOptionalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function createDeposit(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }

  const amountCents = toCents(req.body?.amount);
  const bankCode = req.body?.bankCode;
  if (
    amountCents === null ||
    typeof bankCode !== 'string' ||
    !DEPOSIT_BANK_CODES.has(bankCode as DepositBankCode)
  ) {
    res.status(400).json({ success: false, message: 'Enter a valid amount and payment method.' });
    return;
  }
  if (amountCents < 10_000) {
    res.status(400).json({ success: false, message: 'The minimum deposit is ₱100.' });
    return;
  }
  if (bankCode === 'usdt-trc20' && amountCents < 80_000) {
    res.status(400).json({ success: false, message: 'USDT-TRC20 deposits must be at least ₱800.' });
    return;
  }

  let config;
  try {
    config = getTurboPayConfig();
  } catch (error) {
    console.error('[TurboPay Config Error]', error);
    res.status(503).json({ success: false, message: 'Deposits are not configured yet.' });
    return;
  }

  const amount = amountCents / 100;
  const orderId = `NX-${randomUUID()}`;
  const depositRef = firestore.collection(DEPOSITS_COLLECTION).doc(orderId);
  const now = new Date().toISOString();

  try {
    await depositRef.create({
      orderId,
      userId,
      amount,
      amountCents,
      bankCode,
      status: 'pending' satisfies DepositStatus,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[TurboPay Deposit Create Error]', error);
    res.status(500).json({ success: false, message: 'Could not start the deposit. Please try again.' });
    return;
  }

  const requestPayload: TurboPayPayload = {
    merchant: config.merchantId,
    payment_type: '1',
    amount,
    order_id: orderId,
    bank_code: bankCode === 'qrph' ? 'gcash' : bankCode,
    callback_url: config.callbackUrl,
    return_url: config.returnUrl,
  };
  requestPayload.sign = createTurboPaySignature(requestPayload, config.merchantKey);

  let gatewayResponse: Record<string, unknown>;
  try {
    gatewayResponse = await createTurboPayTransfer(config.apiUrl, requestPayload);
  } catch (error) {
    console.error('[TurboPay Transfer Error]', error);
    if (error instanceof TurboPayTransferRejectedError) {
      await firestore.runTransaction(async (transaction) => {
        const currentDeposit = await transaction.get(depositRef);
        if (currentDeposit.exists && currentDeposit.data()?.status === 'pending') {
          transaction.update(depositRef, { status: 'failed', updatedAt: new Date().toISOString() });
        }
      }).catch((updateError) => {
        console.error('[TurboPay Deposit Failure Update Error]', updateError);
      });
      res.status(502).json({ success: false, message: 'The payment provider rejected the deposit request.' });
      return;
    }

    res.status(201).json({
      success: true,
      deposit: {
        orderId,
        status: 'pending',
        amount,
        bankCode,
        message: 'Provider response was interrupted. Check this order status before starting another deposit.',
      },
    });
    return;
  }

  const redirectUrl = readOptionalUrl(gatewayResponse.redirect_url);
  const qrcodeUrl = readOptionalUrl(gatewayResponse.qrcode_url);
  const gcashQrUrl = readOptionalUrl(gatewayResponse.gcash_qr_url);

  await depositRef.update({
    redirectUrl: redirectUrl ?? null,
    qrcodeUrl: qrcodeUrl ?? null,
    gcashQrUrl: gcashQrUrl ?? null,
    providerMessage: typeof gatewayResponse.message === 'string' ? gatewayResponse.message : null,
    updatedAt: new Date().toISOString(),
  }).catch((error) => {
    console.error('[TurboPay Deposit Details Save Error]', error);
  });

  res.status(201).json({
    success: true,
    deposit: { orderId, status: 'pending', amount, bankCode, redirectUrl, qrcodeUrl, gcashQrUrl },
  });
}

export async function getDepositStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }
  const orderId = req.params.orderId;
  if (typeof orderId !== 'string') {
    res.status(404).json({ success: false, message: 'Deposit was not found.' });
    return;
  }

  try {
    const depositSnapshot = await firestore.collection(DEPOSITS_COLLECTION).doc(orderId).get();
    if (!depositSnapshot.exists) {
      res.status(404).json({ success: false, message: 'Deposit was not found.' });
      return;
    }

    const deposit = depositSnapshot.data()!;
    if (deposit.userId !== userId) {
      res.status(404).json({ success: false, message: 'Deposit was not found.' });
      return;
    }

    const userSnapshot = await firestore.collection('users').doc(userId).get();
    const user = userSnapshot.data();
    res.json({
      orderId: deposit.orderId,
      status: deposit.status,
      amount: deposit.amount,
      bankCode: deposit.bankCode,
      redirectUrl: deposit.redirectUrl || undefined,
      qrcodeUrl: deposit.qrcodeUrl || undefined,
      gcashQrUrl: deposit.gcashQrUrl || undefined,
      user: user
        ? { balance: Number(user.balance ?? 0), totalDeposit: Number(user.totalDeposit ?? 0) }
        : undefined,
    });
  } catch (error) {
    console.error('[TurboPay Deposit Status Error]', error);
    res.status(500).json({ success: false, message: 'Could not retrieve the deposit status.' });
  }
}

export async function getDepositHistory(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized session.' });
    return;
  }

  try {
    const depositsSnapshot = await firestore
      .collection(DEPOSITS_COLLECTION)
      .where('userId', '==', userId)
      .get();
    const deposits = depositsSnapshot.docs
      .map((document) => {
        const deposit = document.data();
        return {
          orderId: String(deposit.orderId || document.id),
          status: deposit.status as DepositStatus,
          amount: Number(deposit.amount),
          bankCode: deposit.bankCode as DepositBankCode,
          createdAt: typeof deposit.createdAt === 'string' ? deposit.createdAt : '',
          redirectUrl: readOptionalUrl(deposit.redirectUrl),
          qrcodeUrl: readOptionalUrl(deposit.qrcodeUrl),
          gcashQrUrl: readOptionalUrl(deposit.gcashQrUrl),
        };
      })
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

    res.json({ success: true, deposits });
  } catch (error) {
    console.error('[TurboPay Deposit History Error]', error);
    res.status(500).json({ success: false, message: 'Could not retrieve transaction history.' });
  }
}

export async function handleTurboPayCallback(req: Request, res: Response): Promise<void> {
  let credentials;
  try {
    credentials = getTurboPayCredentials();
  } catch (error) {
    console.error('[TurboPay Callback Config Error]', error);
    res.status(503).json({ success: false, message: 'Payment callback is not configured.' });
    return;
  }

  const payload = toSafeGatewayPayload(req.body);
  if (!payload || !verifyTurboPaySignature(payload, credentials.merchantKey)) {
    res.status(401).json({ success: false, message: 'Invalid payment callback signature.' });
    return;
  }

  if (String(payload.merchant) !== credentials.merchantId) {
    res.status(401).json({ success: false, message: 'Payment callback merchant does not match.' });
    return;
  }

  const orderId = payload.order_id;
  const callbackStatus = String(payload.status);
  const callbackAmountCents = toCents(payload.amount);
  if (typeof orderId !== 'string' || !orderId || callbackAmountCents === null || !['3', '5'].includes(callbackStatus)) {
    res.status(400).json({ success: false, message: 'Payment callback fields are invalid.' });
    return;
  }

  try {
    const depositRef = firestore.collection(DEPOSITS_COLLECTION).doc(orderId);
    await firestore.runTransaction(async (transaction) => {
      const depositSnapshot = await transaction.get(depositRef);
      if (!depositSnapshot.exists) throw new Error('DEPOSIT_NOT_FOUND');

      const deposit = depositSnapshot.data()!;
      if (deposit.amountCents !== callbackAmountCents) throw new Error('DEPOSIT_AMOUNT_MISMATCH');
      if (deposit.status === 'paid' || deposit.status === 'failed') return;

      const callbackData = {
        callbackMessage: typeof payload.message === 'string' ? payload.message : '',
        callbackReceivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (callbackStatus === '3') {
        transaction.update(depositRef, { ...callbackData, status: 'failed' });
        return;
      }

      const userRef = firestore.collection('users').doc(String(deposit.userId));
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) throw new Error('DEPOSIT_USER_NOT_FOUND');

      transaction.update(depositRef, { ...callbackData, status: 'paid', paidAt: new Date().toISOString() });
      transaction.update(userRef, {
        balance: FieldValue.increment(Number(deposit.amount)),
        totalDeposit: FieldValue.increment(Number(deposit.amount)),
      });
    });

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'DEPOSIT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Deposit order was not found.' });
      return;
    }
    if (error instanceof Error && error.message === 'DEPOSIT_AMOUNT_MISMATCH') {
      res.status(409).json({ success: false, message: 'Callback amount does not match the deposit order.' });
      return;
    }
    console.error('[TurboPay Callback Processing Error]', error);
    res.status(500).json({ success: false, message: 'Could not process the payment callback.' });
  }
}
