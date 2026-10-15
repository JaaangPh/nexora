import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  canReplaceWorkoutSnapshot,
  mergeWorkoutSnapshotProgress,
  pauseWorkoutSnapshotForNewSession,
} from '../services/workoutSnapshot.js';

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
}

export type PayoutProvider = 'gcash' | 'maya' | 'gotyme';

export interface PayoutAccount {
  provider: PayoutProvider;
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

export async function createUser(userData: {
  id: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode: string;
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
  return value.filter((account): account is PayoutAccount => {
    if (
      !account ||
      typeof account !== 'object' ||
      !['gcash', 'maya', 'gotyme'].includes((account as PayoutAccount).provider) ||
      typeof (account as PayoutAccount).accountNumber !== 'string' ||
      typeof (account as PayoutAccount).accountHolder !== 'string'
    ) return false;

    const payoutAccount = account as PayoutAccount;
    if (providers.has(payoutAccount.provider)) return false;
    providers.add(payoutAccount.provider);
    return true;
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
  price: number
): Promise<{ balance: number; ownedRunners: OwnedRunner[]; purchasedRunner: OwnedRunner }> {
  const userRef = firestore.collection('users').doc(id);

  return firestore.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const user = userDocument.data() as FirestoreUser | undefined;
    if (!user) throw new Error('ACCOUNT_NOT_FOUND');

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
    };
    ownedRunners.push(purchasedRunner);

    transaction.update(userRef, {
      balance: Math.round((balance - price) * 100) / 100,
      ownedRunners,
      equippedRunnerId: purchasedRunner.id,
    });

    return {
      balance: Math.round((balance - price) * 100) / 100,
      ownedRunners,
      purchasedRunner,
    };
  });
}

export async function getUserWorkoutSnapshot(id: string): Promise<Record<string, unknown> | null> {
  const user = await findUserById(id);
  return user?.workoutSnapshot || null;
}

export async function updateUserWorkoutSnapshot(
  id: string,
  snapshot: Record<string, unknown>,
  sessionId: string
): Promise<Record<string, unknown>> {
  const userRef = firestore.collection('users').doc(id);
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
      return currentSnapshot;
    }
    if (currentSnapshot && currentLastUpdated > incomingLastUpdated) {
      return currentSnapshot;
    }
    const sameWorkout = Number(currentSnapshot?.workoutStartTime) === Number(snapshot.workoutStartTime);
    const serverStartedAt = sameWorkout
      ? Number(currentSnapshot?.serverStartedAt || Date.now())
      : Date.now();
    const savedSnapshot = {
      ...mergeWorkoutSnapshotProgress(currentSnapshot, snapshot),
      serverStartedAt,
    };
    transaction.update(userRef, { workoutSnapshot: savedSnapshot });
    return savedSnapshot;
  });
}

export async function deleteUserWorkoutSnapshot(id: string): Promise<void> {
  await firestore.collection('users').doc(id).update({
    workoutSnapshot: FieldValue.delete(),
  });
}
