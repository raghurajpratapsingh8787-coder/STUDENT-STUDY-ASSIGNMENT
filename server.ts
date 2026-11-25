import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { connectDatabase } from './backend/config/db.ts';
import { env } from './backend/config/env.ts';
import { generalLimiter } from './backend/middleware/rateLimiter.ts';
import adminRoutes from './backend/routes/adminRoutes.ts';
import authRoutes from './backend/routes/authRoutes.ts';
import chatRoutes from './backend/routes/chatRoutes.ts';
import dashboardRoutes from './backend/routes/dashboardRoutes.ts';
import documentRoutes from './backend/routes/documentRoutes.ts';
import notesRoutes from './backend/routes/notesRoutes.ts';
import plannerRoutes from './backend/routes/plannerRoutes.ts';
import quizRoutes from './backend/routes/quizRoutes.ts';

async function startServer() {
  const dbMode = await connectDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Basic security headers (avoid X-Frame-Options so AI Studio iframe preview works cleanly)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', generalLimiter);

  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(
      (process.env.GEMINI_API_KEY || env.geminiApiKey) &&
        (process.env.GEMINI_API_KEY || env.geminiApiKey) !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      status: 'ok',
      database: dbMode,
      aiConfigured: hasGeminiKey,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/notes', notesRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/planner', plannerRoutes);
  app.use('/api/admin', adminRoutes);

  // Centralized API error handler
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'PDF file exceeds the 15 MB size limit.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    if (req.path.startsWith('/api')) {
      const message = err instanceof Error ? err.message : 'Internal server error.';
      res.status(400).json({ error: message });
      return;
    }

    next(err);
  });

  const isProd = env.nodeEnv === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.info(`[Student Study Assistant] Server listening on http://0.0.0.0:${env.port} (${dbMode})`);
  });
}

startServer().catch((err) => {
  console.error('[Student Study Assistant] Failed to start server:', err);
  process.exit(1);
});
