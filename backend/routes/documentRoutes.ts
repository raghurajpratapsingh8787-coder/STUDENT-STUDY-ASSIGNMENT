import { Router } from 'express';
import {
  analyzeDocument,
  deleteDocument,
  downloadDocumentNotes,
  getDocumentById,
  listDocuments,
  uploadPdf,
} from '../controllers/documentController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../middleware/rateLimiter.ts';
import { pdfUpload } from '../middleware/upload.ts';

const router = Router();
router.use(requireAuth);

router.get('/', listDocuments);
router.post('/upload', pdfUpload.single('file'), uploadPdf);
router.get('/:id', getDocumentById);
router.post('/:id/analyze', aiLimiter, analyzeDocument);
router.get('/:id/download-notes', downloadDocumentNotes);
router.delete('/:id', deleteDocument);

export default router;
