import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { dbStore } from '../utils/store.ts';
import type { IUser } from '../models/User.ts';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface TokenPayload {
  userId: string;
  role: 'student' | 'admin';
  tokenVersion?: number;
}

export function signAuthToken(user: IUser): string {
  const payload: TokenPayload = {
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Authentication token missing.' });
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    const user = await dbStore.users.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'Account not found. Please sign in again.' });
      return;
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Your account has been suspended. Contact an administrator.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}
