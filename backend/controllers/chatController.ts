import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { ChatMode } from '../models/Chat.ts';
import { AiServiceError, askStudyAssistant } from '../services/geminiService.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString } from '../utils/validation.ts';

export async function listChats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    const chats = await dbStore.chats.findByUser(req.user._id);
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load chats.' });
  }
}

export async function createChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const subject = asCleanString(req.body?.subject, 80) || 'General';
    const title = asCleanString(req.body?.title, 160) || `${subject} Study Session`;
    const mode: ChatMode = req.body?.mode === 'beginner' ? 'beginner' : 'detailed';
    const documentId =
      typeof req.body?.documentId === 'string' && req.body.documentId.trim()
        ? req.body.documentId.trim()
        : null;

    if (documentId) {
      const doc = await dbStore.documents.findByIdAndUser(documentId, req.user._id);
      if (!doc) {
        res.status(404).json({ error: 'Referenced PDF document not found.' });
        return;
      }
    }

    const chat = await dbStore.chats.create({
      userId: req.user._id,
      title,
      subject,
      mode,
      documentId,
    });

    res.status(201).json({ chat });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create chat.' });
  }
}

export async function getChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const chatId = String(req.params.id || '');
    const chat = await dbStore.chats.findByIdAndUser(chatId, req.user._id);
    if (!chat) {
      res.status(404).json({ error: 'Chat conversation not found.' });
      return;
    }

    const messages = await dbStore.messages.findByChat(chat._id);
    res.json({ chat, messages });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load messages.' });
  }
}

export async function sendChatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const chatId = String(req.params.id || '');
    const chat = await dbStore.chats.findByIdAndUser(chatId, req.user._id);
    if (!chat) {
      res.status(404).json({ error: 'Chat conversation not found.' });
      return;
    }

    const content = asCleanString(req.body?.content, 4000);
    if (!content) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    const mode: ChatMode =
      req.body?.mode === 'beginner' || req.body?.mode === 'detailed'
        ? req.body.mode
        : chat.mode;

    const history = await dbStore.messages.findByChat(chat._id);
    let documentContext: string | undefined;
    if (chat.documentId) {
      const doc = await dbStore.documents.findByIdAndUser(chat.documentId, req.user._id);
      if (doc) {
        documentContext = doc.extractedText;
      }
    }

    const replyText = await askStudyAssistant({
      history: history.map((m) => ({ role: m.role, content: m.content })),
      message: content,
      subject: chat.subject,
      mode,
      documentContext,
    });

    const userMessage = await dbStore.messages.create({
      chatId: chat._id,
      userId: req.user._id,
      role: 'user',
      content,
    });

    const assistantMessage = await dbStore.messages.create({
      chatId: chat._id,
      userId: req.user._id,
      role: 'assistant',
      content: replyText,
    });

    const updatedTitle =
      history.length === 0 ? content.slice(0, 60) + (content.length > 60 ? '...' : '') : chat.title;
    await dbStore.chats.touch(chat._id, { title: updatedTitle, mode });

    res.status(201).json({
      userMessage,
      assistantMessage,
      chatTitle: updatedTitle,
    });
  } catch (err) {
    if (err instanceof AiServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send message.' });
  }
}

export async function clearChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const chatId = String(req.params.id || '');
    const chat = await dbStore.chats.findByIdAndUser(chatId, req.user._id);
    if (!chat) {
      res.status(404).json({ error: 'Chat conversation not found.' });
      return;
    }

    await dbStore.messages.deleteByChat(chat._id, req.user._id);
    await dbStore.chats.touch(chat._id);
    res.json({ message: 'Chat history cleared.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to clear chat.' });
  }
}

export async function deleteChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const chatId = String(req.params.id || '');
    const deleted = await dbStore.chats.deleteByIdAndUser(chatId, req.user._id);
    if (!deleted) {
      res.status(404).json({ error: 'Chat conversation not found.' });
      return;
    }
    res.json({ message: 'Conversation deleted.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete chat.' });
  }
}
