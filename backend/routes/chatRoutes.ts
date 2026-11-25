import { Router } from 'express';
import {
  clearChatMessages,
  createChat,
  deleteChat,
  getChatMessages,
  listChats,
  sendChatMessage,
} from '../controllers/chatController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../middleware/rateLimiter.ts';

const router = Router();
router.use(requireAuth);

router.get('/', listChats);
router.post('/', createChat);
router.get('/:id', getChatMessages);
router.post('/:id/messages', aiLimiter, sendChatMessage);
router.delete('/:id/messages', clearChatMessages);
router.delete('/:id', deleteChat);

export default router;
