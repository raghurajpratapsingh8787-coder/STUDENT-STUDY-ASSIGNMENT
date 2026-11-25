import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { Sidebar, type NavSection } from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotesGeneratorPage } from './pages/NotesGeneratorPage';
import { PdfAssistantPage } from './pages/PdfAssistantPage';
import { ProfilePage } from './pages/ProfilePage';
import { QuizGeneratorPage } from './pages/QuizGeneratorPage';
import { StudyPlannerPage } from './pages/StudyPlannerPage';

function WorkspaceShell() {
  const { user } = useAuth();
  const [active, setActive] = useState<NavSection>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const resolvedSection: NavSection =
    user && active === 'admin' && user.role !== 'admin' ? 'dashboard' : active;

  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <motion.div
          key="auth-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <AuthScreen />
        </motion.div>
      ) : (
        <motion.div
          key="workspace-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100"
        >
          <Sidebar
            active={resolvedSection}
            onSelect={setActive}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <Header
              active={resolvedSection}
              onOpenMobile={() => setMobileOpen(true)}
              onNavigate={setActive}
            />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={resolvedSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {resolvedSection === 'dashboard' && <DashboardPage onNavigate={setActive} />}
                  {resolvedSection === 'chat' && <ChatbotPage />}
                  {resolvedSection === 'pdfs' && <PdfAssistantPage onNavigate={setActive} />}
                  {resolvedSection === 'quizzes' && <QuizGeneratorPage />}
                  {resolvedSection === 'notes' && <NotesGeneratorPage />}
                  {resolvedSection === 'planner' && <StudyPlannerPage />}
                  {resolvedSection === 'profile' && <ProfilePage />}
                  {resolvedSection === 'admin' && user.role === 'admin' && <AdminDashboardPage />}
                </motion.div>
              </AnimatePresence>
            </main>

            <footer className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-2">
                <span>AI-Based Student Study Assistant</span>
                <span>
                  Raghuraj Pratap Singh ·{' '}
                  <a
                    href="mailto:raghurajpratapsingh8787@gmail.com"
                    className="hover:text-slate-900 dark:hover:text-slate-200 hover:underline underline-offset-2"
                  >
                    raghurajpratapsingh8787@gmail.com
                  </a>
                </span>
              </div>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceShell />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
