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
  updateUserActiveSession,
  updateUserUsername,
  updateUserRunners,
  getUserWorkoutSnapshot,
  updateUserWorkoutSnapshot,
  purchaseUserRunner,
  generateUniqueReferralCode,
  generateAutoUsername,
  updateUserProfileImage,
  FirestoreUser,
} from '../database/firebase.js';
import { completeWorkoutAndClearSnapshot, MarathonError } from '../services/marathonService.js';

const MAX_WORKOUT_ROUTE_POINTS = 1000;
const MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 84 * 1024;
const RUNNER_PRICES: Record<string, number> = {
  'snk-1': 500,
  'snk-2': 1000,
  'snk-3': 2000,
  'snk-4': 3500,
};

async function getDisplayUsername(user: FirestoreUser): Promise<string> {
  if (user.username && !/^NexoraMember_\d+$/i.test(user.username)) return user.username;
  const username = generateAutoUsername();
  await updateUserUsername(user.id, username);
  return username;
}

function parseWorkoutSnapshot(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  const isFiniteNonNegativeNumber = (item: unknown): item is number =>
    typeof item === 'number' && Number.isFinite(item) && item >= 0;
  const summary = snapshot.lastWorkoutSummary as Record<string, unknown> | null;
  const routePoints = snapshot.routePoints;

  if (
    !Array.isArray(snapshot.runnerIds) ||
    snapshot.runnerIds.length > 20 ||
    !snapshot.runnerIds.every((id) => typeof id === 'string' && id.length <= 100) ||
    typeof snapshot.isTracking !== 'boolean' ||
    typeof snapshot.pendingFinish !== 'boolean' ||
    typeof snapshot.pendingWasPaused !== 'boolean' ||
    typeof snapshot.isPaused !== 'boolean' ||
    !isFiniteNonNegativeNumber(snapshot.workoutStartTime) ||
    !isFiniteNonNegativeNumber(snapshot.pauseStartTime) ||
    !isFiniteNonNegativeNumber(snapshot.pausedDuration) ||
    !isFiniteNonNegativeNumber(snapshot.elapsedSeconds) ||
    !isFiniteNonNegativeNumber(snapshot.distanceKm) ||
    !isFiniteNonNegativeNumber(snapshot.stepCount) ||
    !isFiniteNonNegativeNumber(snapshot.caloriesBurned) ||
    !isFiniteNonNegativeNumber(snapshot.tokensEarned) ||
    !isFiniteNonNegativeNumber(snapshot.lastUpdated) ||
    !summary ||
    !isFiniteNonNegativeNumber(summary.earned) ||
    typeof summary.distance !== 'string' ||
    typeof summary.time !== 'string' ||
    !isFiniteNonNegativeNumber(summary.calories) ||
    typeof summary.runnerName !== 'string' ||
    !Array.isArray(routePoints)
  ) {
    return null;
  }

  const validRoutePoints = routePoints.slice(-MAX_WORKOUT_ROUTE_POINTS);
  if (!validRoutePoints.every((point) =>
    Array.isArray(point) &&
    point.length === 2 &&
    typeof point[0] === 'number' &&
    Number.isFinite(point[0]) &&
    point[0] >= -90 &&
    point[0] <= 90 &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[1]) &&
    point[1] >= -180 &&
    point[1] <= 180
  )) {
    return null;
  }

  return {
    runnerIds: snapshot.runnerIds,
    isTracking: snapshot.isTracking,
    pendingFinish: snapshot.pendingFinish,
    pendingWasPaused: snapshot.pendingWasPaused,
    lastWorkoutSummary: {
      earned: summary.earned,
      distance: summary.distance,
      time: summary.time,
      calories: summary.calories,
      runnerName: summary.runnerName,
    },
    isPaused: snapshot.isPaused,
    workoutStartTime: snapshot.workoutStartTime,
    pauseStartTime: snapshot.pauseStartTime,
    pausedDuration: snapshot.pausedDuration,
    elapsedSeconds: snapshot.elapsedSeconds,
    distanceKm: snapshot.distanceKm,
    stepCount: snapshot.stepCount,
    caloriesBurned: snapshot.caloriesBurned,
    tokensEarned: snapshot.tokensEarned,
    routePoints: validRoutePoints,
    lastUpdated: snapshot.lastUpdated,
  };
}

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
async function issueSession(user: { id: string; phoneNumber: string; role: string }, res: Response): Promise<string> {
  const sessionId = crypto.randomUUID();
  await updateUserActiveSession(user.id, sessionId);
  const token = jwt.sign(
    { id: user.id, phoneNumber: user.phoneNumber, role: user.role, sessionId },
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

    const token = await issueSession(userPayload, res);

    res.status(201).json({
      success: true,
      message: 'Account successfully created! Welcome to Stepora Movement.',
      token,
      user: {
        id: userId,
        phoneNumber: cleanPhone,
        username: newUser.username || generateAutoUsername(),
        profileImage: newUser.profileImage,
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

    const token = await issueSession(userPayload, res);

    const username = await getDisplayUsername(user);
    res.json({
      success: true,
      message: 'Sign in successful! Redirecting to dashboard...',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        username,
        profileImage: user.profileImage,
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
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  if (req.user) {
    await updateUserActiveSession(req.user.id, null);
  }
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

    const username = await getDisplayUsername(user);
    res.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        username,
        profileImage: user.profileImage,
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
 * GET /api/auth/workout
 */
export async function getWorkoutSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const snapshot = await getUserWorkoutSnapshot(req.user.id);
    res.json({
      success: true,
      workoutSnapshot: snapshot ? { ...snapshot, accountId: req.user.id } : null,
    });
  } catch (error: any) {
    console.error('[Get Workout Snapshot Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to retrieve workout progress.' });
  }
}

/**
 * PUT /api/auth/workout
 */
export async function saveWorkoutSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const snapshot = parseWorkoutSnapshot(req.body);
    if (!snapshot) {
      res.status(400).json({ success: false, message: 'Invalid workout progress snapshot.' });
      return;
    }

    const savedSnapshot = await updateUserWorkoutSnapshot(req.user.id, snapshot);
    res.json({
      success: true,
      workoutSnapshot: { ...savedSnapshot, accountId: req.user.id },
    });
  } catch (error: any) {
    console.error('[Save Workout Snapshot Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to save workout progress.' });
  }
}

/**
 * DELETE /api/auth/workout
 */
export async function clearWorkoutSnapshot(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const workoutStartTime = req.body?.workoutStartTime;
    if (
      workoutStartTime !== undefined &&
      (typeof workoutStartTime !== 'number' || !Number.isFinite(workoutStartTime) || workoutStartTime <= 0)
    ) {
      res.status(400).json({ success: false, message: 'The workout start time is invalid.' });
      return;
    }

    const result = await completeWorkoutAndClearSnapshot(req.user.id, workoutStartTime);
    res.json(result);
  } catch (error: any) {
    if (error instanceof MarathonError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    console.error('[Clear Workout Snapshot Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to clear workout progress.' });
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
        profileImage: updatedUser!.profileImage,
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
    console.error('[Update Username Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to update username.' });
  }
}

/**
 * PUT /api/auth/profile-image
 */
export async function updateProfileImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const profileImage = req.body?.profileImage;
    const match = typeof profileImage === 'string'
      ? /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(profileImage)
      : null;
    if (!match || profileImage.length > MAX_PROFILE_IMAGE_DATA_URL_LENGTH) {
      res.status(400).json({ success: false, message: 'Choose a valid JPEG image no larger than 60 KB after compression.' });
      return;
    }

    const imageBytes = Buffer.from(match[1], 'base64');
    if (
      imageBytes.length === 0 ||
      imageBytes.length > 60 * 1024 ||
      imageBytes.toString('base64') !== match[1] ||
      imageBytes[0] !== 0xff ||
      imageBytes[1] !== 0xd8 ||
      imageBytes[2] !== 0xff ||
      imageBytes[imageBytes.length - 2] !== 0xff ||
      imageBytes[imageBytes.length - 1] !== 0xd9
    ) {
      res.status(400).json({ success: false, message: 'The uploaded profile image is invalid or too large.' });
      return;
    }

    await updateUserProfileImage(req.user.id, profileImage);
    const updatedUser = await findUserById(req.user.id);
    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      message: 'Profile photo updated successfully.',
      user: {
        id: updatedUser.id,
        phoneNumber: updatedUser.phoneNumber,
        username: updatedUser.username,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
        referralCode: updatedUser.referralCode || 'NT723906',
        inviteCodeUsed: updatedUser.inviteCodeUsed,
        status: updatedUser.status,
        createdAt: updatedUser.createdAt,
        lastLoginAt: updatedUser.lastLoginAt,
        balance: updatedUser.balance ?? 0,
        totalDeposit: updatedUser.totalDeposit ?? 0,
        ownedRunners: updatedUser.ownedRunners || [],
        equippedRunnerId: updatedUser.equippedRunnerId,
        runnerCooldowns: updatedUser.runnerCooldowns || {},
      },
    });
  } catch (error: unknown) {
    console.error('[Update Profile Image Error]', error);
    res.status(500).json({ success: false, message: 'Failed to update profile photo.' });
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

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'balance')) {
      res.status(400).json({ success: false, message: 'Balance can only be changed by verified server-side transactions.' });
      return;
    }

    const { equippedRunnerId, runnerCooldowns } = req.body;
    const updateData: { equippedRunnerId?: string; runnerCooldowns?: Record<string, number> } = {};
    if (typeof equippedRunnerId === 'string') updateData.equippedRunnerId = equippedRunnerId;
    if (runnerCooldowns && typeof runnerCooldowns === 'object' && !Array.isArray(runnerCooldowns)) {
      updateData.runnerCooldowns = runnerCooldowns;
    }

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

/**
 * POST /api/auth/runners/purchase
 */
export async function purchaseRunner(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized session.' });
      return;
    }

    const runnerId = req.body?.runnerId;
    if (typeof runnerId !== 'string' || !Object.prototype.hasOwnProperty.call(RUNNER_PRICES, runnerId)) {
      res.status(400).json({ success: false, message: 'Invalid runner selection.' });
      return;
    }

    const purchase = await purchaseUserRunner(req.user.id, runnerId, RUNNER_PRICES[runnerId]);
    res.json({
      success: true,
      message: 'Runner purchased successfully.',
      user: {
        balance: purchase.balance,
        ownedRunners: purchase.ownedRunners,
        equippedRunnerId: purchase.purchasedRunner.id,
      },
      purchasedRunner: purchase.purchasedRunner,
    });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ success: false, message: 'Insufficient balance for this runner.' });
      return;
    }
    if (error?.message === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    }
    if (error?.message === 'RUNNER_SERIALS_EXHAUSTED') {
      res.status(409).json({ success: false, message: 'No unique runner serials are available for this account.' });
      return;
    }
    console.error('[Runner Purchase Error]', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to purchase runner.' });
  }
}
