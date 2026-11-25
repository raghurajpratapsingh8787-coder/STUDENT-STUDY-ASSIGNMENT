export type UserRole = 'student' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  major: string;
  university: string;
  dailyGoalMinutes: number;
  avatarUrl: string;
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface DashboardStats {
  totalPdfs: number;
  totalNotes: number;
  totalQuizzesTaken: number;
  avgQuizScore: number;
  completedTasksCount: number;
  totalTasksCount: number;
  studyProgressPercent: number;
  dailyGoalMinutes: number;
  completedTodayMinutes: number;
}

export interface QuizTrendItem {
  label: string;
  percentage: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  date: string;
}

export interface ActivityItem {
  id: string;
  type: 'pdf' | 'notes' | 'quiz' | 'task' | 'chat';
  title: string;
  detail: string;
  timestamp: string;
}

export interface StudyTask {
  _id: string;
  userId: string;
  subject: string;
  topic: string;
  scheduledDate: string;
  startTime: string;
  durationMinutes: number;
  priority: 'Low' | 'Medium' | 'High';
  goalNote: string;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
}

export interface ChatSession {
  _id: string;
  userId: string;
  title: string;
  subject: string;
  mode: 'detailed' | 'beginner';
  documentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface DocumentSummaryItem {
  _id: string;
  title: string;
  originalName: string;
  fileSize: number;
  pageCount: number;
  subject: string;
  hasSummary: boolean;
  hasChapterNotes: boolean;
  hasImportantQuestions: boolean;
  hasDifficultTopics: boolean;
  textPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface FullDocument extends DocumentSummaryItem {
  extractedText: string;
  summary: string;
  chapterNotes: string;
  importantQuestions: string;
  difficultTopics: string;
}

export type NoteType =
  | 'short'
  | 'detailed'
  | 'definitions'
  | 'key_points'
  | 'chapter_summary';

export interface GeneratedNote {
  _id: string;
  documentId?: string | null;
  title: string;
  subject: string;
  noteType: NoteType;
  sourceTopic: string;
  content: string;
  createdAt: string;
}

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface QuizItem {
  _id: string;
  documentId?: string | null;
  title: string;
  subject: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizResultItem {
  _id: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  difficulty: QuizDifficulty;
  answers: number[];
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds: number;
  completedAt: string;
}

export interface QuizReviewItem {
  question: string;
  options: [string, string, string, string];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  major: string;
  university: string;
  isActive: boolean;
  resetRequestedAt?: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface AdminDocumentItem {
  _id: string;
  title: string;
  originalName: string;
  subject: string;
  fileSize: number;
  pageCount: number;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
}
