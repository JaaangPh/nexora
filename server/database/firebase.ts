import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Ensure Firebase is initialized once
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

export const firestore = getFirestore();

// Interfaces
export interface FirestoreUser {
  id: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode: string; // e.g. "NT723906"
  status: 'active' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
}

export interface FirestoreInviteCode {
  id: string;
  code: string;
  description: string;
  maxUses: number; // -1 for unlimited
  timesUsed: number;
  isActive: boolean;
  createdAt: string;
}

export interface FirestoreAuthLog {
  id: string;
  phoneNumber: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  status: string;
  details?: string | null;
  createdAt: string;
}

/**
 * Generate a unique 6-digit NT referral code (e.g. NT723906)
 */
export async function generateUniqueReferralCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 20) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000); // 100000 to 999999
    const candidate = `NT${randomDigits}`;

    // Verify it doesn't already exist in invite_codes
    const existing = await findInviteCode(candidate);
    if (!existing) {
      return candidate;
    }
    attempts++;
  }
  // Fallback with timestamp suffix if needed
  return `NT${Math.floor(100000 + Math.random() * 900000)}`;
}

/**
 * Initialize Firestore and seed initial invite codes and admin account if absent
 */
export async function initFirebaseDatabase() {
  console.log('[Firebase] Initializing Cloud Firestore database...');

  // 1. Seed Invite Codes (including starter referral code NT723906)
  const seedCodes: Omit<FirestoreInviteCode, 'timesUsed' | 'createdAt'>[] = [
    {
      id: 'inv-ref-001',
      code: 'NT723906',
      description: 'Nexora Official Founder Referral Pass (Unlimited)',
      maxUses: -1,
      isActive: true,
    },
    {
      id: 'inv-001',
      code: 'NEXORA-2025',
      description: 'General Member Onboarding Pass (Unlimited)',
      maxUses: -1,
      isActive: true,
    },
    {
      id: 'inv-002',
      code: 'VIP-ACCESS',
      description: 'Executive VIP Access Pass',
      maxUses: 25,
      isActive: true,
    },
    {
      id: 'inv-003',
      code: 'SECURITY-PASS',
      description: 'Nexora Security Protocol Pass',
      maxUses: 10,
      isActive: true,
    },
    {
      id: 'inv-004',
      code: 'ALPHA-TESTER',
      description: 'Mobile QA Verification Pass',
      maxUses: 10,
      isActive: true,
    },
  ];

  for (const c of seedCodes) {
    const docRef = firestore.collection('invite_codes').doc(c.code);
    const snap = await docRef.get();
    if (!snap.exists) {
      await docRef.set({
        ...c,
        timesUsed: 0,
        createdAt: new Date().toISOString(),
      });
      console.log(`[Firebase] Seeded invite/referral code: ${c.code}`);
    }
  }

  // 2. Seed Initial Administrator Account with referralCode: NT723906
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
  } else {
    // Ensure existing admin has a referralCode
    const existingDoc = userQuery.docs[0];
    const data = existingDoc.data() as FirestoreUser;
    if (!data.referralCode) {
      await existingDoc.ref.update({ referralCode: 'NT723906' });
      console.log(`[Firebase] Updated admin with referral code NT723906`);
    }
  }

  console.log('[Firebase] Cloud Firestore is ready and connected to project "nexora-d0290"');
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
  inviteCodeUsed: string;
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

// Invite Code Queries
export async function findInviteCode(code: string): Promise<FirestoreInviteCode | null> {
  const upper = code.trim().toUpperCase();
  const doc = await firestore.collection('invite_codes').doc(upper).get();
  if (!doc.exists) return null;
  return doc.data() as FirestoreInviteCode;
}

export async function incrementInviteCodeUsage(code: string): Promise<void> {
  const upper = code.trim().toUpperCase();
  await firestore.collection('invite_codes').doc(upper).update({
    timesUsed: FieldValue.increment(1),
  });
}

export async function registerReferralCodeAsInvite(
  code: string,
  userPhone: string
): Promise<FirestoreInviteCode> {
  const upper = code.trim().toUpperCase();
  const doc: FirestoreInviteCode = {
    id: crypto.randomUUID(),
    code: upper,
    description: `Member Referral Code (${userPhone.slice(-4)})`,
    maxUses: -1, // Referral codes have unlimited uses
    timesUsed: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await firestore.collection('invite_codes').doc(upper).set(doc);
  return doc;
}

export async function getAllActiveInviteCodes(): Promise<FirestoreInviteCode[]> {
  const snap = await firestore
    .collection('invite_codes')
    .where('isActive', '==', true)
    .get();

  return snap.docs.map((d) => d.data() as FirestoreInviteCode);
}

export async function createInviteCode(codeData: {
  code: string;
  description: string;
  maxUses: number;
}): Promise<FirestoreInviteCode> {
  const upper = codeData.code.trim().toUpperCase();
  const doc: FirestoreInviteCode = {
    id: crypto.randomUUID(),
    code: upper,
    description: codeData.description,
    maxUses: codeData.maxUses,
    timesUsed: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await firestore.collection('invite_codes').doc(upper).set(doc);
  return doc;
}

// Auth Logging
export async function logAuthEvent(logData: {
  phoneNumber: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  status: string;
  details?: string | null;
}): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await firestore.collection('auth_logs').doc(id).set({
      id,
      ...logData,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Firebase Log Error]', err);
  }
}
