import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Lock,
  MessageSquareText,
  Moon,
  NotebookPen,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';

type AuthMode = 'login' | 'register' | 'reset' | 'claim-admin';

const HERO_CAMPUS_IMAGE = '/src/assets/images/scholara_hero_campus_1795580902160.jpg';
const DESK_IMAGE = '/src/assets/images/auth_study_workspace_1795507546574.jpg';
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface StoryChapter {
  index: string;
  kicker: string;
  title: string;
  description: string;
  highlights: string[];
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    index: '01',
    kicker: 'PDF Study Studio',
    title: 'Upload lecture slides or textbook chapters and extract clarity in seconds.',
    description:
      'Drop any text-based PDF up to 15 MB. Student Study Assistant parses every page on the server and builds structured executive summaries, chapter-by-chapter study notes, important exam questions, and plain-language breakdowns of difficult concepts.',
    highlights: [
      'Automatic text extraction across multi-page PDFs',
      'Four targeted AI study lenses per uploaded document',
      'Export complete study guides as formatted PDFs',
    ],
  },
  {
    index: '02',
    kicker: 'AI Tutor Chatbot',
    title: 'Ask academic questions with Beginner or Detailed rigor, grounded in your PDFs.',
    description:
      'Switch seamlessly between intuition-first Beginner explanations and comprehensive university-level derivations. Link any uploaded PDF to keep answers anchored in your actual course material.',
    highlights: [
      'Subject-wise conversation threads with saved history',
      'Instant toggle between Beginner and Detailed modes',
      'One-click follow-up prompts to test deeper understanding',
    ],
  },
  {
    index: '03',
    kicker: 'Quiz Lab & Notes Library',
    title: 'Turn passive reading into active recall with adaptive MCQ drills and revision sheets.',
    description:
      'Generate custom 4-option multiple-choice quizzes across Easy, Medium, and Hard difficulty levels with automatic grading and explanations. Compose short notes, definitions, key points, or full chapter summaries.',
    highlights: [
      'Server-checked scoring with question-by-question review',
      'Quiz performance history tracked on your dashboard',
      'Download any generated note collection as a clean PDF',
    ],
  },
  {
    index: '04',
    kicker: 'Study Planner & Admin Console',
    title: 'Schedule daily focus blocks, track study minutes, and govern the workspace.',
    description:
      'Students organize upcoming assignments by subject, priority, and duration to hit daily study targets. Administrators monitor platform activity, manage user accounts, issue reset codes, and moderate uploaded documents.',
    highlights: [
      'Daily study goal progress synced with completed tasks',
      'Role-based Admin Console for user and document oversight',
      'Protected by bcrypt password hashing and JWT sessions',
    ],
  },
];

export function AuthScreen() {
  const { login, register, claimAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [modalOpen, setModalOpen] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  const [hasEnvPasscode, setHasEnvPasscode] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);
  const [deskImgError, setDeskImgError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [major, setMajor] = useState('Computer Science');
  const [university, setUniversity] = useState('');
  const [passcode, setPasscode] = useState('');

  // Reset password fields
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Scroll-driven "animated video" refs & transforms
  const pageScroll = useScroll();
  const scrollProgress = useSpring(pageScroll.scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  const heroRef = useRef<HTMLElement | null>(null);
  const heroScroll = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroImageScale = useTransform(heroScroll.scrollYProgress, [0, 1], [1, 1.12]);
  const heroTextY = useTransform(heroScroll.scrollYProgress, [0, 1], [0, 56]);
  const heroTextOpacity = useTransform(heroScroll.scrollYProgress, [0, 0.75], [1, 0.15]);

  const reelRef = useRef<HTMLElement | null>(null);
  const reelScroll = useScroll({
    target: reelRef,
    offset: ['start start', 'end end'],
  });
  const [activeScene, setActiveScene] = useState(0);
  const reelProgress = useSpring(reelScroll.scrollYProgress, {
    stiffness: 240,
    damping: 30,
  });

  useMotionValueEvent(reelScroll.scrollYProgress, 'change', (latest) => {
    const idx = Math.min(3, Math.max(0, Math.floor(latest * 4)));
    setActiveScene((prev) => (prev !== idx ? idx : prev));
  });

  useEffect(() => {
    apiRequest<{ adminExists: boolean; hasEnvPasscode: boolean }>('/api/auth/admin-status')
      .then((res) => {
        setAdminExists(res.adminExists);
        setHasEnvPasscode(res.hasEnvPasscode);
      })
      .catch(() => {
        // Keep defaults
      });
  }, []);

  function openAuthModal(targetMode: AuthMode) {
    setMode(targetMode);
    setModalOpen(true);
  }

  function jumpToScene(index: number) {
    setActiveScene(index);
    if (!reelRef.current) return;
    const rect = reelRef.current.getBoundingClientRect();
    const docTop = window.scrollY + rect.top;
    const scrollable = Math.max(1, reelRef.current.offsetHeight - window.innerHeight);
    const targetY = docTop + (index / 4) * scrollable + 20;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        notify(`Welcome back, ${user.name}.`, 'success');
      } else if (mode === 'register') {
        const user = await register({ name, email, password, major, university });
        notify(`Account created. Welcome, ${user.name}.`, 'success');
      } else if (mode === 'claim-admin') {
        const user = await claimAdmin({ name, email, password, university, passcode });
        notify(`Administrator workspace initialized for ${user.name}.`, 'success');
      } else if (mode === 'reset') {
        if (resetStep === 'request') {
          const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
          });
          notify(res.message, 'info');
          setResetStep('confirm');
        } else {
          const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, resetCode, newPassword }),
          });
          notify(res.message, 'success');
          setMode('login');
          setResetStep('request');
          setResetCode('');
          setNewPassword('');
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Authentication failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const authTabs: Array<{ id: AuthMode; label: string }> = [
    { id: 'login', label: 'Sign In' },
    { id: 'register', label: 'Sign Up' },
    { id: 'reset', label: 'Forgot Password' },
    ...(!adminExists ? [{ id: 'claim-admin' as const, label: 'Claim Admin' }] : []),
  ];

  const renderAuthForm = (layoutGroup: string) => (
    <div className="w-full">
      <div className="mb-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
          >
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {mode === 'login' && 'Sign in to Student Study Assistant'}
              {mode === 'register' && 'Create your student account'}
              {mode === 'reset' && 'Reset your password'}
              {mode === 'claim-admin' && 'Initialize administrator workspace'}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {mode === 'login' && 'Access your PDFs, AI tutor sessions, notes, and quiz history.'}
              {mode === 'register' && 'Start organizing your coursework and AI study materials.'}
              {mode === 'reset' &&
                'Request a reset and apply a one-time code issued by an administrator.'}
              {mode === 'claim-admin' &&
                'No administrator exists yet. Claim the primary admin account below.'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 mb-5 rounded-lg bg-slate-100 dark:bg-slate-800">
        {authTabs.map((tabItem) => {
          const isSelected = mode === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setMode(tabItem.id)}
              className={`relative flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isSelected
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId={`auth-tab-${layoutGroup}`}
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="absolute inset-0 rounded-md bg-white dark:bg-slate-900 shadow-sm"
                />
              )}
              <span className="relative z-10">{tabItem.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.form
          key={`${mode}-${mode === 'reset' ? resetStep : 'main'}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
          onSubmit={handleSubmit}
          className="space-y-3.5"
        >
          {(mode === 'register' || mode === 'claim-admin') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Major / Track
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Computer Science"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  University
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {mode === 'claim-admin' && hasEnvPasscode && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Admin Setup Passcode
              </label>
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter configured ADMIN_PASSCODE"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'login' ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter password' : 'Minimum 8 characters'}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && resetStep === 'confirm' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  One-Time Reset Code
                </label>
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Code issued by administrator"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>
              {submitting
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'claim-admin'
                ? 'Initialize Admin Account'
                : resetStep === 'request'
                ? 'Request Password Reset'
                : 'Apply New Password'}
            </span>
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </motion.button>

          {mode === 'reset' && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() =>
                  setResetStep((prev) => (prev === 'request' ? 'confirm' : 'request'))
                }
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {resetStep === 'request'
                  ? 'Already have an admin-issued reset code? Enter it here'
                  : 'Back to reset request'}
              </button>
            </div>
          )}
        </motion.form>
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100">
      {/* Top Bar: Clean Wordmark on Left + Login & Sign Up Only on Right */}
      <header className="sticky top-0 z-40 h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="flex items-center gap-2 text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm sm:text-base font-semibold tracking-tight font-display">
              Student Study Assistant
            </span>
          </a>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openAuthModal('login')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Login
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => openAuthModal('register')}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Sign Up
            </motion.button>
          </div>
        </div>

        {/* Continuous Scroll Progress Line */}
        <motion.div
          style={{ scaleX: scrollProgress, transformOrigin: 'left' }}
          className="h-[2px] w-full bg-indigo-600 dark:bg-indigo-400"
        />
      </header>

      {/* Section 1: Hero Stage with Scroll Parallax */}
      <section
        id="top"
        ref={heroRef}
        className="relative min-h-[88vh] flex items-center overflow-hidden bg-slate-950"
      >
        {!heroImgError ? (
          <motion.img
            src={HERO_CAMPUS_IMAGE}
            alt="University study hall illuminated by afternoon sunlight"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            style={{ scale: heroImageScale }}
            initial={{ scale: 1.08, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.15, ease: EASE_OUT_EXPO }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/40" />

        <motion.div
          style={{ y: heroTextY, opacity: heroTextOpacity }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20"
        >
          <div className="max-w-3xl space-y-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
              className="text-xs font-medium tracking-wide text-indigo-300"
            >
              AI-Based Student Study Assistant
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.08] text-balance"
            >
              Read faster, understand deeper, and prepare for exams in one study workspace.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: EASE_OUT_EXPO }}
              className="text-base sm:text-lg text-slate-200 max-w-2xl leading-relaxed"
            >
              Student Study Assistant turns uploaded lecture PDFs and coursework into structured
              summaries, interactive AI tutoring, adaptive multiple-choice quizzes, downloadable study
              notes, and a daily study planner.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: EASE_OUT_EXPO }}
              className="flex flex-wrap items-center gap-3 pt-2"
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openAuthModal('register')}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>Create Free Student Account</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <a
                href="#walkthrough"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 hover:bg-white/15 text-white px-5 py-3 text-sm font-medium backdrop-blur-sm transition-colors whitespace-nowrap"
              >
                <span>Scroll Walkthrough</span>
                <ArrowDown className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Section 2: Scroll-Scrubbed Animated Video Walkthrough */}
      <section
        id="walkthrough"
        ref={reelRef}
        className="relative lg:h-[300vh] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19]"
      >
        <div className="lg:sticky lg:top-14 lg:min-h-[calc(100vh-3.5rem)] flex items-center py-14 lg:py-10">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Interactive Product Walkthrough
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  How Student Study Assistant works as you study
                </h2>
              </div>

              {/* Video-style Chapter Timeline Scrub Bar */}
              <div className="flex items-center gap-2">
                {STORY_CHAPTERS.map((chap, idx) => (
                  <button
                    key={chap.index}
                    type="button"
                    onClick={() => jumpToScene(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums transition-colors ${
                      activeScene === idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {chap.index}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                style={{ scaleX: reelProgress, transformOrigin: 'left' }}
                className="h-full w-full bg-indigo-600 dark:bg-indigo-500"
              />
            </div>

            {/* Split Stage: Narrative on Left + Animated Motion Frame on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={STORY_CHAPTERS[activeScene].index}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                    className="space-y-4"
                  >
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {STORY_CHAPTERS[activeScene].index}.
                      </span>{' '}
                      {STORY_CHAPTERS[activeScene].kicker}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 leading-snug text-balance">
                      {STORY_CHAPTERS[activeScene].title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {STORY_CHAPTERS[activeScene].description}
                    </p>
                    <ul className="space-y-2 pt-2">
                      {STORY_CHAPTERS[activeScene].highlights.map((pt) => (
                        <li
                          key={pt}
                          className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Animated Motion Frame Stage */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 sm:p-7 min-h-[380px] flex flex-col justify-between overflow-hidden">
                  <AnimatePresence mode="wait">
                    {activeScene === 0 && (
                      <motion.div
                        key="frame-0"
                        initial={{ opacity: 0, scale: 0.96, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -14 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="space-y-5 my-auto"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold">
                              Operating_Systems_Ch4.pdf
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            24 pages · Computer Science
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>PDF Text Extraction &amp; Section Indexing</span>
                            <span className="font-mono tabular-nums">100%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.85, ease: EASE_OUT_EXPO }}
                              style={{ transformOrigin: 'left' }}
                              className="h-full w-full bg-indigo-600 dark:bg-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { title: 'Executive Summary', sub: 'Core paging & TLB architecture' },
                            { title: 'Chapter-Wise Notes', sub: '6 structured revision sections' },
                            { title: 'Important Questions', sub: '10 exam prompts with answers' },
                            { title: 'Difficult Topics', sub: 'Multi-level page tables simplified' },
                          ].map((box, i) => (
                            <motion.div
                              key={box.title}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.12 + i * 0.07, duration: 0.3 }}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5"
                            >
                              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {box.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {box.sub}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeScene === 1 && (
                      <motion.div
                        key="frame-1"
                        initial={{ opacity: 0, scale: 0.96, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -14 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="space-y-4 my-auto"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <MessageSquareText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold">AI Tutor Session</span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Physics · Beginner Mode
                          </span>
                        </div>

                        <motion.div
                          initial={{ opacity: 0, x: 18 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="ml-auto max-w-md rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-xs leading-relaxed"
                        >
                          Why does entropy always increase in an isolated system? Explain simply.
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15, duration: 0.35 }}
                          className="max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            Intuitive Explanation: Counting Arrangements
                          </p>
                          <p className="leading-relaxed">
                            Imagine shuffling a neat deck of cards. There is only one exact ordered
                            arrangement, but trillions of mixed arrangements. Energy spreads out
                            for the exact same reason: disordered states vastly outnumber ordered
                            ones.
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.28, duration: 0.3 }}
                          className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-400"
                        >
                          <span className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1">
                            Switch to Detailed Derivation
                          </span>
                          <span className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1">
                            Ask a follow-up question
                          </span>
                        </motion.div>
                      </motion.div>
                    )}

                    {activeScene === 2 && (
                      <motion.div
                        key="frame-2"
                        initial={{ opacity: 0, scale: 0.96, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -14 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="space-y-4 my-auto"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold">
                              Quiz Lab · Virtual Memory Drill
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            Hard · Question 3 of 5
                          </span>
                        </div>

                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          Which component caches recent virtual-to-physical page translations?
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          {[
                            { opt: 'A. Instruction Decoder', correct: false },
                            { opt: 'B. Translation Lookaside Buffer (TLB)', correct: true },
                            { opt: 'C. Interrupt Vector Table', correct: false },
                            { opt: 'D. Direct Memory Access Controller', correct: false },
                          ].map((choice, i) => (
                            <motion.div
                              key={choice.opt}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.08 + i * 0.06 }}
                              className={`rounded-lg border px-3.5 py-2.5 ${
                                choice.correct
                                  ? 'border-emerald-500/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-medium'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {choice.opt}
                            </motion.div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <NotebookPen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Paired with exportable PDF revision notes
                          </span>
                          <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                            Score: 92%
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {activeScene === 3 && (
                      <motion.div
                        key="frame-3"
                        initial={{ opacity: 0, scale: 0.96, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -14 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        className="space-y-4 my-auto"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold">
                              Daily Study Goal &amp; Schedule
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            75 / 90 min completed
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 0.83 }}
                            transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
                            style={{ transformOrigin: 'left' }}
                            className="h-full w-full bg-indigo-600 dark:bg-indigo-500"
                          />
                        </div>

                        <div className="space-y-2">
                          {[
                            {
                              topic: 'Linear Algebra · Eigenvalues Problem Set',
                              meta: '09:00 · 45 min · Completed',
                              done: true,
                            },
                            {
                              topic: 'Operating Systems · Chapter 4 Quiz',
                              meta: '14:00 · 30 min · Completed',
                              done: true,
                            },
                            {
                              topic: 'Organic Chemistry · Mechanism Flashcards',
                              meta: '18:30 · 40 min · Upcoming',
                              done: false,
                            },
                          ].map((row, i) => (
                            <motion.div
                              key={row.topic}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + i * 0.08 }}
                              className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs"
                            >
                              <div>
                                <p
                                  className={`font-medium ${
                                    row.done
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {row.topic}
                                </p>
                                <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                                  {row.meta}
                                </p>
                              </div>
                              <CheckCircle2
                                className={`w-4 h-4 ${
                                  row.done
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-300 dark:text-slate-700'
                                }`}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: About This Website */}
      <section className="py-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                About This Website
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
                Built as a complete academic study system, not a scattered set of tools.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Students juggle lecture PDFs, unanswered conceptual questions, handwritten revision
                sheets, practice quizzes, and weekly deadlines across disconnected apps. Student
                Study Assistant unifies every step into one authenticated workspace powered by Google
                Gemini on the server and structured persistence.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[4/3] bg-slate-200 dark:bg-slate-900">
                {!deskImgError ? (
                  <img
                    src={DESK_IMAGE}
                    alt="Minimalist sunlit study desk with notebooks"
                    referrerPolicy="no-referrer"
                    onError={() => setDeskImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Asymmetric Bento Grid of Core Capabilities */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {[
              {
                span: 'md:col-span-7',
                num: '01.',
                title: 'PDF Parsing & Structured Synthesis',
                body: 'Upload course textbooks or lecture decks up to 15 MB. Every PDF is validated, parsed, and turned into executive summaries, chapter notes, exam questions, and plain-English topic explanations.',
                icon: FileText,
              },
              {
                span: 'md:col-span-5',
                num: '02.',
                title: 'AI Tutor with Depth Modes',
                body: 'Ask subject-specific questions in Beginner mode for intuition or Detailed mode for formal rigor, with persistent conversation history.',
                icon: MessageSquareText,
              },
              {
                span: 'md:col-span-5',
                num: '03.',
                title: 'Adaptive Quizzes & PDF Export',
                body: 'Test yourself on Easy, Medium, or Hard 4-option MCQs with instant explanations, and download generated notes as formatted PDFs.',
                icon: GraduationCap,
              },
              {
                span: 'md:col-span-7',
                num: '04.',
                title: 'Student Dashboard & Role-Based Admin Console',
                body: 'Students track daily study minutes, quiz averages, and upcoming tasks. Administrators manage student accounts, issue one-time reset codes, and monitor uploaded documents.',
                icon: ShieldCheck,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.num}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
                  className={`${item.span} rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                      {item.num}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 4: Inline Sign In / Sign Up Workspace Entry */}
      <section id="get-started" className="py-20 bg-white dark:bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="lg:col-span-5 space-y-4"
          >
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Ready to open your study workspace?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Sign in with your student or administrator credentials, create a new student account,
              or claim the workspace admin role if this is a fresh installation.
            </p>
            <div className="pt-2 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>Server-side Gemini API integration · API keys never leave the server</p>
              <p>JWT Bearer sessions · bcrypt password hashing · Rate-limited endpoints</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: 0.08, ease: EASE_OUT_EXPO }}
            className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8"
          >
            {renderAuthForm('inline')}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#0B0F19]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-1">
            <span>Student Study Assistant</span>
            <span aria-hidden="true">·</span>
            <span>Raghuraj Pratap Singh</span>
            <span aria-hidden="true">·</span>
            <a
              href="mailto:raghurajpratapsingh8787@gmail.com"
              className="hover:text-slate-900 dark:hover:text-slate-200 hover:underline underline-offset-2"
            >
              raghurajpratapsingh8787@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              Sign Up
            </button>
            <a href="#walkthrough" className="hover:text-slate-900 dark:hover:text-slate-200">
              Walkthrough
            </a>
          </div>
        </div>
      </footer>

      {/* Animated Login / Sign Up Modal triggered by Top Bar */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
              {renderAuthForm('modal')}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
