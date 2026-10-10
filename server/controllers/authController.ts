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
  findInviteCode,
  incrementInviteCodeUsage,
  getAllActiveInviteCodes,
  createInviteCode as createFirebaseInviteCode,
  generateUniqueReferralCode,
  registerReferralCodeAsInvite,
  logAuthEvent,
} from '../database/firebase.js';

// Helper: Normalize phone numbers (strips spaces, dashes, parentheses)
function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\(\)\-]/g, '');
}

// Helper: Validate phone number regex (supports international formats)
function isValidPhone(phone: string): boolean {
  const clean = normalizePhone(phone);
  return /^\+?[0-9]{7,15}$/.test(clean);
}

// Helper: Issue JWT and optionally set cookie
function issueSession(user: { id: string; phoneNumber: string; role: string }, res: Response) {
  const token = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.cookie('nexora_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: config.cookieMaxAge,
  });

  return token;
}

// Helper: record audit log
async function recordLog(phoneNumber: string, action: string, status: string, req: Request, details?: string) {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  await logAuthEvent({
    phoneNumber,
    action,
    ipAddress: String(ip),
    userAgent: String(userAgent),
    status,
    details: details || null,
  });
}

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { phoneNumber, password, confirmPassword, inviteCode } = req.body;

    // 1. Validate required fields
    if (!phoneNumber || !password || !confirmPassword || !inviteCode) {
      res.status(400).json({
        success: false,
        message: 'All fields are required (phone number, password, confirm password, invite code).',
      });
      return;
    }

    // 2. Validate phone format
    const cleanPhone = normalizePhone(phoneNumber);
    if (!isValidPhone(cleanPhone)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (7 to 15 digits, e.g. +18005550199 or 8005550199).',
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

    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Account password and confirm password do not match.',
      });
      return;
    }

    // 4. Validate Invite / Referral Code against Firestore
    const cleanCode = inviteCode.trim().toUpperCase();
    const codeRecord = await findInviteCode(cleanCode);

    if (!codeRecord || !codeRecord.isActive) {
      await recordLog(cleanPhone, 'register', 'rejected_invalid_invite', req, `Code: ${cleanCode}`);
      res.status(400).json({
        success: false,
        message: 'Invalid or inactive invite/referral code. Please enter a valid registration key.',
      });
      return;
    }

    // Check max uses (-1 is unlimited)
    if (codeRecord.maxUses > 0 && codeRecord.timesUsed >= codeRecord.maxUses) {
      res.status(400).json({
        success: false,
        message: 'This invite code has reached its maximum registration limit.',
      });
      return;
    }

    // 5. Check if user already exists
    const existing = await findUserByPhone(cleanPhone);
    if (existing) {
      await recordLog(cleanPhone, 'register', 'duplicate_phone', req);
      res.status(409).json({
        success: false,
        message: 'An account with this phone number already exists. Please log in instead.',
      });
      return;
    }

    // 6. Generate a unique random NT(6-digit) referral code for this new account
    const myReferralCode = await generateUniqueReferralCode();

    // 7. Hash password securely
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 8. Insert new user into Firestore
    const userId = crypto.randomUUID();
    const newUser = await createUser({
      id: userId,
      phoneNumber: cleanPhone,
      passwordHash,
      role: 'member',
      inviteCodeUsed: codeRecord.code,
      referralCode: myReferralCode,
    });

    // 9. Register this new member's referral code into invite_codes collection
    // so others can use it to register
    await registerReferralCodeAsInvite(myReferralCode, cleanPhone);

    // Increment original invite code usage
    await incrementInviteCodeUsage(codeRecord.code);

    await recordLog(cleanPhone, 'register', 'success', req, `Invite: ${codeRecord.code}, GeneratedRef: ${myReferralCode}`);

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
        role: 'member',
        referralCode: myReferralCode,
        inviteCodeUsed: codeRecord.code,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during registration. Please try again.',
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

    // Generic error message to prevent enumeration
    const invalidCredentialsMsg = 'Invalid phone number or password. Please verify your credentials.';

    if (!user) {
      await recordLog(cleanPhone, 'login', 'failed_user_not_found', req);
      res.status(401).json({
        success: false,
        message: invalidCredentialsMsg,
      });
      return;
    }

    if (user.status !== 'active') {
      await recordLog(cleanPhone, 'login', 'inactive_account', req);
      res.status(403).json({
        success: false,
        message: 'This account is suspended or inactive. Please contact Nexora Security.',
      });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await recordLog(cleanPhone, 'login', 'failed_bad_password', req);
      res.status(401).json({
        success: false,
        message: invalidCredentialsMsg,
      });
      return;
    }

    // Update last login in Firestore
    await updateUserLastLogin(user.id);
    await recordLog(cleanPhone, 'login', 'success', req);

    const token = issueSession(user, res);

    res.json({
      success: true,
      message: 'Login successful. Welcome back.',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        referralCode: user.referralCode || 'NT723906',
        inviteCodeUsed: user.inviteCodeUsed,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({
      success: false,
      message: 'An internal server error occurred while processing your sign in.',
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
        role: user.role,
        referralCode: user.referralCode || 'NT723906',
        inviteCodeUsed: user.inviteCodeUsed,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
}

/**
 * POST /api/auth/validate-invite
 */
export async function validateInvite(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        valid: false,
        message: 'Please provide an invite code to validate.',
      });
      return;
    }

    const clean = code.trim().toUpperCase();
    const record = await findInviteCode(clean);

    if (!record || !record.isActive) {
      res.json({
        success: true,
        valid: false,
        message: 'Invalid invite/referral code. Please check and try again.',
      });
      return;
    }

    if (record.maxUses > 0 && record.timesUsed >= record.maxUses) {
      res.json({
        success: true,
        valid: false,
        message: 'This invite code has reached its maximum member limit.',
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      message: `Verified: ${record.description || `Valid Referral Pass (${clean})`}`,
      code: record.code,
      remainingUses: record.maxUses === -1 ? 'Unlimited' : record.maxUses - record.timesUsed,
    });
  } catch (error) {
    res.status(500).json({ success: false, valid: false, message: 'Validation service error.' });
  }
}

/**
 * GET /api/auth/invites
 */
export async function getActiveInvites(req: Request, res: Response): Promise<void> {
  try {
    const codes = await getAllActiveInviteCodes();
    res.json({
      success: true,
      inviteCodes: codes.map((c) => ({
        code: c.code,
        description: c.description,
        max_uses: c.maxUses,
        times_used: c.timesUsed,
        is_active: c.isActive ? 1 : 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch codes.' });
  }
}

/**
 * POST /api/admin/invite-codes
 */
export async function createInviteCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Admin permissions required.' });
      return;
    }

    const { code, description, maxUses } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: 'Code is required.' });
      return;
    }

    const newCode = await createFirebaseInviteCode({
      code,
      description,
      maxUses: maxUses || 10,
    });

    res.status(201).json({
      success: true,
      message: `Invite code ${newCode.code} created successfully.`,
      inviteCode: newCode,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create invite code.' });
  }
}
