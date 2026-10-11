import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/config.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  findUserByPhone,
  findUserById,
  createUser,
  updateUserLastLogin,
  updateUserUsername,
  updateUserBalance,
  updateUserRunners,
  generateUniqueReferralCode,
  generateAutoUsername,
} from '../database/firebase.js';

// Helper: Normalize phone numbers (strips spaces, dashes, parentheses)
function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\(\)\-]/g, '');
}

// Basic phone validation (7 to 15 digits)
function isValidPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/\+/g, '');
  return /^\d{7,15}$/.test(digitsOnly);
}

// Helper: Issue JWT Session Token & set HTTP-only cookie
function issueSession(user: { id: string; phoneNumber: string; role: string }, res: Response): string {
  const token = jwt.sign(
    { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as any }
  );

  res.cookie('nexora_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: config.cookieMaxAge,
  });

  return token;
}

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { phoneNumber, password, confirmPassword, inviteCode } = req.body;

    // 1. Required fields check
    if (!phoneNumber || !password) {
      res.status(400).json({
        success: false,
        message: 'Phone number and password are required.',
      });
      return;
    }

    // 2. Validate phone format
    const cleanPhone = normalizePhone(phoneNumber);
    if (!isValidPhone(cleanPhone)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (7 to 15 digits).',
      });
      return;
    }

    // 3. Validate password length & match
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Account password and confirm password do not match.',
      });
      return;
    }

    // 4. Check if user already exists
    const existing = await findUserByPhone(cleanPhone);
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'An account with this phone number already exists. Please log in instead.',
      });
      return;
    }

    // 5. Generate unique NT referral code for this new member
    const myReferralCode = await generateUniqueReferralCode();
    const usedCode = inviteCode ? inviteCode.trim().toUpperCase() : 'DIRECT-SIGNUP';

    // 6. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 7. Save user in Firestore
    const userId = crypto.randomUUID();
    const newUser = await createUser({
      id: userId,
      phoneNumber: cleanPhone,
      passwordHash,
      role: 'member',
      inviteCodeUsed: usedCode,
      referralCode: myReferralCode,
    });

    const userPayload = {
      id: userId,
      phoneNumber: cleanPhone,
      role: 'member',
    };

    const token = issueSession(userPayload, res);

    res.status(201).json({
      success: true,
      message: 'Account successfully created! Welcome to Nexora Technologies.',
      token,
      user: {
        id: userId,
        phoneNumber: cleanPhone,
        username: newUser.username || generateAutoUsername(myReferralCode),
        role: 'member',
        referralCode: myReferralCode,
        inviteCodeUsed: usedCode,
        createdAt: newUser.createdAt,
        balance: newUser.balance ?? 0,
        totalDeposit: newUser.totalDeposit ?? 0,
        ownedRunners: newUser.ownedRunners || [],
        equippedRunnerId: newUser.equippedRunnerId,
        runnerCooldowns: newUser.runnerCooldowns || {},
      },
    });
  } catch (error: any) {
    console.error('[Register Error]', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'An unexpected error occurred during registration. Please try again.',
    });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      res.status(400).json({
        success: false,
        message: 'Please enter both your phone number and password.',
      });
      return;
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Fetch user from Firestore
    const user = await findUserByPhone(cleanPhone);

    const invalidCredentialsMsg = 'Invalid phone number or account password. Please try again.';

    if (!user) {
      res.status(401).json({
        success: false,
        message: invalidCredentialsMsg,
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'This account is suspended or inactive. Please contact Nexora Security.',
      });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({
        success: false,
        message: invalidCredentialsMsg,
      });
      return;
    }

    // Update last login in Firestore
    await updateUserLastLogin(user.id);

    const userPayload = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    const token = issueSession(userPayload, res);

    res.json({
      success: true,
      message: 'Sign in successful! Redirecting to dashboard...',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        username: user.username || generateAutoUsername(user.referralCode),
        role: user.role,
        referralCode: user.referralCode || 'NT723906',
        inviteCodeUsed: user.inviteCodeUsed,
        createdAt: user.createdAt,
        lastLoginAt: new Date().toISOString(),
        balance: user.balance ?? 0,
        totalDeposit: user.totalDeposit ?? 0,
        ownedRunners: user.ownedRunners || [],
        equippedRunnerId: user.equippedRunnerId,
        runnerCooldowns: user.runnerCooldowns || {},
      },
    });
  } catch (error: any) {
    console.error('[Login Error]', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'An unexpected error occurred during sign in. Please try again.',
    });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('nexora_token');
  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * GET /api/auth/me
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await findUserById(req.user.id);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        username: user.username || generateAutoUsername(user.referralCode),
        role: user.role,
        referralCode: user.referralCode || 'NT723906',
        inviteCodeUsed: user.inviteCodeUsed,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        balance: user.balance ?? 0,
        totalDeposit: user.totalDeposit ?? 0,
        ownedRunners: user.ownedRunners || [],
        equippedRunnerId: user.equippedRunnerId,
        runnerCooldowns: user.runnerCooldowns || {},
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || 'Failed to retrieve profile.' });
  }
}

/**
 * PUT /api/auth/username
 */
export async function updateUsername(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const { username } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ success: false, message: 'Please provide a valid username.' });
      return;
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      res.status(400).json({ success: false, message: 'Username must be between 3 and 30 characters long.' });
      return;
    }

    await updateUserUsername(req.user.id, cleanUsername);
    const updatedUser = await findUserById(req.user.id);

    res.json({
      success: true,
      message: 'Username updated successfully!',
      user: {
        id: updatedUser!.id,
        phoneNumber: updatedUser!.phoneNumber,
        username: updatedUser!.username || cleanUsername,
        role: updatedUser!.role,
        referralCode: updatedUser!.referralCode || 'NT723906',
        inviteCodeUsed: updatedUser!.inviteCodeUsed,
        status: updatedUser!.status,
        createdAt: updatedUser!.createdAt,
        lastLoginAt: updatedUser!.lastLoginAt,
        balance: updatedUser!.balance ?? 0,
        totalDeposit: updatedUser!.totalDeposit ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[Update Username Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update username.' });
  }
}

/**
 * PUT /api/auth/balance
 */
export async function updateBalance(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const { balance } = req.body;
    if (typeof balance !== 'number' || isNaN(balance) || balance < 0) {
      res.status(400).json({ success: false, message: 'Invalid balance amount.' });
      return;
    }

    const cleanBalance = Math.round(balance * 100) / 100;
    await updateUserBalance(req.user.id, cleanBalance);
    const updatedUser = await findUserById(req.user.id);

    res.json({
      success: true,
      message: 'Balance updated successfully!',
      user: {
        id: updatedUser!.id,
        phoneNumber: updatedUser!.phoneNumber,
        username: updatedUser!.username,
        role: updatedUser!.role,
        referralCode: updatedUser!.referralCode || 'NT723906',
        inviteCodeUsed: updatedUser!.inviteCodeUsed,
        status: updatedUser!.status,
        createdAt: updatedUser!.createdAt,
        lastLoginAt: updatedUser!.lastLoginAt,
        balance: updatedUser!.balance ?? cleanBalance,
        totalDeposit: updatedUser!.totalDeposit ?? 0,
        ownedRunners: updatedUser!.ownedRunners || [],
        equippedRunnerId: updatedUser!.equippedRunnerId,
        runnerCooldowns: updatedUser!.runnerCooldowns || {},
      },
    });
  } catch (error: any) {
    console.error('[Update Balance Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update balance.' });
  }
}

/**
 * PUT /api/auth/runners
 */
export async function updateRunners(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const { ownedRunners, equippedRunnerId, runnerCooldowns, balance } = req.body;
    const updateData: any = {};
    if (Array.isArray(ownedRunners)) updateData.ownedRunners = ownedRunners;
    if (typeof equippedRunnerId === 'string') updateData.equippedRunnerId = equippedRunnerId;
    if (runnerCooldowns && typeof runnerCooldowns === 'object') updateData.runnerCooldowns = runnerCooldowns;
    if (typeof balance === 'number' && !isNaN(balance)) updateData.balance = Math.round(balance * 100) / 100;

    await updateUserRunners(req.user.id, updateData);
    const updatedUser = await findUserById(req.user.id);

    res.json({
      success: true,
      message: 'Runners updated successfully!',
      user: {
        id: updatedUser!.id,
        phoneNumber: updatedUser!.phoneNumber,
        username: updatedUser!.username,
        role: updatedUser!.role,
        referralCode: updatedUser!.referralCode || 'NT723906',
        inviteCodeUsed: updatedUser!.inviteCodeUsed,
        status: updatedUser!.status,
        createdAt: updatedUser!.createdAt,
        lastLoginAt: updatedUser!.lastLoginAt,
        balance: updatedUser!.balance ?? 0,
        totalDeposit: updatedUser!.totalDeposit ?? 0,
        ownedRunners: updatedUser!.ownedRunners || [],
        equippedRunnerId: updatedUser!.equippedRunnerId,
        runnerCooldowns: updatedUser!.runnerCooldowns || {},
      },
    });
  } catch (error: any) {
    console.error('[Update Runners Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update runners.' });
  }
}

