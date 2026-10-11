import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { findUserById } from '../database/firebase.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    phoneNumber: string;
    role: string;
    sessionId: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fallback to HttpOnly cookie
    if (!token && req.cookies && req.cookies.nexora_token) {
      token = req.cookies.nexora_token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      phoneNumber: string;
      role: string;
      sessionId?: string;
    };

    // Verify user exists in Firestore
    const user = await findUserById(decoded.id);

    if (!user || user.status !== 'active') {
      res.status(401).json({
        success: false,
        message: 'Account is inactive or session is invalid.',
      });
      return;
    }

    if (!decoded.sessionId || user.activeSessionId !== decoded.sessionId) {
      res.status(401).json({
        success: false,
        message: 'This account was signed in on another device. Please log in again.',
      });
      return;
    }

    req.user = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.',
    });
  }
}
