import { useEffect, useState, type FormEvent } from 'react';
import { CalendarPlus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { SkeletonRows } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { StudyTask } from '../types';

type FilterTab = 'all' | 'upcoming' | 'completed';

export function StudyPlannerPage() {
  const { notify } = useToast();

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [creating, setCreating] = useState(false);

  const [subject, setSubject] = useState('Mathematics');
  const [topic, setTopic] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [goalNote, setGoalNote] = useState('');

  useEffect(() => {
    let mounted = true;
    apiRequest<{ tasks: StudyTask[] }>('/api/planner/tasks')
      .then((res) => {
        if (mounted) setTasks(res.tasks);
      })
      .catch((err) => {
        if (mounted) {
          notify(err instanceof Error ? err.message : 'Could not load study planner.', 'error');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !subject.trim()) {
      notify('Subject and topic are required.', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await apiRequest<{ task: StudyTask }>('/api/planner/tasks', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim(),
          scheduledDate,
          startTime,
          durationMinutes,
          priority,
          goalNote: goalNote.trim(),
        }),
      });
      setTasks((prev) =>
        [...prev, res.task].sort((a, b) =>
          `${a.scheduledDate} ${a.startTime}`.localeCompare(`${b.scheduledDate} ${b.startTime}`)
        )
      );
      setTopic('');
      setGoalNote('');
      notify('Study session scheduled.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create task.', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleComplete(task: StudyTask) {
    try {
      const res = await apiRequest<{ task: StudyTask }>(`/api/planner/tasks/${task._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? res.task : t)));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiRequest(`/api/planner/tasks/${id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t._id !== id));
      notify('Task removed from schedule.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const completedMinutes = tasks
    .filter((t) => t.completed)
    .reduce((sum, t) => sum + t.durationMinutes, 0);
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const visibleTasks = tasks.filter((t) => {
    if (filter === 'upcoming') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Schedule &amp; Study Progress
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {completedCount} of {tasks.length} tasks completed · {completedMinutes} / {totalMinutes}{' '}
            planned minutes
          </p>
        </div>
        <div className="w-full md:w-72 space-y-1.5">
          <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span>Completion Rate</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Task Form */}
        <form
          onSubmit={handleCreate}
          className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 h-fit"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Add Study Task
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Linear Algebra"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Topic / Assignment
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Eigenvalues Practice Set"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Duration (min)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Study Goal Note (Optional)
            </label>
            <input
              type="text"
              value={goalNote}
              onChange={(e) => setGoalNote(e.target.value)}
              placeholder="e.g. Complete 12 proofs without hints"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>{creating ? 'Scheduling...' : 'Add to Schedule'}</span>
          </button>
        </form>

        {/* Task List */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Study Schedule
            </h3>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(['all', 'upcoming', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    filter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonRows count={5} />
          ) : visibleTasks.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">
              No study tasks in this view. Schedule a session on the left.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {visibleTasks.map((task) => (
                <div
                  key={task._id}
                  className="py-3.5 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleComplete(task)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
                      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.topic}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {task.subject} · {task.scheduledDate} at {task.startTime} ·{' '}
                        {task.durationMinutes} min · {task.priority} priority
                      </p>
                      {task.goalNote && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Goal: {task.goalNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(task._id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                    aria-label="Delete study task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
