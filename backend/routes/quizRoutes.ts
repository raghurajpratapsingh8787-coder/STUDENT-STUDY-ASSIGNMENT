import { Router } from 'express';
import {
  deleteQuiz,
  generateQuiz,
  listQuizzes,
  submitQuiz,
} from '../controllers/quizController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../middleware/rateLimiter.ts';

const router = Router();
router.use(requireAuth);

router.get('/', listQuizzes);
router.post('/generate', aiLimiter, generateQuiz);
router.post('/:id/submit', submitQuiz);
router.delete('/:id', deleteQuiz);

export default router;
