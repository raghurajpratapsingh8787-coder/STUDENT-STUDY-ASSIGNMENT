import { Router } from 'express';
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../controllers/plannerController.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

export default router;
