import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

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
export interface FirestoreUser {
  id: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Generate a unique 6-digit NT referral code (e.g. NT723906)
 */
export async function generateUniqueReferralCode(): Promise<string> {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `NT${randomDigits}`;
}

/**
 * Initialize Cloud Firestore admin account if absent
 */
export async function initFirebaseDatabase() {
  if (!initFirebase()) {
    console.warn('[Firebase] Skipping DB seeding: Firebase environment variables are not configured.');
    return;
  }
  console.log('[Firebase] Initializing Cloud Firestore database...');

  // Seed Initial Administrator Account if absent
  const adminPhone = '+18005550199';
  const userQuery = await firestore
    .collection('users')
    .where('phoneNumber', '==', adminPhone)
    .limit(1)
    .get();

  if (userQuery.empty) {
    const adminId = crypto.randomUUID();
    const adminHash = bcrypt.hashSync('AdminPassword2025!', 10);
    const adminDoc: FirestoreUser = {
      id: adminId,
      phoneNumber: adminPhone,
      passwordHash: adminHash,
      role: 'admin',
      inviteCodeUsed: 'SYSTEM-SEED',
      referralCode: 'NT723906',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    await firestore.collection('users').doc(adminId).set(adminDoc);
    console.log(`[Firebase] Seeded admin account: ${adminPhone} (Referral: NT723906)`);
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
}): Promise<FirestoreUser> {
  const newUser: FirestoreUser = {
    ...userData,
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
