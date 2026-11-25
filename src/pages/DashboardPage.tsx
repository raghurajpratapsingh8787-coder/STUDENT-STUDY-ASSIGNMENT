import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  GraduationCap,
  MessageSquareText,
  NotebookPen,
} from 'lucide-react';
import { SkeletonCard, SkeletonRows } from '../components/Skeleton';
import type { NavSection } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { ActivityItem, DashboardStats, QuizTrendItem, StudyTask } from '../types';

interface DashboardResponse {
  stats: DashboardStats;
  quizTrend: QuizTrendItem[];
  activities: ActivityItem[];
  upcomingTasks: StudyTask[];
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function DashboardPage({ onNavigate }: { onNavigate: (section: NavSection) => void }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<DashboardResponse>('/api/dashboard/stats')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          notify(err instanceof Error ? err.message : 'Could not load dashboard.', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notify]);

  const stats = data?.stats;
  const goalPct = stats
    ? Math.min(100, Math.round((stats.completedTodayMinutes / Math.max(1, stats.dailyGoalMinutes)) * 100))
    : 0;

  const metricCards = [
    {
      id: 'pdfs' as const,
      label: 'Uploaded PDFs',
      value: stats?.totalPdfs ?? 0,
      sub: 'Parsed & indexed for study',
      icon: FileText,
    },
    {
      id: 'notes' as const,
      label: 'Generated Notes',
      value: stats?.totalNotes ?? 0,
      sub: 'Ready to review or export',
      icon: NotebookPen,
    },
    {
      id: 'quizzes' as const,
      label: 'Quiz Performance',
      value: `${stats?.avgQuizScore ?? 0}%`,
      sub: `Across ${stats?.totalQuizzesTaken ?? 0} completed quizzes`,
      icon: GraduationCap,
    },
    {
      id: 'planner' as const,
      label: 'Study Progress',
      value: `${stats?.studyProgressPercent ?? 0}%`,
      sub: `${stats?.completedTasksCount ?? 0} of ${stats?.totalTasksCount ?? 0} tasks done`,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner + Daily Study Goal */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
      >
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back, {user?.name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {user?.major || 'General Studies'}
            {user?.university ? ` · ${user.university}` : ''} · Daily target{' '}
            <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200">
              {stats?.dailyGoalMinutes ?? user?.dailyGoalMinutes ?? 90} min
            </span>
          </p>
        </div>

        <div className="w-full lg:w-80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Today&apos;s Study Goal
            </span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {stats?.completedTodayMinutes ?? 0} / {stats?.dailyGoalMinutes ?? 90} min ({goalPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: goalPct / 100 }}
              transition={{ duration: 0.7, delay: 0.15, ease: EASE_OUT_EXPO }}
              style={{ transformOrigin: 'left' }}
              className="h-full w-full bg-indigo-600 dark:bg-indigo-500"
            />
          </div>
        </div>
      </motion.div>

      {/* 4-Column Metric Strip */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metricCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 + idx * 0.05, ease: EASE_OUT_EXPO }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onNavigate(card.id)}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{card.label}</span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <p className="mt-2.5 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {card.sub}
                </p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Middle Analytical Grid: Quiz Performance Trend + Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quiz Score Trend Chart */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: EASE_OUT_EXPO }}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Quiz Performance History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Score percentage across your most recent assessments
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('quizzes')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              Open Quiz Lab
            </button>
          </div>

          {loading ? (
            <SkeletonRows count={4} />
          ) : data?.quizTrend && data.quizTrend.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 flex items-end gap-3 pt-4 border-b border-slate-200 dark:border-slate-800">
                {data.quizTrend.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.25 + idx * 0.06 }}
                      className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300"
                    >
                      {item.percentage}%
                    </motion.span>
                    <div className="w-full max-w-[44px] h-28 flex items-end bg-slate-100 dark:bg-slate-800/70 rounded-t-md overflow-hidden">
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{
                          duration: 0.55,
                          delay: 0.2 + idx * 0.06,
                          ease: EASE_OUT_EXPO,
                        }}
                        style={{
                          height: `${Math.max(8, item.percentage)}%`,
                          transformOrigin: 'bottom',
                        }}
                        className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t-md"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                {data.quizTrend.map((item, idx) => (
                  <div key={idx} className="flex-1 min-w-0 text-center">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {item.difficulty}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No quiz attempts recorded yet. Generate your first quiz from a topic or PDF.
              </p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('quizzes')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-medium transition-colors"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Create First Quiz</span>
              </motion.button>
            </div>
          )}
        </motion.section>

        {/* Upcoming Tasks */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24, ease: EASE_OUT_EXPO }}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Study Tasks
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Next scheduled focus blocks
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              Manage Planner
            </button>
          </div>

          {loading ? (
            <SkeletonRows count={4} />
          ) : data?.upcomingTasks && data.upcomingTasks.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1">
              {data.upcomingTasks.map((task, idx) => (
                <motion.div
                  key={task._id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.28 + idx * 0.04, ease: EASE_OUT_EXPO }}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {task.topic}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {task.subject} · {task.scheduledDate} at {task.startTime} · {task.priority}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                    {task.durationMinutes}m
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center space-y-3 my-auto">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your study queue is clear. Plan a focused session to stay on track.
              </p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('planner')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <CalendarClock className="w-4 h-4" />
                <span>Add Study Task</span>
              </motion.button>
            </div>
          )}
        </motion.section>
      </div>

      {/* Bottom Row: Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: EASE_OUT_EXPO }}
          className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Recent Activities
          </h2>

          {loading ? (
            <SkeletonRows count={5} />
          ) : data?.activities && data.activities.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {data.activities.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.32 + idx * 0.035, ease: EASE_OUT_EXPO }}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.type.toUpperCase()} · {item.detail}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6">
              Activity will appear here as you upload PDFs, generate notes, take quizzes, or chat
              with the AI Tutor.
            </p>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34, ease: EASE_OUT_EXPO }}
          className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Quick Workflows
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jump straight into your study tools
          </p>
          <div className="pt-2 space-y-2">
            {(
              [
                { id: 'chat', label: 'Ask AI Tutor', icon: MessageSquareText },
                { id: 'pdfs', label: 'Analyze a PDF', icon: FileText },
                { id: 'notes', label: 'Generate Revision Notes', icon: NotebookPen },
              ] as const
            ).map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  type="button"
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onNavigate(action.id)}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{action.label}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
