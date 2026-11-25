import { Router } from 'express';
import {
  adminDeleteDocument,
  deleteUserAccount,
  getAdminOverview,
  listAllDocuments,
  listUsers,
  updateUserAccount,
} from '../controllers/adminController.ts';
import { requireAdmin, requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', listUsers);
router.patch('/users/:id', updateUserAccount);
router.delete('/users/:id', deleteUserAccount);
router.get('/documents', listAllDocuments);
router.delete('/documents/:id', adminDeleteDocument);

export default router;
