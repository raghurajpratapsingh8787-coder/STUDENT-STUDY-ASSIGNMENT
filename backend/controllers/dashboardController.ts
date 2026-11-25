import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { dbStore } from '../utils/store.ts';

interface ActivityItem {
  id: string;
  type: 'pdf' | 'notes' | 'quiz' | 'task' | 'chat';
  title: string;
  detail: string;
  timestamp: string;
}

export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    const userId = req.user._id;

    const [documents, notes, quizResults, tasks, chats] = await Promise.all([
      dbStore.documents.findByUser(userId),
      dbStore.notes.findByUser(userId),
      dbStore.quizResults.findByUser(userId),
      dbStore.studyTasks.findByUser(userId),
      dbStore.chats.findByUser(userId),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => t.scheduledDate === todayStr);
    const completedTodayMinutes = todayTasks
      .filter((t) => t.completed)
      .reduce((sum, t) => sum + t.durationMinutes, 0);

    const completedTasksCount = tasks.filter((t) => t.completed).length;
    const studyProgressPercent =
      tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

    const avgQuizScore =
      quizResults.length > 0
        ? Math.round(
            quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length
          )
        : 0;

    const quizTrend = [...quizResults]
      .slice(0, 8)
      .reverse()
      .map((r) => ({
        label: r.quizTitle.slice(0, 20),
        percentage: r.percentage,
        difficulty: r.difficulty,
        date: new Date(r.completedAt).toLocaleDateString(),
      }));

    const activities: ActivityItem[] = [
      ...documents.slice(0, 5).map((d) => ({
        id: `doc-${d._id}`,
        type: 'pdf' as const,
        title: d.title,
        detail: `${d.subject} · ${d.pageCount} pages`,
        timestamp: new Date(d.createdAt).toISOString(),
      })),
      ...notes.slice(0, 5).map((n) => ({
        id: `note-${n._id}`,
        type: 'notes' as const,
        title: n.title,
        detail: `${n.subject} · ${n.noteType.replace('_', ' ')}`,
        timestamp: new Date(n.createdAt).toISOString(),
      })),
      ...quizResults.slice(0, 5).map((q) => ({
        id: `quiz-${q._id}`,
        type: 'quiz' as const,
        title: q.quizTitle,
        detail: `${q.score}/${q.totalQuestions} (${q.percentage}%) · ${q.difficulty}`,
        timestamp: new Date(q.completedAt).toISOString(),
      })),
      ...tasks
        .filter((t) => t.completed && t.completedAt)
        .slice(0, 5)
        .map((t) => ({
          id: `task-${t._id}`,
          type: 'task' as const,
          title: t.topic,
          detail: `${t.subject} · ${t.durationMinutes} min completed`,
          timestamp: new Date(t.completedAt || t.updatedAt).toISOString(),
        })),
      ...chats.slice(0, 4).map((c) => ({
        id: `chat-${c._id}`,
        type: 'chat' as const,
        title: c.title,
        detail: `${c.subject} · ${c.mode === 'beginner' ? 'Beginner mode' : 'Detailed mode'}`,
        timestamp: new Date(c.updatedAt).toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const upcomingTasks = tasks
      .filter((t) => !t.completed)
      .slice(0, 5);

    res.json({
      stats: {
        totalPdfs: documents.length,
        totalNotes: notes.length,
        totalQuizzesTaken: quizResults.length,
        avgQuizScore,
        completedTasksCount,
        totalTasksCount: tasks.length,
        studyProgressPercent,
        dailyGoalMinutes: req.user.dailyGoalMinutes,
        completedTodayMinutes,
      },
      quizTrend,
      activities,
      upcomingTasks,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Dashboard load failed.' });
  }
}
