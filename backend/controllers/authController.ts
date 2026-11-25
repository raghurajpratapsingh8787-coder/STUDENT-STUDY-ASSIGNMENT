import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { env } from '../config/env.ts';
import { signAuthToken, type AuthenticatedRequest } from '../middleware/auth.ts';
import type { IUser } from '../models/User.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString, asPositiveInt, isValidEmail } from '../utils/validation.ts';

function sanitizeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    major: user.major,
    university: user.university,
    dailyGoalMinutes: user.dailyGoalMinutes,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
  };
}

export async function getAdminSetupStatus(_req: Request, res: Response): Promise<void> {
  try {
    const adminCount = await dbStore.users.countByRole('admin');
    res.json({
      adminExists: adminCount > 0,
      hasEnvPasscode: Boolean(env.adminPasscode),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Status check failed.' });
  }
}

let adminClaimInFlight = false;

function timingSafeMatches(provided: string, expected: string): boolean {
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

export async function claimAdminWorkspace(req: Request, res: Response): Promise<void> {
  if (adminClaimInFlight) {
    res.status(409).json({
      error: 'Administrator setup is currently in progress. Please wait a moment.',
    });
    return;
  }

  adminClaimInFlight = true;
  try {
    const adminCount = await dbStore.users.countByRole('admin');
    if (adminCount > 0) {
      res.status(409).json({
        error: 'An administrator account has already been claimed. Please sign in normally.',
      });
      return;
    }

    const name = asCleanString(req.body?.name, 120);
    const emailRaw = req.body?.email;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';

    if (env.adminPasscode && !timingSafeMatches(passcode, env.adminPasscode)) {
      res.status(403).json({ error: 'Invalid administrator setup passcode.' });
      return;
    }

    if (!name || !isValidEmail(emailRaw) || password.length < 8) {
      res.status(400).json({
        error: 'Provide a valid name, email address, and a password of at least 8 characters.',
      });
      return;
    }

    const email = emailRaw.toLowerCase().trim();
    const existing = await dbStore.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const recheckCount = await dbStore.users.countByRole('admin');
    if (recheckCount > 0) {
      res.status(409).json({
        error: 'An administrator account has already been claimed. Please sign in normally.',
      });
      return;
    }

    const admin = await dbStore.users.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      major: 'Academic Administration',
      university: asCleanString(req.body?.university, 160),
      dailyGoalMinutes: 120,
      avatarUrl: '',
      isActive: true,
      resetRequestedAt: null,
      resetTokenHash: null,
      resetTokenExpires: null,
      tokenVersion: 0,
      lastActiveAt: new Date(),
    });

    const token = signAuthToken(admin);
    res.status(201).json({ token, user: sanitizeUser(admin) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Admin setup failed.' });
  } finally {
    adminClaimInFlight = false;
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const name = asCleanString(req.body?.name, 120);
    const emailRaw = req.body?.email;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const major = asCleanString(req.body?.major, 120) || 'General Studies';
    const university = asCleanString(req.body?.university, 160);

    if (!name) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!isValidEmail(emailRaw)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const email = emailRaw.toLowerCase().trim();
    const existing = await dbStore.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await dbStore.users.create({
      name,
      email,
      passwordHash,
      role: 'student', // Strictly enforce student role on public registration
      major,
      university,
      dailyGoalMinutes: 90,
      avatarUrl: '',
      isActive: true,
      resetRequestedAt: null,
      resetTokenHash: null,
      resetTokenExpires: null,
      tokenVersion: 0,
      lastActiveAt: new Date(),
    });

    const token = signAuthToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const emailRaw = req.body?.email;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(emailRaw) || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const email = emailRaw.toLowerCase().trim();
    const user = await dbStore.users.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'This account is currently suspended. Contact an administrator.',
      });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const updated =
      (await dbStore.users.updateById(user._id, { lastActiveAt: new Date() })) || user;
    const token = signAuthToken(updated);
    res.json({ token, user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sign in failed.' });
  }
}

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    const emailRaw = req.body?.email;
    if (!isValidEmail(emailRaw)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const user = await dbStore.users.findByEmail(emailRaw);
    if (user) {
      await dbStore.users.updateById(user._id, {
        resetRequestedAt: new Date(),
      });
    }

    res.json({
      message:
        'If an account exists for that email, a password reset request has been logged. Enter an administrator-issued one-time reset code below to set a new password.',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Reset request failed.' });
  }
}

export async function confirmPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    const emailRaw = req.body?.email;
    const resetCode = typeof req.body?.resetCode === 'string' ? req.body.resetCode.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(emailRaw) || !resetCode || newPassword.length < 8) {
      res.status(400).json({
        error: 'Valid email, reset code, and a new password (8+ characters) are required.',
      });
      return;
    }

    const user = await dbStore.users.findByEmail(emailRaw);
    if (!user || !user.resetTokenHash || !user.resetTokenExpires) {
      res.status(400).json({ error: 'Invalid or expired password reset code.' });
      return;
    }

    if (new Date(user.resetTokenExpires).getTime() < Date.now()) {
      res.status(400).json({ error: 'Reset code has expired. Request a new code.' });
      return;
    }

    const submittedHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const expectedBuf = Buffer.from(user.resetTokenHash, 'hex');
    const submittedBuf = Buffer.from(submittedHash, 'hex');
    if (
      expectedBuf.length !== submittedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, submittedBuf)
    ) {
      res.status(400).json({ error: 'Invalid reset code.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await dbStore.users.updateById(user._id, {
      passwordHash,
      resetRequestedAt: null,
      resetTokenHash: null,
      resetTokenExpires: null,
      tokenVersion: (user.tokenVersion ?? 0) + 1,
    });

    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Password reset failed.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  res.json({ user: sanitizeUser(req.user) });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const name = asCleanString(req.body?.name, 120);
    const major = asCleanString(req.body?.major, 120);
    const university = asCleanString(req.body?.university, 160);
    const dailyGoalMinutes = asPositiveInt(
      req.body?.dailyGoalMinutes,
      15,
      720,
      req.user.dailyGoalMinutes
    );

    const updated = await dbStore.users.updateById(req.user._id, {
      name: name || req.user.name,
      major: major || req.user.major,
      university,
      dailyGoalMinutes,
    });

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Profile update failed.' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || newPassword.length < 8) {
      res.status(400).json({
        error: 'Current password and a new password of at least 8 characters are required.',
      });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const nextTokenVersion = (req.user.tokenVersion ?? 0) + 1;
    const updated =
      (await dbStore.users.updateById(req.user._id, {
        passwordHash,
        tokenVersion: nextTokenVersion,
      })) || { ...req.user, tokenVersion: nextTokenVersion };
    const token = signAuthToken(updated);
    res.json({ message: 'Password updated successfully.', token });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Password update failed.' });
  }
}
