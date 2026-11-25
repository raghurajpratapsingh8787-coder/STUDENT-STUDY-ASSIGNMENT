import crypto from 'crypto';
import fs from 'fs';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { dbStore } from '../utils/store.ts';
import { resolveSafeUploadPath } from '../utils/validation.ts';

export async function getAdminOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [users, documents, notesCount, quizzesCount, resultsCount, chatsCount] =
      await Promise.all([
        dbStore.users.findAll(),
        dbStore.documents.findAll(),
        dbStore.notes.countAll(),
        dbStore.quizzes.countAll(),
        dbStore.quizResults.countAll(),
        dbStore.chats.countAll(),
      ]);

    const students = users.filter((u) => u.role === 'student');
    const activeStudents = students.filter((u) => u.isActive);

    const recentActivity = [
      ...users.slice(0, 6).map((u) => ({
        id: `user-${u._id}`,
        event: u.role === 'admin' ? 'Admin workspace active' : 'Student registered',
        actor: u.name,
        detail: `${u.email} · ${u.major}`,
        timestamp: new Date(u.createdAt).toISOString(),
      })),
      ...documents.slice(0, 6).map((d) => {
        const owner = users.find((u) => u._id === d.userId);
        return {
          id: `doc-${d._id}`,
          event: 'PDF uploaded',
          actor: owner ? owner.name : 'Student',
          detail: `${d.title} (${d.pageCount} pages)`,
          timestamp: new Date(d.createdAt).toISOString(),
        };
      }),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);

    res.json({
      metrics: {
        totalStudents: students.length,
        activeStudents: activeStudents.length,
        totalUsers: users.length,
        totalDocuments: documents.length,
        totalNotes: notesCount,
        totalQuizzes: quizzesCount,
        totalQuizSubmissions: resultsCount,
        totalChats: chatsCount,
      },
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Admin overview failed.' });
  }
}

export async function listUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await dbStore.users.findAll();
    const safeUsers = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      major: u.major,
      university: u.university,
      isActive: u.isActive,
      resetRequestedAt: u.resetRequestedAt || null,
      lastActiveAt: u.lastActiveAt,
      createdAt: u.createdAt,
    }));
    res.json({ users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch users.' });
  }
}

export async function updateUserAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const targetId = String(req.params.id || '');
    const target = await dbStore.users.findById(targetId);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (req.user && target._id === req.user._id && req.body?.isActive === false) {
      res.status(400).json({ error: 'You cannot suspend your own administrator account.' });
      return;
    }

    const patch: Record<string, unknown> = {};
    let shouldRevokeSessions = false;

    if (typeof req.body?.isActive === 'boolean') {
      patch.isActive = req.body.isActive;
      if (req.body.isActive === false) {
        shouldRevokeSessions = true;
      }
    }
    if (req.body?.role === 'student' || req.body?.role === 'admin') {
      if (req.user && target._id === req.user._id && req.body.role !== 'admin') {
        res.status(400).json({ error: 'You cannot revoke your own administrator role.' });
        return;
      }
      if (req.body.role !== target.role) {
        shouldRevokeSessions = true;
      }
      patch.role = req.body.role;
    }

    if (shouldRevokeSessions) {
      patch.tokenVersion = (target.tokenVersion ?? 0) + 1;
    }

    let issuedResetCode: string | undefined;
    if (req.body?.issueResetCode === true) {
      issuedResetCode = crypto.randomBytes(6).toString('hex').toUpperCase();
      patch.resetTokenHash = crypto.createHash('sha256').update(issuedResetCode).digest('hex');
      patch.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    }

    const updated = await dbStore.users.updateById(targetId, patch);
    if (!updated) {
      res.status(404).json({ error: 'User update failed.' });
      return;
    }

    res.json({
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        major: updated.major,
        university: updated.university,
        isActive: updated.isActive,
        resetRequestedAt: updated.resetRequestedAt || null,
        lastActiveAt: updated.lastActiveAt,
        createdAt: updated.createdAt,
      },
      issuedResetCode,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user.' });
  }
}

export async function deleteUserAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const targetId = String(req.params.id || '');
    if (req.user && targetId === req.user._id) {
      res.status(400).json({ error: 'You cannot delete your own administrator account.' });
      return;
    }

    const deleted = await dbStore.users.deleteById(targetId);
    if (!deleted) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const storedFilenames = await dbStore.users.purgeOwnedData(targetId);
    for (const filename of storedFilenames) {
      const safePath = resolveSafeUploadPath(filename);
      if (safePath && fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
      }
    }

    res.json({ message: 'User account and associated study data deleted.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete user.' });
  }
}

export async function listAllDocuments(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [documents, users] = await Promise.all([
      dbStore.documents.findAll(),
      dbStore.users.findAll(),
    ]);

    const userMap = new Map(users.map((u) => [u._id, u]));
    const formatted = documents.map((d) => {
      const owner = userMap.get(d.userId);
      return {
        _id: d._id,
        title: d.title,
        originalName: d.originalName,
        subject: d.subject,
        fileSize: d.fileSize,
        pageCount: d.pageCount,
        ownerName: owner?.name || 'Unknown Student',
        ownerEmail: owner?.email || '',
        createdAt: d.createdAt,
      };
    });

    res.json({ documents: formatted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch documents.' });
  }
}

export async function adminDeleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const removed = await dbStore.documents.deleteById(String(req.params.id || ''));
    if (!removed) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    const safePath = resolveSafeUploadPath(removed.storedFilename);
    if (safePath && fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
    res.json({ message: 'Document removed by administrator.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete document.' });
  }
}
