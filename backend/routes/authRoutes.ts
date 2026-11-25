import { Router } from 'express';
import {
  changePassword,
  claimAdminWorkspace,
  confirmPasswordReset,
  getAdminSetupStatus,
  getMe,
  login,
  register,
  requestPasswordReset,
  updateProfile,
} from '../controllers/authController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { authLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

router.get('/admin-status', getAdminSetupStatus);
router.post('/claim-admin', authLimiter, claimAdminWorkspace);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, confirmPasswordReset);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.put('/password', requireAuth, changePassword);

export default router;
