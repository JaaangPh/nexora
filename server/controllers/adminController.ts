import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { FieldValue } from 'firebase-admin/firestore';
import { toDataURL } from 'qrcode';
import { AdminSecurityRecord, firestore } from '../database/firebase.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  decryptTotpSecret as decryptSecret,
  encryptTotpSecret as encryptSecret,
  findValidTotpCounter,
  generateTotpSecret,
  TOTP_PERIOD_SECONDS,
} from '../services/totp.js';
import { displayedNexoraId } from '../services/marathonRules.js';
import { getRunnerPrices, readRunnerPricing, RUNNER_BASE_PRICES, saveRunnerPricing } from '../services/runnerPricing.js';
import {
  createTurboPayPayout,
  createTurboPaySignature,
  getTurboPayPayoutConfig,
  TurboPayPayoutRejectedError,
  TurboPayPayload,
} from '../services/turbopay.js';

type AdminRole = 'admin' | 'staff';
interface AdminAccount extends AdminSecurityRecord {
  email: string;
  role: AdminRole;
  passwordHash: string;
  status: 'active' | 'disabled';
  createdAt: string;
}
interface AdminRequest extends AuthRequest {
  adminEmail?: string;
  adminRole?: AdminRole;
  adminAccountId?: string;
}

const ADMIN_SECURITY_PATH = 'admin_security/main';
const ADMIN_BOOTSTRAP_PATH = 'admin_security/bootstrap';
const ADMIN_ACCOUNTS_COLLECTION = 'admin_accounts';
const ADMIN_ISSUER = 'Stepora';

function getAdminAuthSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_AUTH_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getAccountId(email: string): string {
  return crypto.createHash('sha256').update(email).digest('hex');
}

function getAccountRef(email: string) {
  return firestore.collection(ADMIN_ACCOUNTS_COLLECTION).doc(getAccountId(email));
}

function readBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}

function verifyAdminStage(req: Request, res: Response): { email: string; role: AdminRole } | null {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Administrator sign-in must be restarted.' });
    return null;
  }
  try {
    const claims = jwt.verify(token, getAdminAuthSecret()) as jwt.JwtPayload;
    if (
      claims.purpose !== 'admin-2fa' ||
      typeof claims.email !== 'string' ||
      typeof claims.role !== 'string' ||
      !['admin', 'staff'].includes(claims.role)
    ) {
      res.status(401).json({ success: false, message: 'Administrator sign-in must be restarted.' });
      return null;
    }
    return { email: claims.email, role: claims.role as AdminRole };
  } catch {
    if (!process.env.ADMIN_AUTH_SECRET || process.env.ADMIN_AUTH_SECRET.length < 32) {
      res.status(503).json({ success: false, message: 'Admin sign-in is unavailable. Configure ADMIN_AUTH_SECRET on the server.' });
      return null;
    }
    res.status(401).json({ success: false, message: 'Administrator sign-in has expired. Please sign in again.' });
    return null;
  }
}

export async function adminSessionMiddleware(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Administrator session required.' });
    return;
  }
  try {
    const claims = jwt.verify(token, getAdminAuthSecret()) as jwt.JwtPayload;
    const email = normalizeEmail(claims.email);
    const role = claims.role;
    if (claims.purpose !== 'admin-session' || !email || !['admin', 'staff'].includes(String(role))) {
      res.status(403).json({ success: false, message: 'Administrator access is required.' });
      return;
    }

    const accountSnapshot = await getAccountRef(email).get();
    const account = accountSnapshot.data() as AdminAccount | undefined;
    if (!account || account.status !== 'active' || account.role !== role) {
      res.status(401).json({ success: false, message: 'This administrator account is no longer active. Sign in again.' });
      return;
    }
    req.adminEmail = email;
    req.adminRole = account.role;
    req.adminAccountId = accountSnapshot.id;
    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('ADMIN_AUTH_SECRET')) {
      res.status(503).json({ success: false, message: 'Admin access is unavailable. Configure ADMIN_AUTH_SECRET on the server.' });
      return;
    }
    res.status(401).json({ success: false, message: 'Administrator session is invalid or expired.' });
  }
}

export async function startAdminLogin(req: Request, res: Response): Promise<void> {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!process.env.ADMIN_AUTH_SECRET || process.env.ADMIN_AUTH_SECRET.length < 32) {
    res.status(503).json({ success: false, message: 'Admin sign-in is unavailable. Configure ADMIN_AUTH_SECRET on the server.' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    res.status(400).json({ success: false, message: 'Enter a valid administrator email and password.' });
    return;
  }

  try {
    const accountSnapshot = await getAccountRef(email).get();
    const account = accountSnapshot.data() as AdminAccount | undefined;
    let role: AdminRole;
    let passwordMatches = false;
    const isBootstrapAccount = email === configuredEmail && !account?.passwordHash;
    if (account && !isBootstrapAccount) {
      role = account.role;
      passwordMatches = account.status === 'active' && await bcrypt.compare(password, account.passwordHash);
    } else if (email === configuredEmail && configuredPassword) {
      const bootstrap = await firestore.doc(ADMIN_BOOTSTRAP_PATH).get();
      if (bootstrap.data()?.initialized !== true) {
        const expected = crypto.createHash('sha256').update(configuredPassword).digest();
        const provided = crypto.createHash('sha256').update(password).digest();
        passwordMatches = crypto.timingSafeEqual(expected, provided);
      }
      role = 'admin';
    } else {
      role = 'staff';
    }

    if (!passwordMatches) {
      res.status(401).json({ success: false, message: 'Invalid administrator email or password.' });
      return;
    }

    const legacySecurity = email === configuredEmail
      ? await firestore.doc(ADMIN_SECURITY_PATH).get()
      : null;
    const hasTotp = Boolean(account?.encryptedTotpSecret || legacySecurity?.data()?.encryptedTotpSecret);
    const stageToken = jwt.sign(
      { role, purpose: 'admin-2fa', email },
      getAdminAuthSecret(),
      { expiresIn: '5m' }
    );
    res.json({ success: true, stageToken, needsSetup: !hasTotp });
  } catch (error) {
    console.error('[Admin Login Error]', error);
    res.status(503).json({ success: false, message: 'Could not verify administrator credentials or security settings.' });
  }
}

export async function beginAdminTotpSetup(req: Request, res: Response): Promise<void> {
  const identity = verifyAdminStage(req, res);
  if (!identity) return;
  const accountRef = getAccountRef(identity.email);
  try {
    const [accountSnapshot, legacySnapshot] = await Promise.all([
      accountRef.get(),
      identity.email === normalizeEmail(process.env.ADMIN_EMAIL) ? firestore.doc(ADMIN_SECURITY_PATH).get() : null,
    ]);
    if (accountSnapshot.data()?.encryptedTotpSecret || legacySnapshot?.data()?.encryptedTotpSecret) {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already configured.' });
      return;
    }

    const secret = generateTotpSecret();
    await accountRef.set({
      pendingEncryptedTotpSecret: encryptSecret(secret, getAdminAuthSecret()),
      pendingTotpExpiresAt: Date.now() + 5 * 60 * 1000,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    const accountLabel = encodeURIComponent(`${ADMIN_ISSUER}:${identity.email}`);
    const issuer = encodeURIComponent(ADMIN_ISSUER);
    const uri = `otpauth://totp/${accountLabel}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
    const qrCodeDataUrl = await toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
    res.json({ success: true, qrCodeDataUrl, manualEntryKey: secret });
  } catch (error) {
    console.error('[Admin TOTP Setup Error]', error);
    res.status(500).json({ success: false, message: 'Could not create the authenticator setup code.' });
  }
}

function getLegacySecurityRef(email: string) {
  return email === normalizeEmail(process.env.ADMIN_EMAIL) ? firestore.doc(ADMIN_SECURITY_PATH) : null;
}

export async function verifyAdminTotp(req: Request, res: Response): Promise<void> {
  const identity = verifyAdminStage(req, res);
  if (!identity) return;
  const accountRef = getAccountRef(identity.email);
  const legacyRef = getLegacySecurityRef(identity.email);
  const isSetup = req.body?.setup === true;
  try {
    await firestore.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      const legacySnapshot = legacyRef ? await transaction.get(legacyRef) : null;
      const account = (accountSnapshot.data() || {}) as AdminAccount;
      const legacy = (legacySnapshot?.data() || {}) as AdminSecurityRecord;

      if (isSetup) {
        if (account.encryptedTotpSecret || legacy.encryptedTotpSecret) throw new Error('TOTP_ALREADY_CONFIGURED');
        if (
          typeof account.pendingEncryptedTotpSecret !== 'string' ||
          typeof account.pendingTotpExpiresAt !== 'number' ||
          account.pendingTotpExpiresAt < Date.now()
        ) {
          throw new Error('TOTP_SETUP_EXPIRED');
        }
        const counter = findValidTotpCounter(
          decryptSecret(account.pendingEncryptedTotpSecret, getAdminAuthSecret()),
          req.body?.code,
        );
        if (counter === null) throw new Error('TOTP_CODE_INVALID');

        const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);
        const bootstrapPassword = process.env.ADMIN_PASSWORD;
        const bootstrapSnapshot = !account.passwordHash && identity.email === configuredEmail
          ? await transaction.get(firestore.doc(ADMIN_BOOTSTRAP_PATH))
          : null;
        if (!account.passwordHash && (!bootstrapPassword || bootstrapSnapshot?.data()?.initialized === true)) {
          throw new Error('ADMIN_ACCOUNT_NOT_FOUND');
        }
        const passwordHash = account.passwordHash || await bcrypt.hash(bootstrapPassword!, 12);
        transaction.set(accountRef, {
          ...account,
          email: identity.email,
          role: identity.role,
          passwordHash,
          status: 'active',
          createdAt: account.createdAt || new Date().toISOString(),
          encryptedTotpSecret: account.pendingEncryptedTotpSecret,
          pendingEncryptedTotpSecret: FieldValue.delete(),
          pendingTotpExpiresAt: FieldValue.delete(),
          lastUsedTotpCounter: counter,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        if (bootstrapSnapshot) {
          transaction.set(bootstrapSnapshot.ref, { initialized: true, updatedAt: new Date().toISOString() }, { merge: true });
        }
        return;
      }

      const secretRecord = account.encryptedTotpSecret ? account : legacy;
      if (typeof secretRecord.encryptedTotpSecret !== 'string') throw new Error('TOTP_SETUP_REQUIRED');
      const counter = findValidTotpCounter(
        decryptSecret(secretRecord.encryptedTotpSecret, getAdminAuthSecret()),
        req.body?.code,
        secretRecord.lastUsedTotpCounter,
      );
      if (counter === null) throw new Error('TOTP_CODE_INVALID');

      const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);
      const bootstrapPassword = process.env.ADMIN_PASSWORD;
      const bootstrapSnapshot = !account.passwordHash && identity.email === configuredEmail
        ? await transaction.get(firestore.doc(ADMIN_BOOTSTRAP_PATH))
        : null;
      if (!account.passwordHash && (!bootstrapPassword || bootstrapSnapshot?.data()?.initialized === true)) {
        throw new Error('ADMIN_ACCOUNT_NOT_FOUND');
      }
      const passwordHash = account.passwordHash || await bcrypt.hash(bootstrapPassword!, 12);
      transaction.set(accountRef, {
        ...account,
        email: identity.email,
        role: identity.role,
        passwordHash,
        status: 'active',
        createdAt: account.createdAt || new Date().toISOString(),
        encryptedTotpSecret: secretRecord.encryptedTotpSecret,
        lastUsedTotpCounter: counter,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      if (legacyRef && legacySnapshot?.exists && !account.encryptedTotpSecret) {
        transaction.update(legacyRef, { lastUsedTotpCounter: counter, updatedAt: new Date().toISOString() });
      }
      if (bootstrapSnapshot) {
        transaction.set(bootstrapSnapshot.ref, { initialized: true, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });

    const token = jwt.sign(
      {
        role: identity.role,
        purpose: 'admin-session',
        email: identity.email,
        accountId: getAccountId(identity.email),
      },
      getAdminAuthSecret(),
      { expiresIn: '8h', jwtid: crypto.randomUUID() }
    );
    res.json({ success: true, token, email: identity.email, role: identity.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TOTP_CODE_INVALID') {
      res.status(401).json({ success: false, message: 'That authenticator code is not valid or has already been used.' });
      return;
    }
    if (message === 'TOTP_SETUP_EXPIRED') {
      res.status(410).json({ success: false, message: 'Authenticator setup expired. Sign in again to restart setup.' });
      return;
    }
    if (message === 'TOTP_ALREADY_CONFIGURED') {
      res.status(409).json({ success: false, message: 'Two-factor authentication is already configured. Sign in again.' });
      return;
    }
    if (message === 'TOTP_SETUP_REQUIRED') {
      res.status(409).json({ success: false, message: 'Authenticator setup is required before signing in.' });
      return;
    }
    if (message === 'ADMIN_ACCOUNT_NOT_FOUND') {
      res.status(409).json({ success: false, message: 'Administrator setup is already claimed or credentials are no longer available. Contact an administrator.' });
      return;
    }
    console.error('[Admin TOTP Verification Error]', error);
    res.status(500).json({ success: false, message: 'Could not verify the authenticator code.' });
  }
}

async function verifyActionTotp(
  transaction: FirebaseFirestore.Transaction,
  accountRef: FirebaseFirestore.DocumentReference,
  code: unknown,
): Promise<number> {
  const accountSnapshot = await transaction.get(accountRef);
  const account = accountSnapshot.data() as AdminAccount | undefined;
  if (!accountSnapshot.exists || account?.status !== 'active' || typeof account.encryptedTotpSecret !== 'string') {
    throw new Error('ADMIN_TOTP_SETUP_REQUIRED');
  }
  const counter = findValidTotpCounter(
    decryptSecret(account.encryptedTotpSecret, getAdminAuthSecret()),
    code,
    account.lastUsedTotpCounter,
  );
  if (counter === null) throw new Error('ADMIN_TOTP_CODE_INVALID');
  return counter;
}

function sendActionError(res: Response, error: unknown, defaultMessage: string): void {
  const message = error instanceof Error ? error.message : '';
  if (message === 'ADMIN_TOTP_CODE_INVALID') {
    res.status(401).json({ success: false, message: 'Enter a fresh six-digit authenticator code.' });
    return;
  }
  if (message === 'ADMIN_TOTP_SETUP_REQUIRED') {
    res.status(409).json({ success: false, message: 'This admin account must complete authenticator setup first.' });
    return;
  }
  if (message === 'CURRENT_PASSWORD_INVALID') {
    res.status(401).json({ success: false, message: 'The current password is incorrect.' });
    return;
  }
  if (message === 'ADMIN_EMAIL_IN_USE') {
    res.status(409).json({ success: false, message: 'An admin account with this email already exists.' });
    return;
  }
  console.error(`[Admin Action Error] ${defaultMessage}`, error);
  res.status(500).json({ success: false, message: defaultMessage });
}

export async function changeAdminPassword(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can change admin account passwords.' });
    return;
  }
  const email = req.adminEmail;
  if (!email || !req.adminAccountId) {
    res.status(401).json({ success: false, message: 'Administrator session required.' });
    return;
  }
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const code = req.body?.code;
  if (newPassword.length < 12 || newPassword.length > 128) {
    res.status(400).json({ success: false, message: 'New password must be between 12 and 128 characters.' });
    return;
  }
  if (!currentPassword) {
    res.status(400).json({ success: false, message: 'Enter your current password.' });
    return;
  }

  const accountRef = getAccountRef(email);
  try {
    await firestore.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      const account = accountSnapshot.data() as AdminAccount | undefined;
      if (!accountSnapshot.exists || !account || !await bcrypt.compare(currentPassword, account.passwordHash)) {
        throw new Error('CURRENT_PASSWORD_INVALID');
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const counter = await verifyActionTotp(transaction, accountRef, code);
      transaction.update(accountRef, { passwordHash, lastUsedTotpCounter: counter, updatedAt: new Date().toISOString() });
    });
    res.json({ success: true, message: 'Password updated. Sign in again with your new password.' });
  } catch (error) {
    sendActionError(res, error, 'Could not update the administrator password.');
  }
}

export async function createAdminAccount(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin' || !req.adminEmail) {
    res.status(403).json({ success: false, message: 'Only administrators can create accounts.' });
    return;
  }
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role: AdminRole = req.body?.role === 'staff' ? 'staff' : 'admin';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }
  if (email.length > 254 || password.length < 12 || password.length > 128) {
    res.status(400).json({ success: false, message: 'Use a password between 12 and 128 characters.' });
    return;
  }

  const accountRef = getAccountRef(email);
  try {
    await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(accountRef);
      if (existing.exists) throw new Error('ADMIN_EMAIL_IN_USE');
      const actorRef = getAccountRef(req.adminEmail!);
      const counter = await verifyActionTotp(transaction, actorRef, req.body?.code);
      transaction.update(actorRef, { lastUsedTotpCounter: counter, updatedAt: new Date().toISOString() });
      transaction.create(accountRef, {
        email,
        role,
        passwordHash: await bcrypt.hash(password, 12),
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: req.adminEmail,
      });
    });
    res.status(201).json({ success: true, message: `${role === 'staff' ? 'Staff' : 'Admin'} account created. The new account must set up two-factor authentication at first sign-in.` });
  } catch (error) {
    sendActionError(res, error, 'Could not create the administrator account.');
  }
}

export async function getAdminAccounts(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can view the staff team.' });
    return;
  }

  try {
    const snapshot = await firestore.collection(ADMIN_ACCOUNTS_COLLECTION).get();
    const accounts = snapshot.docs
      .map((document) => {
        const account = document.data() as AdminAccount;
        return {
          email: account.email,
          role: account.role,
          status: account.status,
          createdAt: account.createdAt,
        };
      })
      .filter((account) =>
        typeof account.email === 'string' &&
        (account.role === 'admin' || account.role === 'staff') &&
        (account.status === 'active' || account.status === 'disabled')
      )
      .sort((left, right) => left.email.localeCompare(right.email));
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('[Admin Accounts Error]', error);
    res.status(500).json({ success: false, message: 'Could not load administrator and staff accounts.' });
  }
}

export async function getAdminRunnerPrices(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can manage runner prices.' });
    return;
  }
  try {
    const pricing = await readRunnerPricing();
    res.json({ success: true, prices: getRunnerPrices(pricing.discounts, pricing.originalPrices, pricing.newPrices) });
  } catch (error) {
    console.error('[Admin Runner Pricing Error]', error);
    res.status(500).json({ success: false, message: 'Could not load runner prices.' });
  }
}

export async function updateAdminRunnerPrice(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can manage runner prices.' });
    return;
  }

  const { runnerId, originalPrice, newPrice } = req.body ?? {};
  if (
    typeof runnerId !== 'string' ||
    !Object.prototype.hasOwnProperty.call(RUNNER_BASE_PRICES, runnerId) ||
    typeof originalPrice !== 'number' ||
    !Number.isFinite(originalPrice) ||
    originalPrice < 0.01 ||
    typeof newPrice !== 'number' ||
    !Number.isFinite(newPrice) ||
    newPrice < 0 ||
    newPrice > originalPrice
  ) {
    res.status(400).json({ success: false, message: 'Enter a valid runner price: the new price must be between ₱0 and the original price.' });
    return;
  }

  try {
    const pricing = await saveRunnerPricing(runnerId, originalPrice, newPrice);
    res.json({
      success: true,
      prices: getRunnerPrices(pricing.discounts, pricing.originalPrices, pricing.newPrices),
      message: 'Runner price updated successfully.',
    });
  } catch (error) {
    console.error('[Admin Runner Pricing Update Error]', error);
    res.status(500).json({ success: false, message: 'Could not update the runner price.' });
  }
}

function toIsoDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return '';
}

export async function getAdminUserProfile(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can view user profiles.' });
    return;
  }

  const searchId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  if (!searchId || searchId.length > 128) {
    res.status(400).json({ success: false, message: 'Enter a valid user ID.' });
    return;
  }

  try {
    let userSnapshot = await firestore.collection('users').doc(searchId).get();
    if (!userSnapshot.exists) {
      const referralMatches = await firestore.collection('users')
        .where('referralCode', '==', searchId)
        .limit(2)
        .get();
      if (referralMatches.size === 1) {
        userSnapshot = referralMatches.docs[0];
      } else if (referralMatches.size > 1) {
        res.status(409).json({ success: false, message: 'This ID matches multiple accounts. Search using the full account ID.' });
        return;
      } else if (/^\d{5}$/.test(searchId)) {
        const users = await firestore.collection('users').get();
        const publicIdMatches = users.docs.filter((document) => {
          const user = document.data();
          return displayedNexoraId(
            typeof user.referralCode === 'string' ? user.referralCode : undefined,
            document.id,
          ) === searchId;
        });
        if (publicIdMatches.length > 1) {
          res.status(409).json({ success: false, message: 'This Stepora ID matches multiple accounts. Search using the full account ID.' });
          return;
        }
        if (publicIdMatches.length === 1) userSnapshot = publicIdMatches[0];
      }
    }

    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, message: 'No user was found for that ID.' });
      return;
    }

    const user = userSnapshot.data();
    if (!user) {
      res.status(404).json({ success: false, message: 'No user was found for that ID.' });
      return;
    }

    const userId = userSnapshot.id;
    const [depositSnapshot, withdrawalSnapshot, workoutSnapshot] = await Promise.all([
      firestore.collection('payment_deposits').where('userId', '==', userId).get(),
      firestore.collection('payment_withdrawals').where('userId', '==', userId).get(),
      firestore.collection('completed_workouts').where('userId', '==', userId).get(),
    ]);
    const transactions = [
      ...depositSnapshot.docs.map((document) => ({ document, type: 'deposit' as const })),
      ...withdrawalSnapshot.docs.map((document) => ({ document, type: 'withdrawal' as const })),
    ].map(({ document, type }) => {
      const record = document.data();
      return {
        id: String(record.orderId || record.id || document.id),
        type,
        status: typeof record.status === 'string' ? record.status : 'unknown',
        amount: type === 'withdrawal'
          ? Number.isFinite(Number(record.payoutAmount)) ? Number(record.payoutAmount) : Number(record.amount) || 0
          : Number(record.amount) || 0,
        createdAt: toIsoDate(record.createdAt),
        method: typeof record.bankCode === 'string' ? record.bankCode : typeof record.method === 'string' ? record.method : '—',
      };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

    const ownedRunners = (Array.isArray(user.ownedRunners) ? user.ownedRunners : [])
      .flatMap((runner: unknown) => {
        if (typeof runner === 'string') {
          return [{ id: runner, runnerId: runner, serial: '', purchasedAt: 0 }];
        }
        if (!runner || typeof runner !== 'object') return [];
        const item = runner as Record<string, unknown>;
        if (typeof item.runnerId !== 'string') return [];
        return [{
          id: typeof item.id === 'string' ? item.id : item.runnerId,
          runnerId: item.runnerId,
          serial: typeof item.serial === 'string' ? item.serial : '',
          purchasedAt: Number.isFinite(Number(item.purchasedAt)) ? Number(item.purchasedAt) : 0,
        }];
      });

    const rawWorkout = user.workoutSnapshot && typeof user.workoutSnapshot === 'object'
      ? user.workoutSnapshot as Record<string, unknown>
      : null;
    const workoutActive = Boolean(
      rawWorkout &&
      (rawWorkout.isTracking === true || rawWorkout.isPaused === true || rawWorkout.pendingFinish === true)
    );
    const activeWorkout = workoutActive && rawWorkout ? {
      status: rawWorkout.pendingFinish === true
        ? 'Pending claim'
        : rawWorkout.isPaused === true ? 'Paused' : 'Active',
      isTracking: rawWorkout.isTracking === true,
      isPaused: rawWorkout.isPaused === true,
      pendingFinish: rawWorkout.pendingFinish === true,
      distanceKm: Number.isFinite(Number(rawWorkout.distanceKm)) ? Number(rawWorkout.distanceKm) : 0,
      elapsedSeconds: Number.isFinite(Number(rawWorkout.elapsedSeconds)) ? Number(rawWorkout.elapsedSeconds) : 0,
      tokensEarned: Number.isFinite(Number(rawWorkout.tokensEarned)) ? Number(rawWorkout.tokensEarned) : 0,
      lastUpdated: Number.isFinite(Number(rawWorkout.lastUpdated)) ? Number(rawWorkout.lastUpdated) : 0,
    } : null;

    const pastTracks = workoutSnapshot.docs.map((document) => {
      const workout = document.data();
      return {
        id: String(workout.id || document.id),
        startedAt: toIsoDate(workout.startedAt),
        completedAt: toIsoDate(workout.completedAt),
        distanceKm: Number.isFinite(Number(workout.verifiedMeters)) ? Number(workout.verifiedMeters) / 1000 : 0,
        earned: Number.isFinite(Number(workout.rewardCents)) ? Number(workout.rewardCents) / 100 : 0,
        claimed: workout.rewardVerified === true && Number(workout.rewardCents) > 0,
      };
    }).sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt));

    res.json({
      success: true,
      profile: {
        username: typeof user.username === 'string' ? user.username : 'Member',
        userId,
        steporaId: displayedNexoraId(
          typeof user.referralCode === 'string' ? user.referralCode : undefined,
          userId,
        ),
        status: typeof user.status === 'string' ? user.status : 'unknown',
        ownedRunners,
        transactions,
        activeWorkout,
        pastTracks,
      },
    });
  } catch (error) {
    console.error('[Admin User Profile Error]', error);
    res.status(500).json({ success: false, message: 'Could not load this user profile.' });
  }
}

export async function getAdminActiveWorkouts(req: AdminRequest, res: Response): Promise<void> {
  if (req.adminRole !== 'admin') {
    res.status(403).json({ success: false, message: 'Only administrators can view active workouts.' });
    return;
  }

  try {
    const [trackingUsers, pendingFinishUsers] = await Promise.all([
      firestore.collection('users').where('workoutSnapshot.isTracking', '==', true).get(),
      firestore.collection('users').where('workoutSnapshot.pendingFinish', '==', true).get(),
    ]);
    const users = new Map([
      ...trackingUsers.docs.map((document) => [document.id, document] as const),
      ...pendingFinishUsers.docs.map((document) => [document.id, document] as const),
    ]);

    const activeWorkouts = [...users.values()].flatMap((document) => {
      const user = document.data();
      const workout = user.workoutSnapshot;
      if (!workout || typeof workout !== 'object') return [];
      const snapshot = workout as Record<string, unknown>;
      if (snapshot.isTracking !== true && snapshot.isPaused !== true && snapshot.pendingFinish !== true) return [];

      return [{
        userId: document.id,
        username: typeof user.username === 'string' ? user.username : 'Member',
        steporaId: displayedNexoraId(
          typeof user.referralCode === 'string' ? user.referralCode : undefined,
          document.id,
        ),
        status: snapshot.pendingFinish === true
          ? 'Pending claim'
          : snapshot.isPaused === true ? 'Paused' : 'Active',
        isTracking: snapshot.isTracking === true,
        isPaused: snapshot.isPaused === true,
        pendingFinish: snapshot.pendingFinish === true,
        distanceKm: Number.isFinite(Number(snapshot.distanceKm)) ? Number(snapshot.distanceKm) : 0,
        elapsedSeconds: Number.isFinite(Number(snapshot.elapsedSeconds)) ? Number(snapshot.elapsedSeconds) : 0,
        tokensEarned: Number.isFinite(Number(snapshot.tokensEarned)) ? Number(snapshot.tokensEarned) : 0,
        lastUpdated: Number.isFinite(Number(snapshot.lastUpdated)) ? Number(snapshot.lastUpdated) : 0,
      }];
    }).sort((first, second) => second.lastUpdated - first.lastUpdated);

    res.json({ success: true, activeWorkouts });
  } catch (error) {
    console.error('[Admin Active Workouts Error]', error);
    res.status(500).json({ success: false, message: 'Could not load active workouts.' });
  }
}

export async function reviewWithdrawal(req: AdminRequest, res: Response): Promise<void> {
  const orderId = req.params.orderId;
  const decision = req.body?.decision;
  const rawReferenceNo = req.body?.referenceNo;
  if (
    rawReferenceNo !== undefined &&
    (typeof rawReferenceNo !== 'string' || rawReferenceNo.trim().length > 100)
  ) {
    res.status(400).json({ success: false, message: 'Reference number must be 100 characters or fewer.' });
    return;
  }
  const referenceNo = typeof rawReferenceNo === 'string' ? rawReferenceNo.trim() : '';
  if (typeof orderId !== 'string' || !orderId || !['accept', 'reject'].includes(decision)) {
    res.status(400).json({ success: false, message: 'Choose a valid withdrawal review action.' });
    return;
  }

  const withdrawalRef = firestore.collection('payment_withdrawals').doc(orderId);
  let payoutClaimed = false;
  try {
    if (decision === 'reject') {
      const reviewedWithdrawal = await firestore.runTransaction(async (transaction) => {
        const withdrawalSnapshot = await transaction.get(withdrawalRef);
        if (!withdrawalSnapshot.exists) throw new Error('WITHDRAWAL_NOT_FOUND');
        const withdrawal = withdrawalSnapshot.data()!;
        if (withdrawal.status !== 'pending') throw new Error('WITHDRAWAL_ALREADY_REVIEWED');

        const userRef = firestore.collection('users').doc(String(withdrawal.userId || ''));
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new Error('WITHDRAWAL_USER_NOT_FOUND');
        const amountCents = Number(withdrawal.totalDeductedCents ?? withdrawal.amountCents);
        const refundAmount = Number.isSafeInteger(amountCents) && amountCents > 0
          ? amountCents / 100
          : Number(withdrawal.amount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error('WITHDRAWAL_AMOUNT_INVALID');

        const reviewedAt = new Date().toISOString();
        transaction.update(withdrawalRef, {
          status: 'failed',
          reviewedAt,
          reviewedBy: req.adminEmail || 'admin',
          updatedAt: reviewedAt,
        });
        transaction.update(userRef, { balance: FieldValue.increment(refundAmount) });
        return { orderId, status: 'failed', refundAmount };
      });
      res.json({
        success: true,
        withdrawal: reviewedWithdrawal,
        message: `Withdrawal rejected and ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(reviewedWithdrawal.refundAmount)} refunded.`,
      });
      return;
    }

    const payoutConfig = getTurboPayPayoutConfig();
    const claimedWithdrawal = await firestore.runTransaction(async (transaction) => {
      const withdrawalSnapshot = await transaction.get(withdrawalRef);
      if (!withdrawalSnapshot.exists) throw new Error('WITHDRAWAL_NOT_FOUND');
      const withdrawal = withdrawalSnapshot.data()!;
      if (withdrawal.status !== 'pending') throw new Error('WITHDRAWAL_ALREADY_REVIEWED');

      const bankCode = withdrawal.bankCode === 'gcash'
        ? 'gcash'
        : withdrawal.bankCode === 'maya'
          ? 'PMP'
          : null;
      if (!bankCode) throw new Error('WITHDRAWAL_BANK_UNSUPPORTED');

      const payoutAmountCents = Number(withdrawal.payoutAmountCents ?? withdrawal.amountCents);
      if (!Number.isSafeInteger(payoutAmountCents) || payoutAmountCents <= 0) {
        throw new Error('WITHDRAWAL_AMOUNT_INVALID');
      }
      if (
        typeof withdrawal.accountHolder !== 'string' ||
        !withdrawal.accountHolder.trim() ||
        typeof withdrawal.accountNumber !== 'string' ||
        !withdrawal.accountNumber.trim()
      ) {
        throw new Error('WITHDRAWAL_ACCOUNT_INVALID');
      }

      const reviewedAt = new Date().toISOString();
      transaction.update(withdrawalRef, {
        status: 'processing',
        reviewedAt,
        reviewedBy: req.adminEmail || 'admin',
        ...(referenceNo ? { referenceNo } : {}),
        updatedAt: reviewedAt,
      });
      return {
        payoutAmount: (payoutAmountCents / 100).toFixed(2),
        bankCode,
        accountHolder: withdrawal.accountHolder.trim(),
        accountNumber: withdrawal.accountNumber.trim(),
      };
    });
    payoutClaimed = true;

    const payoutPayload: TurboPayPayload = {
      merchant: payoutConfig.merchantId,
      total_amount: claimedWithdrawal.payoutAmount,
      order_id: orderId,
      bank: claimedWithdrawal.bankCode,
      bank_card_name: claimedWithdrawal.accountHolder,
      bank_card_account: claimedWithdrawal.accountNumber,
      bank_card_remark: claimedWithdrawal.bankCode === 'gcash'
        ? claimedWithdrawal.accountNumber
        : 'no',
      callback_url: payoutConfig.callbackUrl,
    };
    payoutPayload.sign = createTurboPaySignature(payoutPayload, payoutConfig.merchantKey);

    const gatewayResponse = await createTurboPayPayout(payoutConfig.apiUrl, payoutPayload);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(withdrawalRef);
      if (snapshot.exists && snapshot.data()?.status === 'processing') {
        transaction.update(withdrawalRef, {
          providerSubmittedAt: new Date().toISOString(),
          providerMessage: typeof gatewayResponse.message === 'string' ? gatewayResponse.message : null,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    res.json({
      success: true,
      withdrawal: { orderId, status: 'processing' },
      message: 'Withdrawal submitted to TurboPay. It will show as successful after TurboPay confirms payment.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'WITHDRAWAL_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Withdrawal request was not found.' });
      return;
    }
    if (message === 'WITHDRAWAL_ALREADY_REVIEWED') {
      res.status(409).json({ success: false, message: 'This withdrawal has already been reviewed.' });
      return;
    }
    if (message === 'WITHDRAWAL_USER_NOT_FOUND') {
      res.status(409).json({ success: false, message: 'The member account was not found; withdrawal was not changed.' });
      return;
    }
    if (message === 'WITHDRAWAL_AMOUNT_INVALID') {
      res.status(409).json({ success: false, message: 'The stored withdrawal amount is invalid.' });
      return;
    }
    if (message === 'WITHDRAWAL_BANK_UNSUPPORTED') {
      res.status(400).json({ success: false, message: 'TurboPay does not support the payout bank saved for this withdrawal.' });
      return;
    }
    if (message === 'WITHDRAWAL_ACCOUNT_INVALID') {
      res.status(409).json({ success: false, message: 'The saved payout account is incomplete.' });
      return;
    }
    if (error instanceof TurboPayPayoutRejectedError) {
      try {
        await refundFailedTurboPayPayout(withdrawalRef);
      } catch (refundError) {
        console.error('[TurboPay Payout Rejection Refund Error]', refundError);
        res.status(500).json({ success: false, message: 'TurboPay rejected this payout, but the refund could not be completed. Contact support.' });
        return;
      }
      res.status(502).json({ success: false, message: 'TurboPay rejected the payout request; the withdrawal was marked failed and refunded.' });
      return;
    }

    if (payoutClaimed) {
      console.error('[TurboPay Payout Error]', error);
      res.status(502).json({
        success: false,
        message: 'TurboPay submission could not be confirmed. The withdrawal remains processing while its callback is awaited; do not submit it again.',
      });
      return;
    }
    if (
      error instanceof Error &&
      (error.message.includes('TurboPay') || error.message.includes('TURBOPAY'))
    ) {
      console.error('[TurboPay Payout Config Error]', error);
      res.status(503).json({ success: false, message: 'TurboPay payout is not configured. The withdrawal was not submitted.' });
      return;
    }

    console.error('[Admin Withdrawal Review Error]', error);
    res.status(500).json({ success: false, message: 'Could not review this withdrawal.' });
  }
}

async function refundFailedTurboPayPayout(
  withdrawalRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  await firestore.runTransaction(async (transaction) => {
    const withdrawalSnapshot = await transaction.get(withdrawalRef);
    if (!withdrawalSnapshot.exists || withdrawalSnapshot.data()?.status !== 'processing') return;

    const withdrawal = withdrawalSnapshot.data()!;
    const userRef = firestore.collection('users').doc(String(withdrawal.userId || ''));
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new Error('WITHDRAWAL_USER_NOT_FOUND');

    const amountCents = Number(withdrawal.totalDeductedCents ?? withdrawal.amountCents);
    const refundAmount = Number.isSafeInteger(amountCents) && amountCents > 0
      ? amountCents / 100
      : Number(withdrawal.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error('WITHDRAWAL_AMOUNT_INVALID');

    const failedAt = new Date().toISOString();
    transaction.update(withdrawalRef, {
      status: 'failed',
      providerFailureAt: failedAt,
      updatedAt: failedAt,
    });
    transaction.update(userRef, { balance: FieldValue.increment(refundAmount) });
  });
}

export async function getAdminTransactions(req: AdminRequest, res: Response): Promise<void> {
  try {
    const [depositSnapshot, withdrawalSnapshot, runnerPurchaseSnapshot] = await Promise.all([
      firestore.collection('payment_deposits').get(),
      firestore.collection('payment_withdrawals').get(),
      firestore.collection('wallet_transactions').where('type', '==', 'runner_purchase').get(),
    ]);

    const allRecords = [
      ...depositSnapshot.docs.map((document) => ({ document, type: 'deposit' as const })),
      ...withdrawalSnapshot.docs.map((document) => ({ document, type: 'withdrawal' as const })),
    ];
    const runnerPurchases = runnerPurchaseSnapshot.docs.map((document) => document.data());
    const userIds = [...new Set([
      ...allRecords.map(({ document }) => document.data().userId),
      ...runnerPurchases.map((record) => record.userId),
    ]
      .filter((id): id is string => typeof id === 'string'))];
    const userSnapshots = await Promise.all(userIds.map((id) => firestore.collection('users').doc(id).get()));
    const users = new Map(userSnapshots.map((snapshot) => {
      const user = snapshot.data();
      return [snapshot.id, {
        username: typeof user?.username === 'string' ? user.username : 'Member',
        phoneNumber: typeof user?.phoneNumber === 'string' ? user.phoneNumber : '',
        steporaId: displayedNexoraId(
          typeof user?.referralCode === 'string' ? user.referralCode : undefined,
          snapshot.id,
        ),
      }];
    }));

    const transactions = allRecords.map(({ document, type }) => {
      const record = document.data();
      const userId = typeof record.userId === 'string' ? record.userId : '';
      const user = users.get(userId);
      return {
        id: String(record.orderId || record.id || document.id),
        type,
        status: typeof record.status === 'string' ? record.status : 'unknown',
        amount: type === 'withdrawal'
          ? Number.isFinite(Number(record.payoutAmount))
            ? Number(record.payoutAmount)
            : Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0
          : Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0,
        method: typeof record.bankCode === 'string' ? record.bankCode : typeof record.method === 'string' ? record.method : '—',
        fee: Number.isFinite(Number(record.fee)) ? Number(record.fee) : 0,
        payoutAmount: Number.isFinite(Number(record.payoutAmount)) ? Number(record.payoutAmount) : undefined,
        totalDeducted: type === 'withdrawal'
          ? Number.isFinite(Number(record.totalDeducted))
            ? Number(record.totalDeducted)
            : Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0
          : undefined,
        accountHolder: typeof record.accountHolder === 'string' ? record.accountHolder : undefined,
        accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : undefined,
        referenceNo: typeof record.referenceNo === 'string' ? record.referenceNo : undefined,
        createdAt: toIsoDate(record.createdAt),
        userId,
        username: user?.username || 'Member',
        phoneNumber: user?.phoneNumber || '',
        steporaId: user?.steporaId || displayedNexoraId(undefined, userId),
      };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

    const runnerNames: Record<string, string> = {
        'snk-1': 'Cyber Aero Walker',
        'snk-2': 'Bio Surge Trainer',
        'snk-3': 'Cobalt Aero Jogger',
        'snk-4': 'Vortex Blaze Sprint',
    };
    const purchases = runnerPurchaseSnapshot.docs.map((document) => {
        const record = document.data();
        const userId = typeof record.userId === 'string' ? record.userId : '';
        const user = users.get(userId);
        const amount = Number.isFinite(Number(record.amount))
          ? Math.abs(Number(record.amount))
          : Math.abs(Number(record.amountCents) / 100);
        const runnerId = typeof record.runnerId === 'string' ? record.runnerId : '';
        return {
          id: String(record.id || document.id),
          runnerName: runnerNames[runnerId] || `Runner (${runnerId || 'unknown'})`,
          serial: typeof record.serial === 'string' ? record.serial : '',
          createdAt: toIsoDate(record.createdAt),
          amount: Number.isFinite(amount) ? amount : 0,
          username: user?.username || 'Member',
          phoneNumber: user?.phoneNumber || '',
          steporaId: user?.steporaId || displayedNexoraId(undefined, userId),
        };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

    res.json({
        success: true,
        transactions,
        runnerPurchases: purchases,
        email: req.adminEmail,
        role: req.adminRole,
    });
  } catch (error) {
    console.error('[Admin Transaction Listing Error]', error);
    res.status(500).json({ success: false, message: 'Could not load administrator transactions.' });
  }
}
