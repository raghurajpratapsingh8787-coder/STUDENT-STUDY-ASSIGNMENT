import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  CalendarClock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  NotebookPen,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavSection =
  | 'dashboard'
  | 'chat'
  | 'pdfs'
  | 'quizzes'
  | 'notes'
  | 'planner'
  | 'profile'
  | 'admin';

interface SidebarProps {
  active: NavSection;
  onSelect: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const DEFAULT_AVATAR = '/src/assets/images/avatar_student_default_1795507548176.jpg';

export function Sidebar({ active, onSelect, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const navItems: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'chat', label: 'AI Tutor', icon: MessageSquareText },
    { id: 'pdfs', label: 'PDF Studio', icon: FileText },
    { id: 'quizzes', label: 'Quiz Lab', icon: GraduationCap },
    { id: 'notes', label: 'Notes Library', icon: NotebookPen },
    { id: 'planner', label: 'Study Planner', icon: CalendarClock },
    { id: 'profile', label: 'Profile & Goals', icon: UserCog },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Console', icon: ShieldCheck });
  }

  const initials = (user?.name || 'ST')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64">
      <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-display truncate">
            Student Study Assistant
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id);
                onCloseMobile();
              }}
              className={`relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-item"
                  transition={{ type: 'spring', stiffness: 460, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-950/60"
                />
              )}
              <Icon className="relative z-10 w-4 h-4 shrink-0" />
              <span className="relative z-10 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center gap-3 px-2 py-1.5">
          {!avatarFailed ? (
            <img
              src={user?.avatarUrl || DEFAULT_AVATAR}
              alt={user?.name || 'Student avatar'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.role === 'admin' ? 'Administrator' : user?.major || 'Student'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
              onClick={onCloseMobile}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-50 h-full"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
