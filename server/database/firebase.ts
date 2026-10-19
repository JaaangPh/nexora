import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  canReplaceWorkoutSnapshot,
  decodeWorkoutRoutePointsFromFirestore,
  encodeWorkoutRoutePointsForFirestore,
  mergeWorkoutSnapshotProgress,
  pauseWorkoutSnapshotForNewSession,
} from '../services/workoutSnapshot.js';
import {
  getReferralRewards,
  isEligibleForReferralReward,
  MAX_REFERRAL_REWARD_GENERATION,
} from '../services/referralRules.js';
import {
  getTurboPayPayoutBank,
  isTurboPayPayoutBankCode,
  TurboPayPayoutBankCode,
} from '../../shared/turbopayBanks.js';

dotenv.config();

function getCleanPrivateKey(): string | undefined {
  let key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return undefined;

  key = key.trim();
  // Strip outer quotes if pasted with quotes in Vercel dashboard
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('`') && key.endsWith('`'))
  ) {
    key = key.slice(1, -1).trim();
  }
  // Replace escaped quotes if present
  key = key.replace(/\\"/g, '"');
  // Convert literal \n to actual newlines
  key = key.replace(/\\n/g, '\n').trim();
  return key;
}

export function initFirebase(): boolean {
  if (getApps().length > 0) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getCleanPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[Firebase Config Error] Missing Firebase credentials:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    });
    return false;
  }

  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('[Firebase] Admin initialized successfully for project:', projectId);
    return true;
  } catch (err: any) {
    console.error('[Firebase Init Error]:', err?.message || err);
    return false;
  }
}

// Attempt immediate init
initFirebase();

export function getDb(): FirebaseFirestore.Firestore {
  if (!initFirebase()) {
    throw new Error(
      'Firebase is not initialized. Please verify FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel Environment Variables.'
    );
  }
  return getFirestore();
}

export const firestore = new Proxy({} as FirebaseFirestore.Firestore, {
  get(target, prop) {
    const db = getDb();
    const val = (db as any)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  },
});

// User Interfaces
export interface OwnedRunner {
  id: string;
  runnerId: string;
  serial: string;
  purchasedAt: number;
  health?: number;
}

export type PayoutProvider = TurboPayPayoutBankCode;

export interface PayoutAccount {
  provider: PayoutProvider;
  bankCode: PayoutProvider;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface FirestoreUser {
  id: string;
  phoneNumber: string;
  username?: string;
  profileImage?: string;
  passwordHash: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode: string;
  referredByUserId?: string;
  referralRewardClaimed?: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
  balance?: number;
  totalDeposit?: number;
  ownedRunners?: (OwnedRunner | string)[];
  equippedRunnerId?: string;
  runnerCooldowns?: Record<string, number>;
  payoutAccounts?: PayoutAccount[];
  activeSessionId?: string | null;
  workoutSnapshot?: Record<string, unknown>;
}

export interface AdminSecurityRecord {
  encryptedTotpSecret?: string;
  pendingEncryptedTotpSecret?: string;
  pendingTotpExpiresAt?: number;
  lastUsedTotpCounter?: number;
  updatedAt?: string;
}

const AUTO_USERNAME_NAMES = [
  'Pablo', 'Juan', 'Miguel', 'Diego', 'Carlos', 'Luis', 'Marco', 'Andres',
  'Mateo', 'Jose', 'Gabriel', 'Rafael', 'Nico', 'Leo', 'Sofia', 'Maria',
  'Ana', 'Elena', 'Lucia', 'Carmen', 'Isabel', 'Luna', 'Mia', 'Nina',
];

export function generateAutoUsername(): string {
  return AUTO_USERNAME_NAMES[Math.floor(Math.random() * AUTO_USERNAME_NAMES.length)];
}

/**
 * Generate a unique 6-digit NT referral code (e.g. NT723906)
 */
export async function generateUniqueReferralCode(): Promise<string> {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `NT${randomDigits}`;
}

/**
 * Initialize Cloud Firestore and disable legacy administrator accounts created with public defaults.
 */
export async function initFirebaseDatabase() {
  if (!initFirebase()) {
    console.warn('[Firebase] Skipping DB seeding: Firebase environment variables are not configured.');
    return;
  }
  console.log('[Firebase] Initializing Cloud Firestore database...');

  // Disable any administrator account created by the legacy public-default seed.
  const adminPhone = '+18005550199';
  const legacyAdminQuery = await firestore
    .collection('users')
    .where('phoneNumber', '==', adminPhone)
    .get();
  const seededAdminDocs = legacyAdminQuery.docs.filter((document) => {
    const user = document.data();
    return user.role === 'admin' && user.inviteCodeUsed === 'SYSTEM-SEED' && user.status !== 'suspended';
  });
  if (seededAdminDocs.length > 0) {
    await Promise.all(seededAdminDocs.map((document) => document.ref.update({ status: 'suspended' })));
    console.warn(`[Firebase] Disabled ${seededAdminDocs.length} legacy default administrator account(s).`);
  }

  console.log('[Firebase] Cloud Firestore ready and connected to "users" collection.');
}

// User Queries
export async function findUserByPhone(phone: string): Promise<FirestoreUser | null> {
  const query = await firestore
    .collection('users')
    .where('phoneNumber', '==', phone)
    .limit(1)
    .get();

  if (query.empty) return null;
  return query.docs[0].data() as FirestoreUser;
}

export async function findUserById(id: string): Promise<FirestoreUser | null> {
  const doc = await firestore.collection('users').doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as FirestoreUser;
}

export async function findUserByReferralCode(code: string): Promise<FirestoreUser | null> {
  const query = await firestore
    .collection('users')
    .where('referralCode', '==', code)
    .limit(1)
    .get();

  if (query.empty) return null;
  return query.docs[0].data() as FirestoreUser;
}

export async function getUserReferralStats(
  id: string
): Promise<{ directTeamCount: number; referralRewards: number }> {
  const [directTeam, transactions] = await Promise.all([
    firestore.collection('users').where('referredByUserId', '==', id).get(),
    firestore.collection('wallet_transactions').where('userId', '==', id).get(),
  ]);

  const referralRewards = transactions.docs.reduce((total, document) => {
    const transaction = document.data();
    if (transaction.type !== 'referral_reward') return total;

    const amount = Number(transaction.amount);
    const amountCents = Number(transaction.amountCents);
    return total + (Number.isFinite(amount) ? amount : Number.isFinite(amountCents) ? amountCents / 100 : 0);
  }, 0);

  return {
    directTeamCount: directTeam.size,
    referralRewards: Math.round(referralRewards * 100) / 100,
  };
}

export async function createUser(userData: {
  id: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode: string;
  referredByUserId?: string;
  username?: string;
}): Promise<FirestoreUser> {
  const autoUsername = userData.username || generateAutoUsername();
  const newUser: FirestoreUser = {
    ...userData,
    username: autoUsername,
    balance: 0,
    totalDeposit: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await firestore.collection('users').doc(userData.id).set(newUser);
  return newUser;
}

export async function updateUserLastLogin(id: string): Promise<void> {
  await firestore.collection('users').doc(id).update({
    lastLoginAt: new Date().toISOString(),
  });
}

export async function updateUserActiveSession(id: string, sessionId: string | null): Promise<void> {
  await firestore.collection('users').doc(id).update({ activeSessionId: sessionId });
}

export async function activateUserSessionAndPauseWorkout(
  id: string,
  sessionId: string
): Promise<void> {
  const userRef = firestore.collection('users').doc(id);
  await firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!userDocument.exists || !user) throw new Error('User not found.');

    const pausedSnapshot = pauseWorkoutSnapshotForNewSession(user.workoutSnapshot, Date.now());
    const updates: Record<string, unknown> = { activeSessionId: sessionId };
    if (pausedSnapshot) updates.workoutSnapshot = pausedSnapshot;
    transaction.update(userRef, updates);
  });
}

export async function updateUserUsername(id: string, username: string): Promise<void> {
  await firestore.collection('users').doc(id).update({
    username: username.trim(),
  });
}

export async function updateUserProfileImage(id: string, profileImage: string): Promise<void> {
  await firestore.collection('users').doc(id).update({ profileImage });
}

function readPayoutAccounts(value: unknown): PayoutAccount[] {
  if (!Array.isArray(value)) return [];

  const providers = new Set<PayoutProvider>();
  return value.flatMap((account): PayoutAccount[] => {
    if (!account || typeof account !== 'object') return [];

    const record = account as Record<string, unknown>;
    if (typeof record.accountNumber !== 'string' || typeof record.accountHolder !== 'string') return [];
    const legacyProviderCodes: Record<string, TurboPayPayoutBankCode> = {
      gcash: 'gcash',
      maya: 'PMP',
      gotyme: 'GOT',
    };
    const bankCode = isTurboPayPayoutBankCode(record.bankCode)
      ? record.bankCode
      : typeof record.provider === 'string' && isTurboPayPayoutBankCode(record.provider)
        ? record.provider
        : typeof record.provider === 'string'
          ? legacyProviderCodes[record.provider]
          : undefined;
    if (!bankCode || providers.has(bankCode)) return [];
    const bank = getTurboPayPayoutBank(bankCode);
    if (!bank) return [];

    providers.add(bankCode);
    return [{
      provider: bankCode,
      bankCode,
      bankName: bank.name,
      accountNumber: record.accountNumber,
      accountHolder: record.accountHolder,
    }];
  });
}

export async function getUserPayoutAccounts(id: string): Promise<PayoutAccount[] | null> {
  const snapshot = await firestore.collection('users').doc(id).get();
  if (!snapshot.exists) return null;
  return readPayoutAccounts(snapshot.data()?.payoutAccounts);
}

export async function saveUserPayoutAccount(id: string, account: PayoutAccount): Promise<PayoutAccount[]> {
  const userRef = firestore.collection('users').doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new Error('ACCOUNT_NOT_FOUND');

    const accounts = readPayoutAccounts(snapshot.data()?.payoutAccounts);
    const existingIndex = accounts.findIndex((item) => item.provider === account.provider);
    if (existingIndex === -1) accounts.push(account);
    else accounts[existingIndex] = account;

    transaction.update(userRef, { payoutAccounts: accounts });
    return accounts;
  });
}

export async function deleteUserPayoutAccount(id: string, provider: PayoutProvider): Promise<PayoutAccount[]> {
  const userRef = firestore.collection('users').doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new Error('ACCOUNT_NOT_FOUND');

    const accounts = readPayoutAccounts(snapshot.data()?.payoutAccounts)
      .filter((account) => account.provider !== provider);
    transaction.update(userRef, { payoutAccounts: accounts });
    return accounts;
  });
}

export async function updateUserRunners(
  id: string,
  data: { equippedRunnerId?: string; runnerCooldowns?: Record<string, number> }
): Promise<void> {
  await firestore.collection('users').doc(id).update(data);
}

export async function purchaseUserRunner(
  id: string,
  runnerId: string,
  price: number,
  healthLimit: number
): Promise<{ balance: number; ownedRunners: OwnedRunner[]; purchasedRunner: OwnedRunner; referralRewardGranted: boolean }> {
  const userRef = firestore.collection('users').doc(id);

  return firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!user) throw new Error('ACCOUNT_NOT_FOUND');

    const referrerIds: string[] = [];
    const referrerDocuments = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    if (isEligibleForReferralReward(user)) {
      const seenReferrers = new Set([id]);
      let referrerId = user.referredByUserId;

      for (let generation = 0; generation < MAX_REFERRAL_REWARD_GENERATION; generation += 1) {
        if (!referrerId || seenReferrers.has(referrerId)) break;
        seenReferrers.add(referrerId);

        const referrerDocument = await transaction.get(firestore.collection('users').doc(referrerId));
        if (!referrerDocument.exists) break;

        referrerIds.push(referrerId);
        referrerDocuments.set(referrerId, referrerDocument);
        referrerId = (referrerDocument.data() as FirestoreUser).referredByUserId;
      }
    }
    const referralRewards = getReferralRewards(referrerIds, id);

    const balance = Number(user.balance || 0);
    if (balance < price) throw new Error('INSUFFICIENT_BALANCE');

    const usedSerials = new Set<string>();
    const ownedRunners: OwnedRunner[] = [];
    for (const item of Array.isArray(user.ownedRunners) ? user.ownedRunners : []) {
      if (typeof item === 'string') {
        ownedRunners.push({
          id: item,
          runnerId: item,
          serial: '',
          purchasedAt: 0,
        });
      } else if (
        item &&
        typeof item.id === 'string' &&
        typeof item.runnerId === 'string' &&
        typeof item.serial === 'string'
      ) {
        ownedRunners.push(item);
      }
    }

    const createSerial = (): string => {
      for (let attempt = 0; attempt < 9000; attempt += 1) {
        const serial = String(crypto.randomInt(1000, 10000));
        if (!usedSerials.has(serial)) {
          usedSerials.add(serial);
          return serial;
        }
      }
      throw new Error('RUNNER_SERIALS_EXHAUSTED');
    };

    for (const runner of ownedRunners) {
      if (/^\d{4}$/.test(runner.serial) && !usedSerials.has(runner.serial)) {
        usedSerials.add(runner.serial);
      } else {
        runner.serial = createSerial();
      }
    }

    const purchasedRunner: OwnedRunner = {
      id: crypto.randomUUID(),
      runnerId,
      serial: createSerial(),
      purchasedAt: Date.now(),
      health: healthLimit,
    };
    ownedRunners.push(purchasedRunner);

    transaction.update(userRef, {
      balance: Math.round((balance - price) * 100) / 100,
      ownedRunners,
      equippedRunnerId: purchasedRunner.id,
      ...(referralRewards.length > 0 ? { referralRewardClaimed: true } : {}),
    });

    const purchaseTransactionId = `runner_purchase_${purchasedRunner.id}`;
    transaction.create(firestore.collection('wallet_transactions').doc(purchaseTransactionId), {
      id: purchaseTransactionId,
      userId: id,
      type: 'runner_purchase',
      runnerId,
      serial: purchasedRunner.serial,
      amountCents: -Math.round(price * 100),
      amount: -price,
      createdAt: new Date(purchasedRunner.purchasedAt).toISOString(),
    });

    for (const reward of referralRewards) {
      const referrerDocument = referrerDocuments.get(reward.referrerId);
      if (!referrerDocument) continue;

      const rewardId = reward.generation === 1
        ? `${id}_referral_reward`
        : `${id}_referral_reward_${reward.referrerId}`;
      transaction.update(referrerDocument.ref, { balance: FieldValue.increment(reward.amount) });
      transaction.create(firestore.collection('wallet_transactions').doc(rewardId), {
        id: rewardId,
        userId: reward.referrerId,
        type: 'referral_reward',
        referredUserId: id,
        runnerId,
        generation: reward.generation,
        amountCents: reward.amount * 100,
        amount: reward.amount,
        createdAt: Date.now(),
      });
    }

    return {
      balance: Math.round((balance - price) * 100) / 100,
      ownedRunners,
      purchasedRunner,
      referralRewardGranted: referralRewards.length > 0,
    };
  });
}

export async function repairUserRunner(
  id: string,
  runnerInstanceId: string,
  quantity: number,
  healthLimit: number,
): Promise<{ balance: number; ownedRunners: OwnedRunner[]; repairedHealth: number }> {
  const userRef = firestore.collection('users').doc(id);
  const repairCost = 10 * quantity;

  return firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!userDocument.exists || !user) throw new Error('ACCOUNT_NOT_FOUND');

    const ownedRunners = (Array.isArray(user.ownedRunners) ? user.ownedRunners : [])
      .flatMap((runner): OwnedRunner[] => {
        if (typeof runner === 'string') {
          return [{ id: runner, runnerId: runner, serial: '', purchasedAt: 0 }];
        }
        if (!runner || typeof runner !== 'object' || typeof runner.id !== 'string' || typeof runner.runnerId !== 'string') {
          return [];
        }
        return [{
          id: runner.id,
          runnerId: runner.runnerId,
          serial: typeof runner.serial === 'string' ? runner.serial : '',
          purchasedAt: Number.isFinite(Number(runner.purchasedAt)) ? Number(runner.purchasedAt) : 0,
          ...(typeof runner.health === 'number' ? { health: runner.health } : {}),
        }];
      });
    const runnerIndex = ownedRunners.findIndex((runner) => runner.id === runnerInstanceId);
    if (runnerIndex === -1) throw new Error('RUNNER_NOT_OWNED');

    const runner = ownedRunners[runnerIndex];
    const currentHealth = typeof runner.health === 'number' && Number.isFinite(runner.health)
      ? Math.max(0, Math.min(healthLimit, Math.floor(runner.health)))
      : healthLimit;
    const missingHealth = healthLimit - currentHealth;
    if (missingHealth <= 0) throw new Error('RUNNER_FULLY_REPAIRED');
    if (quantity > missingHealth) throw new Error('REPAIR_EXCEEDS_MISSING_HEALTH');

    const balance = Number(user.balance || 0);
    if (balance < repairCost) throw new Error('INSUFFICIENT_BALANCE');

    ownedRunners[runnerIndex] = { ...runner, health: currentHealth + quantity };
    const nextBalance = Math.round((balance - repairCost) * 100) / 100;
    const transactionId = `runner_repair_${runnerInstanceId}_${Date.now()}_${crypto.randomUUID()}`;
    transaction.update(userRef, { balance: nextBalance, ownedRunners });
    transaction.create(firestore.collection('wallet_transactions').doc(transactionId), {
      id: transactionId,
      userId: id,
      type: 'runner_repair',
      runnerId: runner.runnerId,
      runnerInstanceId,
      healthRestored: quantity,
      amountCents: -repairCost * 100,
      amount: -repairCost,
      createdAt: Date.now(),
    });

    return { balance: nextBalance, ownedRunners, repairedHealth: quantity };
  });
}

export async function grantUserRunner(
  id: string,
  runnerId: string,
  healthLimit: number,
): Promise<{ ownedRunners: OwnedRunner[]; grantedRunner: OwnedRunner }> {
  const userRef = firestore.collection('users').doc(id);
  return firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!userDocument.exists || !user) throw new Error('ACCOUNT_NOT_FOUND');

    const ownedRunners = (Array.isArray(user.ownedRunners) ? user.ownedRunners : [])
      .flatMap((runner): OwnedRunner[] => {
        if (typeof runner === 'string') {
          return [{ id: runner, runnerId: runner, serial: '', purchasedAt: 0 }];
        }
        if (!runner || typeof runner !== 'object' || typeof runner.runnerId !== 'string') return [];
        return [{
          id: typeof runner.id === 'string' ? runner.id : runner.runnerId,
          runnerId: runner.runnerId,
          serial: typeof runner.serial === 'string' ? runner.serial : '',
          purchasedAt: Number.isFinite(Number(runner.purchasedAt)) ? Number(runner.purchasedAt) : 0,
          ...(typeof runner.health === 'number' ? { health: runner.health } : {}),
        }];
      });
    const usedSerials = new Set(ownedRunners.map((runner) => runner.serial).filter((serial) => /^\d{4}$/.test(serial)));
    let serial = '';
    for (let attempt = 0; attempt < 9000; attempt += 1) {
      const candidate = String(crypto.randomInt(1000, 10000));
      if (!usedSerials.has(candidate)) {
        serial = candidate;
        break;
      }
    }
    if (!serial) throw new Error('RUNNER_SERIALS_EXHAUSTED');

    const grantedRunner: OwnedRunner = {
      id: crypto.randomUUID(),
      runnerId,
      serial,
      purchasedAt: Date.now(),
      health: healthLimit,
    };
    ownedRunners.push(grantedRunner);
    transaction.update(userRef, { ownedRunners });
    return { ownedRunners, grantedRunner };
  });
}

export async function getUserWorkoutSnapshot(id: string): Promise<Record<string, unknown> | null> {
  const user = await findUserById(id);
  const snapshot = user?.workoutSnapshot;
  return snapshot
    ? {
      ...snapshot,
      routePoints: decodeWorkoutRoutePointsFromFirestore(snapshot.routePoints),
    }
    : null;
}

export async function updateUserWorkoutSnapshot(
  id: string,
  snapshot: Record<string, unknown>,
  sessionId: string
): Promise<{ workoutSnapshot: Record<string, unknown>; ownedRunners?: (OwnedRunner | string)[] }> {
  const userRef = firestore.collection('users').doc(id);
  const { readRunnerRules } = await import('../services/runnerRules.js');
  return firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!userDocument.exists || !user || user.activeSessionId !== sessionId) {
      throw new Error('WORKOUT_SESSION_REPLACED');
    }
    const currentSnapshot = user?.workoutSnapshot;
    const currentLastUpdated = Number(currentSnapshot?.lastUpdated || 0);
    const incomingLastUpdated = Number(snapshot.lastUpdated);
    if (!canReplaceWorkoutSnapshot(currentSnapshot, snapshot)) {
      if (!currentSnapshot) throw new Error('WORKOUT_SNAPSHOT_REPLACED');
      return { workoutSnapshot: currentSnapshot };
    }
    if (currentSnapshot && currentLastUpdated > incomingLastUpdated) {
      return { workoutSnapshot: currentSnapshot };
    }
    const sameWorkout = Number(currentSnapshot?.workoutStartTime) === Number(snapshot.workoutStartTime);
    let ownedRunners = Array.isArray(user.ownedRunners) ? user.ownedRunners : [];
    const shouldChargeRunnerUse = !sameWorkout && (snapshot.isTracking === true || snapshot.pendingFinish === true);
    if (shouldChargeRunnerUse) {
      const runnerRules = await readRunnerRules(transaction);
      const runnerIds = Array.isArray(snapshot.runnerIds)
        ? [...new Set(snapshot.runnerIds.filter((runnerId): runnerId is string => typeof runnerId === 'string'))]
        : [];
      if (runnerIds.length === 0) throw new Error('NO_RUNNERS_SELECTED');
      const instances = ownedRunners.flatMap((runner): OwnedRunner[] => {
        if (typeof runner === 'string') return [{ id: runner, runnerId: runner, serial: '', purchasedAt: 0 }];
        return runner && typeof runner.id === 'string' && typeof runner.runnerId === 'string'
          ? [runner]
          : [];
      });
      const selected = runnerIds.map((runnerId) =>
        instances.find((runner) => runner.id === runnerId || runner.runnerId === runnerId)
      );
      if (selected.some((runner) => !runner)) throw new Error('RUNNER_NOT_OWNED');
      const healthById = new Map<string, number>();
      for (const runner of selected) {
        if (!runner) continue;
        const rule = runnerRules[runner.runnerId as keyof typeof runnerRules];
        const healthLimit = rule?.healthLimit ?? 10;
        const health = typeof runner.health === 'number' && Number.isFinite(runner.health)
          ? Math.max(0, Math.min(healthLimit, Math.floor(runner.health)))
          : healthLimit;
        if (health <= 0) throw new Error('RUNNER_NEEDS_REPAIR');
        healthById.set(runner.id, health - 1);
      }
      ownedRunners = instances.map((runner) => healthById.has(runner.id)
        ? { ...runner, health: healthById.get(runner.id) }
        : runner);
    }
    const serverStartedAt = sameWorkout
      ? Number(currentSnapshot?.serverStartedAt || Date.now())
      : Date.now();
    const savedSnapshot: Record<string, unknown> = {
      ...mergeWorkoutSnapshotProgress(currentSnapshot, snapshot),
      serverStartedAt,
    };
    transaction.update(userRef, {
      workoutSnapshot: {
        ...savedSnapshot,
        routePoints: encodeWorkoutRoutePointsForFirestore(savedSnapshot['routePoints']),
      },
      ...(shouldChargeRunnerUse ? { ownedRunners } : {}),
    });
    return {
      workoutSnapshot: savedSnapshot,
      ...(shouldChargeRunnerUse ? { ownedRunners } : {}),
    };
  });
}

export async function deleteUserWorkoutSnapshot(id: string): Promise<void> {
  await firestore.collection('users').doc(id).update({
    workoutSnapshot: FieldValue.delete(),
  });
}
