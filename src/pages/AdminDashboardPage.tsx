import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Key, Search, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { SkeletonCard, SkeletonRows } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AdminDocumentItem, AdminUserItem } from '../types';

interface AdminOverviewResponse {
  metrics: {
    totalStudents: number;
    activeStudents: number;
    totalUsers: number;
    totalDocuments: number;
    totalNotes: number;
    totalQuizzes: number;
    totalQuizSubmissions: number;
    totalChats: number;
  };
  recentActivity: Array<{
    id: string;
    event: string;
    actor: string;
    detail: string;
    timestamp: string;
  }>;
}

type AdminTab = 'users' | 'documents' | 'activity';
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function AdminDashboardPage() {
  const { notify } = useToast();

  const [tab, setTab] = useState<AdminTab>('users');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [documents, setDocuments] = useState<AdminDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [issuedCodeBanner, setIssuedCodeBanner] = useState<{
    email: string;
    code: string;
  } | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, usersRes, docsRes] = await Promise.all([
        apiRequest<AdminOverviewResponse>('/api/admin/overview'),
        apiRequest<{ users: AdminUserItem[] }>('/api/admin/users'),
        apiRequest<{ documents: AdminDocumentItem[] }>('/api/admin/documents'),
      ]);
      setOverview(ovRes);
      setUsers(usersRes.users);
      setDocuments(docsRes.documents);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load admin console.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function toggleUserActive(u: AdminUserItem) {
    try {
      const res = await apiRequest<{ user: AdminUserItem }>(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      setUsers((prev) => prev.map((item) => (item.id === u.id ? res.user : item)));
      notify(
        `${res.user.name} is now ${res.user.isActive ? 'active' : 'suspended'}.`,
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update user.', 'error');
    }
  }

  async function toggleUserRole(u: AdminUserItem) {
    const nextRole = u.role === 'admin' ? 'student' : 'admin';
    try {
      const res = await apiRequest<{ user: AdminUserItem }>(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers((prev) => prev.map((item) => (item.id === u.id ? res.user : item)));
      notify(`Updated ${res.user.name} role to ${nextRole}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update role.', 'error');
    }
  }

  async function issueResetCode(u: AdminUserItem) {
    try {
      const res = await apiRequest<{ user: AdminUserItem; issuedResetCode?: string }>(
        `/api/admin/users/${u.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ issueResetCode: true }),
        }
      );
      if (res.issuedResetCode) {
        setIssuedCodeBanner({ email: u.email, code: res.issuedResetCode });
        notify(`One-time reset code generated for ${u.email}.`, 'success');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not generate reset code.', 'error');
    }
  }

  async function deleteUser(u: AdminUserItem) {
    try {
      await apiRequest(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      setDocuments((prev) => prev.filter((d) => d.ownerEmail !== u.email));
      notify(`Removed account for ${u.email}.`, 'info');
      void loadAdminData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete user.', 'error');
    }
  }

  async function deleteDoc(doc: AdminDocumentItem) {
    try {
      await apiRequest(`/api/admin/documents/${doc._id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
      notify(`Deleted document "${doc.title}".`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete document.', 'error');
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.major.toLowerCase().includes(q)
    );
  });

  const filteredDocs = documents.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q) ||
      d.ownerName.toLowerCase().includes(q)
    );
  });

  const metrics = overview?.metrics;
  const adminMetricCards = [
    {
      label: 'Registered Students',
      value: metrics?.totalStudents ?? 0,
      sub: `${metrics?.activeStudents ?? 0} active accounts`,
    },
    {
      label: 'Uploaded Documents',
      value: metrics?.totalDocuments ?? 0,
      sub: 'Indexed study PDFs',
    },
    {
      label: 'AI Notes & Chats',
      value: (metrics?.totalNotes ?? 0) + (metrics?.totalChats ?? 0),
      sub: `${metrics?.totalNotes ?? 0} notes · ${metrics?.totalChats ?? 0} chats`,
    },
    {
      label: 'Quiz Submissions',
      value: metrics?.totalQuizSubmissions ?? 0,
      sub: `Across ${metrics?.totalQuizzes ?? 0} quiz sets`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Platform Metrics */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {adminMetricCards.map((card, idx) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {card.sub}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {issuedCodeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-xs text-slate-800 dark:text-slate-200">
              <span className="font-semibold">
                One-Time Reset Code for {issuedCodeBanner.email}:
              </span>{' '}
              <code className="font-mono font-semibold text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800">
                {issuedCodeBanner.code}
              </code>{' '}
              <span className="text-slate-500 dark:text-slate-400">(Valid for 30 minutes)</span>
            </div>
            <button
              type="button"
              onClick={() => setIssuedCodeBanner(null)}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Controls & Table */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16, ease: EASE_OUT_EXPO }}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
            {(
              [
                { id: 'users', label: `Users (${users.length})` },
                { id: 'documents', label: `Documents (${documents.length})` },
                { id: 'activity', label: 'Platform Activity' },
              ] as const
            ).map((item) => {
              const isSelected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="admin-tab-indicator"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-md bg-white dark:bg-slate-900 shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          {tab !== 'activity' && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'users' ? 'Search students...' : 'Search PDFs...'}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonRows count={5} />
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'users' ? (
              <motion.div
                key="users-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4 font-medium">Account</th>
                      <th className="py-2.5 px-3 font-medium">Major</th>
                      <th className="py-2.5 px-3 font-medium">Role</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 pl-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredUsers.map((u, idx) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.25) }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {u.email}
                            {u.resetRequestedAt ? ' · Reset requested' : ''}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{u.major}</td>
                        <td className="py-3 px-3 capitalize text-slate-700 dark:text-slate-300">
                          {u.role}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-medium ${
                              u.isActive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={() => issueResetCode(u)}
                              title="Issue one-time password reset code"
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={() => toggleUserRole(u)}
                              title="Toggle student / admin role"
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={() => toggleUserActive(u)}
                              title={u.isActive ? 'Suspend account' : 'Activate account'}
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {u.isActive ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={() => deleteUser(u)}
                              title="Delete account"
                              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            ) : tab === 'documents' ? (
              <motion.div
                key="documents-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              >
                {filteredDocs.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                    No uploaded documents match your filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 pr-4 font-medium">Document</th>
                          <th className="py-2.5 px-3 font-medium">Subject</th>
                          <th className="py-2.5 px-3 font-medium">Owner</th>
                          <th className="py-2.5 px-3 font-medium text-right">Pages</th>
                          <th className="py-2.5 pl-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredDocs.map((d, idx) => (
                          <motion.tr
                            key={d._id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.25) }}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {d.title}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {d.originalName}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                              {d.subject}
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                              {d.ownerName}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {d.pageCount}
                            </td>
                            <td className="py-3 pl-3 text-right">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.92 }}
                                onClick={() => deleteDoc(d)}
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                                aria-label="Remove document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="activity-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="divide-y divide-slate-100 dark:divide-slate-800/80"
              >
                {overview?.recentActivity.map((act, idx) => (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                    className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {act.event} · {act.actor}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">{act.detail}</p>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.section>
    </div>
  );
}
