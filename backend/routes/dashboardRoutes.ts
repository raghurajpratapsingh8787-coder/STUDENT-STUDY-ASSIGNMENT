import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);
router.get('/stats', getDashboardStats);

export default router;
