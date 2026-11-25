import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { TaskPriority } from '../models/StudyTask.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString, asPositiveInt } from '../utils/validation.ts';

export async function listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    const tasks = await dbStore.studyTasks.findByUser(req.user._id);
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load tasks.' });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const subject = asCleanString(req.body?.subject, 80);
    const topic = asCleanString(req.body?.topic, 200);
    const scheduledDate = asCleanString(req.body?.scheduledDate, 20) || new Date().toISOString().slice(0, 10);
    const startTime = asCleanString(req.body?.startTime, 10) || '09:00';
    const durationMinutes = asPositiveInt(req.body?.durationMinutes, 5, 480, 45);
    const priority: TaskPriority =
      req.body?.priority === 'High' || req.body?.priority === 'Low'
        ? req.body.priority
        : 'Medium';
    const goalNote = asCleanString(req.body?.goalNote, 400);

    if (!subject || !topic) {
      res.status(400).json({ error: 'Subject and topic are required.' });
      return;
    }

    const task = await dbStore.studyTasks.create({
      userId: req.user._id,
      subject,
      topic,
      scheduledDate,
      startTime,
      durationMinutes,
      priority,
      goalNote,
      completed: false,
      completedAt: null,
    });

    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create task.' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const taskId = String(req.params.id || '');
    const patch: Record<string, unknown> = {};

    if (typeof req.body?.completed === 'boolean') {
      patch.completed = req.body.completed;
      patch.completedAt = req.body.completed ? new Date() : null;
    }
    if (typeof req.body?.subject === 'string' && req.body.subject.trim()) {
      patch.subject = asCleanString(req.body.subject, 80);
    }
    if (typeof req.body?.topic === 'string' && req.body.topic.trim()) {
      patch.topic = asCleanString(req.body.topic, 200);
    }
    if (typeof req.body?.scheduledDate === 'string' && req.body.scheduledDate.trim()) {
      patch.scheduledDate = asCleanString(req.body.scheduledDate, 20);
    }
    if (typeof req.body?.startTime === 'string' && req.body.startTime.trim()) {
      patch.startTime = asCleanString(req.body.startTime, 10);
    }
    if (req.body?.durationMinutes !== undefined) {
      patch.durationMinutes = asPositiveInt(req.body.durationMinutes, 5, 480, 45);
    }
    if (req.body?.priority === 'Low' || req.body?.priority === 'Medium' || req.body?.priority === 'High') {
      patch.priority = req.body.priority;
    }
    if (typeof req.body?.goalNote === 'string') {
      patch.goalNote = asCleanString(req.body.goalNote, 400);
    }

    const updated = await dbStore.studyTasks.updateByIdAndUser(taskId, req.user._id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Study task not found.' });
      return;
    }

    res.json({ task: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update task.' });
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const deleted = await dbStore.studyTasks.deleteByIdAndUser(
      String(req.params.id || ''),
      req.user._id
    );
    if (!deleted) {
      res.status(404).json({ error: 'Study task not found.' });
      return;
    }

    res.json({ message: 'Task removed.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete task.' });
  }
}
