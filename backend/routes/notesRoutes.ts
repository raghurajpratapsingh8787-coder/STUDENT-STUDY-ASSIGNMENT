import { Router } from 'express';
import {
  deleteNote,
  downloadNotePdf,
  generateNotes,
  listNotes,
} from '../controllers/notesController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../middleware/rateLimiter.ts';

const router = Router();
router.use(requireAuth);

router.get('/', listNotes);
router.post('/generate', aiLimiter, generateNotes);
router.get('/:id/download', downloadNotePdf);
router.delete('/:id', deleteNote);

export default router;
