import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { NavSection } from './Sidebar';

interface HeaderProps {
  active: NavSection;
  onOpenMobile: () => void;
  onNavigate: (section: NavSection) => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Student Overview',
  chat: 'AI Tutor',
  pdfs: 'PDF Study Studio',
  quizzes: 'AI Quiz Lab',
  notes: 'AI Notes Library',
  planner: 'Study Planner',
  profile: 'Profile & Study Goals',
  admin: 'Admin Console',
};

export function Header({ active, onOpenMobile, onNavigate }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
            Student Study Assistant
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
            {SECTION_LABELS[active]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {active !== 'pdfs' && (
          <button
            type="button"
            onClick={() => onNavigate('pdfs')}
            className="inline-flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Upload PDF
          </button>
        )}
      </div>
    </header>
  );
}
