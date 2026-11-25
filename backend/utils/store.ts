import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { isMongoConnected } from '../config/db.ts';
import { UserModel, type IUser } from '../models/User.ts';
import { ChatModel, type IChat } from '../models/Chat.ts';
import { MessageModel, type IMessage } from '../models/Message.ts';
import { DocumentModel, type IDocument } from '../models/Document.ts';
import { GeneratedNotesModel, type IGeneratedNotes } from '../models/GeneratedNotes.ts';
import { QuizModel, type IQuiz } from '../models/Quiz.ts';
import { QuizResultModel, type IQuizResult } from '../models/QuizResult.ts';
import { StudyTaskModel, type IStudyTask } from '../models/StudyTask.ts';

interface LocalDbSchema {
  users: IUser[];
  chats: IChat[];
  messages: IMessage[];
  documents: IDocument[];
  notes: IGeneratedNotes[];
  quizzes: IQuiz[];
  quizResults: IQuizResult[];
  studyTasks: IStudyTask[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'scholara_db.json');

const emptyDb = (): LocalDbSchema => ({
  users: [],
  chats: [],
  messages: [],
  documents: [],
  notes: [],
  quizzes: [],
  quizResults: [],
  studyTasks: [],
});

let cache: LocalDbSchema | null = null;

function loadLocalDb(): LocalDbSchema {
  if (cache) return cache;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      cache = emptyDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf-8');
      return cache;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDbSchema>;
    cache = {
      users: parsed.users || [],
      chats: parsed.chats || [],
      messages: parsed.messages || [],
      documents: parsed.documents || [],
      notes: parsed.notes || [],
      quizzes: parsed.quizzes || [],
      quizResults: parsed.quizResults || [],
      studyTasks: parsed.studyTasks || [],
    };
    return cache;
  } catch {
    cache = emptyDb();
    return cache;
  }
}

function saveLocalDb(): void {
  if (!cache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(cache, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function newId(): string {
  return new mongoose.Types.ObjectId().toString();
}

function normalize<T>(doc: unknown): T {
  const obj = typeof (doc as { toObject?: () => unknown }).toObject === 'function'
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>);
  return JSON.parse(
    JSON.stringify({
      ...obj,
      _id: obj._id ? String(obj._id) : undefined,
      userId: obj.userId ? String(obj.userId) : undefined,
      chatId: obj.chatId ? String(obj.chatId) : undefined,
      documentId: obj.documentId ? String(obj.documentId) : obj.documentId ?? null,
      quizId: obj.quizId ? String(obj.quizId) : undefined,
    })
  ) as T;
}

export const dbStore = {
  users: {
    async findByEmail(email: string): Promise<IUser | null> {
      const clean = email.toLowerCase().trim();
      if (isMongoConnected()) {
        const doc = await UserModel.findOne({ email: clean }).lean();
        return doc ? normalize<IUser>(doc) : null;
      }
      const db = loadLocalDb();
      const user = db.users.find((u) => u.email.toLowerCase() === clean);
      return user ? { ...user } : null;
    },

    async findById(id: string): Promise<IUser | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await UserModel.findById(id).lean();
        return doc ? normalize<IUser>(doc) : null;
      }
      const db = loadLocalDb();
      const user = db.users.find((u) => u._id === id);
      return user ? { ...user } : null;
    },

    async findAll(): Promise<IUser[]> {
      if (isMongoConnected()) {
        const docs = await UserModel.find({}).sort({ createdAt: -1 }).lean();
        return docs.map((d) => normalize<IUser>(d));
      }
      const db = loadLocalDb();
      return [...db.users].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },

    async countByRole(role: 'student' | 'admin'): Promise<number> {
      if (isMongoConnected()) {
        return UserModel.countDocuments({ role });
      }
      const db = loadLocalDb();
      return db.users.filter((u) => u.role === role).length;
    },

    async create(input: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
      if (isMongoConnected()) {
        const doc = await UserModel.create(input);
        return normalize<IUser>(doc);
      }
      const db = loadLocalDb();
      const now = new Date();
      const created: IUser = {
        ...input,
        _id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      db.users.push(created);
      saveLocalDb();
      return { ...created };
    },

    async updateById(id: string, patch: Partial<IUser>): Promise<IUser | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
        return doc ? normalize<IUser>(doc) : null;
      }
      const db = loadLocalDb();
      const idx = db.users.findIndex((u) => u._id === id);
      if (idx === -1) return null;
      db.users[idx] = { ...db.users[idx], ...patch, updatedAt: new Date() };
      saveLocalDb();
      return { ...db.users[idx] };
    },

    async deleteById(id: string): Promise<boolean> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const res = await UserModel.findByIdAndDelete(id);
        return Boolean(res);
      }
      const db = loadLocalDb();
      const before = db.users.length;
      db.users = db.users.filter((u) => u._id !== id);
      if (db.users.length !== before) {
        saveLocalDb();
        return true;
      }
      return false;
    },

    async purgeOwnedData(userId: string): Promise<string[]> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(userId)) return [];
        const docs = await DocumentModel.find({ userId }).select('storedFilename').lean();
        const storedFilenames = docs
          .map((d) => d.storedFilename)
          .filter((name): name is string => typeof name === 'string' && name.length > 0);
        await Promise.all([
          DocumentModel.deleteMany({ userId }),
          ChatModel.deleteMany({ userId }),
          MessageModel.deleteMany({ userId }),
          GeneratedNotesModel.deleteMany({ userId }),
          QuizModel.deleteMany({ userId }),
          QuizResultModel.deleteMany({ userId }),
          StudyTaskModel.deleteMany({ userId }),
        ]);
        return storedFilenames;
      }

      const db = loadLocalDb();
      const storedFilenames = db.documents
        .filter((d) => d.userId === userId)
        .map((d) => d.storedFilename)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
      db.documents = db.documents.filter((d) => d.userId !== userId);
      db.chats = db.chats.filter((c) => c.userId !== userId);
      db.messages = db.messages.filter((m) => m.userId !== userId);
      db.notes = db.notes.filter((n) => n.userId !== userId);
      db.quizzes = db.quizzes.filter((q) => q.userId !== userId);
      db.quizResults = db.quizResults.filter((r) => r.userId !== userId);
      db.studyTasks = db.studyTasks.filter((t) => t.userId !== userId);
      saveLocalDb();
      return storedFilenames;
    },
  },

  chats: {
    async findByUser(userId: string): Promise<IChat[]> {
      if (isMongoConnected()) {
        const docs = await ChatModel.find({ userId }).sort({ updatedAt: -1 }).lean();
        return docs.map((d) => normalize<IChat>(d));
      }
      const db = loadLocalDb();
      return db.chats
        .filter((c) => c.userId === userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },

    async findByIdAndUser(id: string, userId: string): Promise<IChat | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await ChatModel.findOne({ _id: id, userId }).lean();
        return doc ? normalize<IChat>(doc) : null;
      }
      const db = loadLocalDb();
      const chat = db.chats.find((c) => c._id === id && c.userId === userId);
      return chat ? { ...chat } : null;
    },

    async create(input: Omit<IChat, '_id' | 'createdAt' | 'updatedAt'>): Promise<IChat> {
      if (isMongoConnected()) {
        const doc = await ChatModel.create(input);
        return normalize<IChat>(doc);
      }
      const db = loadLocalDb();
      const now = new Date();
      const created: IChat = { ...input, _id: newId(), createdAt: now, updatedAt: now };
      db.chats.push(created);
      saveLocalDb();
      return { ...created };
    },

    async touch(id: string, patch: Partial<IChat> = {}): Promise<void> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return;
        await ChatModel.findByIdAndUpdate(id, { $set: { ...patch, updatedAt: new Date() } });
        return;
      }
      const db = loadLocalDb();
      const idx = db.chats.findIndex((c) => c._id === id);
      if (idx !== -1) {
        db.chats[idx] = { ...db.chats[idx], ...patch, updatedAt: new Date() };
        saveLocalDb();
      }
    },

    async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const res = await ChatModel.findOneAndDelete({ _id: id, userId });
        if (res) {
          await MessageModel.deleteMany({ chatId: id, userId });
          return true;
        }
        return false;
      }
      const db = loadLocalDb();
      const before = db.chats.length;
      db.chats = db.chats.filter((c) => !(c._id === id && c.userId === userId));
      if (db.chats.length !== before) {
        db.messages = db.messages.filter((m) => !(m.chatId === id && m.userId === userId));
        saveLocalDb();
        return true;
      }
      return false;
    },

    async countAll(): Promise<number> {
      if (isMongoConnected()) return ChatModel.countDocuments({});
      return loadLocalDb().chats.length;
    },
  },

  messages: {
    async findByChat(chatId: string): Promise<IMessage[]> {
      if (isMongoConnected()) {
        const docs = await MessageModel.find({ chatId }).sort({ createdAt: 1 }).lean();
        return docs.map((d) => normalize<IMessage>(d));
      }
      const db = loadLocalDb();
      return db.messages
        .filter((m) => m.chatId === chatId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    async create(input: Omit<IMessage, '_id' | 'createdAt'>): Promise<IMessage> {
      if (isMongoConnected()) {
        const doc = await MessageModel.create(input);
        return normalize<IMessage>(doc);
      }
      const db = loadLocalDb();
      const created: IMessage = { ...input, _id: newId(), createdAt: new Date() };
      db.messages.push(created);
      saveLocalDb();
      return { ...created };
    },

    async deleteByChat(chatId: string, userId: string): Promise<void> {
      if (isMongoConnected()) {
        await MessageModel.deleteMany({ chatId, userId });
        return;
      }
      const db = loadLocalDb();
      db.messages = db.messages.filter((m) => !(m.chatId === chatId && m.userId === userId));
      saveLocalDb();
    },

    async countAll(): Promise<number> {
      if (isMongoConnected()) return MessageModel.countDocuments({});
      return loadLocalDb().messages.length;
    },
  },

  documents: {
    async findByUser(userId: string): Promise<IDocument[]> {
      if (isMongoConnected()) {
        const docs = await DocumentModel.find({ userId }).sort({ createdAt: -1 }).lean();
        return docs.map((d) => normalize<IDocument>(d));
      }
      const db = loadLocalDb();
      return db.documents
        .filter((d) => d.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async findAll(): Promise<IDocument[]> {
      if (isMongoConnected()) {
        const docs = await DocumentModel.find({}).sort({ createdAt: -1 }).lean();
        return docs.map((d) => normalize<IDocument>(d));
      }
      const db = loadLocalDb();
      return [...db.documents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },

    async findById(id: string): Promise<IDocument | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await DocumentModel.findById(id).lean();
        return doc ? normalize<IDocument>(doc) : null;
      }
      const db = loadLocalDb();
      const doc = db.documents.find((d) => d._id === id);
      return doc ? { ...doc } : null;
    },

    async findByIdAndUser(id: string, userId: string): Promise<IDocument | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await DocumentModel.findOne({ _id: id, userId }).lean();
        return doc ? normalize<IDocument>(doc) : null;
      }
      const db = loadLocalDb();
      const doc = db.documents.find((d) => d._id === id && d.userId === userId);
      return doc ? { ...doc } : null;
    },

    async create(input: Omit<IDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<IDocument> {
      if (isMongoConnected()) {
        const doc = await DocumentModel.create(input);
        return normalize<IDocument>(doc);
      }
      const db = loadLocalDb();
      const now = new Date();
      const created: IDocument = { ...input, _id: newId(), createdAt: now, updatedAt: now };
      db.documents.push(created);
      saveLocalDb();
      return { ...created };
    },

    async updateByIdAndUser(
      id: string,
      userId: string,
      patch: Partial<IDocument>
    ): Promise<IDocument | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await DocumentModel.findOneAndUpdate(
          { _id: id, userId },
          { $set: patch },
          { new: true }
        ).lean();
        return doc ? normalize<IDocument>(doc) : null;
      }
      const db = loadLocalDb();
      const idx = db.documents.findIndex((d) => d._id === id && d.userId === userId);
      if (idx === -1) return null;
      db.documents[idx] = { ...db.documents[idx], ...patch, updatedAt: new Date() };
      saveLocalDb();
      return { ...db.documents[idx] };
    },

    async deleteById(id: string): Promise<IDocument | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await DocumentModel.findByIdAndDelete(id).lean();
        return doc ? normalize<IDocument>(doc) : null;
      }
      const db = loadLocalDb();
      const idx = db.documents.findIndex((d) => d._id === id);
      if (idx === -1) return null;
      const [removed] = db.documents.splice(idx, 1);
      saveLocalDb();
      return removed;
    },
  },

  notes: {
    async findByUser(userId: string): Promise<IGeneratedNotes[]> {
      if (isMongoConnected()) {
        const docs = await GeneratedNotesModel.find({ userId }).sort({ createdAt: -1 }).lean();
        return docs.map((d) => normalize<IGeneratedNotes>(d));
      }
      const db = loadLocalDb();
      return db.notes
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async findByIdAndUser(id: string, userId: string): Promise<IGeneratedNotes | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await GeneratedNotesModel.findOne({ _id: id, userId }).lean();
        return doc ? normalize<IGeneratedNotes>(doc) : null;
      }
      const db = loadLocalDb();
      const note = db.notes.find((n) => n._id === id && n.userId === userId);
      return note ? { ...note } : null;
    },

    async create(
      input: Omit<IGeneratedNotes, '_id' | 'createdAt' | 'updatedAt'>
    ): Promise<IGeneratedNotes> {
      if (isMongoConnected()) {
        const doc = await GeneratedNotesModel.create(input);
        return normalize<IGeneratedNotes>(doc);
      }
      const db = loadLocalDb();
      const now = new Date();
      const created: IGeneratedNotes = {
        ...input,
        _id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      db.notes.push(created);
      saveLocalDb();
      return { ...created };
    },

    async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const res = await GeneratedNotesModel.findOneAndDelete({ _id: id, userId });
        return Boolean(res);
      }
      const db = loadLocalDb();
      const before = db.notes.length;
      db.notes = db.notes.filter((n) => !(n._id === id && n.userId === userId));
      if (db.notes.length !== before) {
        saveLocalDb();
        return true;
      }
      return false;
    },

    async countAll(): Promise<number> {
      if (isMongoConnected()) return GeneratedNotesModel.countDocuments({});
      return loadLocalDb().notes.length;
    },
  },

  quizzes: {
    async findByUser(userId: string): Promise<IQuiz[]> {
      if (isMongoConnected()) {
        const docs = await QuizModel.find({ userId }).sort({ createdAt: -1 }).lean();
        return docs.map((d) => normalize<IQuiz>(d));
      }
      const db = loadLocalDb();
      return db.quizzes
        .filter((q) => q.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async findByIdAndUser(id: string, userId: string): Promise<IQuiz | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await QuizModel.findOne({ _id: id, userId }).lean();
        return doc ? normalize<IQuiz>(doc) : null;
      }
      const db = loadLocalDb();
      const quiz = db.quizzes.find((q) => q._id === id && q.userId === userId);
      return quiz ? { ...quiz } : null;
    },

    async create(input: Omit<IQuiz, '_id' | 'createdAt'>): Promise<IQuiz> {
      if (isMongoConnected()) {
        const doc = await QuizModel.create(input);
        return normalize<IQuiz>(doc);
      }
      const db = loadLocalDb();
      const created: IQuiz = { ...input, _id: newId(), createdAt: new Date() };
      db.quizzes.push(created);
      saveLocalDb();
      return { ...created };
    },

    async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const res = await QuizModel.findOneAndDelete({ _id: id, userId });
        return Boolean(res);
      }
      const db = loadLocalDb();
      const before = db.quizzes.length;
      db.quizzes = db.quizzes.filter((q) => !(q._id === id && q.userId === userId));
      if (db.quizzes.length !== before) {
        saveLocalDb();
        return true;
      }
      return false;
    },

    async countAll(): Promise<number> {
      if (isMongoConnected()) return QuizModel.countDocuments({});
      return loadLocalDb().quizzes.length;
    },
  },

  quizResults: {
    async findByUser(userId: string): Promise<IQuizResult[]> {
      if (isMongoConnected()) {
        const docs = await QuizResultModel.find({ userId }).sort({ completedAt: -1 }).lean();
        return docs.map((d) => normalize<IQuizResult>(d));
      }
      const db = loadLocalDb();
      return db.quizResults
        .filter((r) => r.userId === userId)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    },

    async create(input: Omit<IQuizResult, '_id' | 'completedAt'>): Promise<IQuizResult> {
      if (isMongoConnected()) {
        const doc = await QuizResultModel.create({ ...input, completedAt: new Date() });
        return normalize<IQuizResult>(doc);
      }
      const db = loadLocalDb();
      const created: IQuizResult = {
        ...input,
        _id: newId(),
        completedAt: new Date(),
      };
      db.quizResults.push(created);
      saveLocalDb();
      return { ...created };
    },

    async countAll(): Promise<number> {
      if (isMongoConnected()) return QuizResultModel.countDocuments({});
      return loadLocalDb().quizResults.length;
    },
  },

  studyTasks: {
    async findByUser(userId: string): Promise<IStudyTask[]> {
      if (isMongoConnected()) {
        const docs = await StudyTaskModel.find({ userId })
          .sort({ scheduledDate: 1, startTime: 1 })
          .lean();
        return docs.map((d) => normalize<IStudyTask>(d));
      }
      const db = loadLocalDb();
      return db.studyTasks
        .filter((t) => t.userId === userId)
        .sort((a, b) => `${a.scheduledDate} ${a.startTime}`.localeCompare(`${b.scheduledDate} ${b.startTime}`));
    },

    async create(input: Omit<IStudyTask, '_id' | 'createdAt' | 'updatedAt'>): Promise<IStudyTask> {
      if (isMongoConnected()) {
        const doc = await StudyTaskModel.create(input);
        return normalize<IStudyTask>(doc);
      }
      const db = loadLocalDb();
      const now = new Date();
      const created: IStudyTask = { ...input, _id: newId(), createdAt: now, updatedAt: now };
      db.studyTasks.push(created);
      saveLocalDb();
      return { ...created };
    },

    async updateByIdAndUser(
      id: string,
      userId: string,
      patch: Partial<IStudyTask>
    ): Promise<IStudyTask | null> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const doc = await StudyTaskModel.findOneAndUpdate(
          { _id: id, userId },
          { $set: patch },
          { new: true }
        ).lean();
        return doc ? normalize<IStudyTask>(doc) : null;
      }
      const db = loadLocalDb();
      const idx = db.studyTasks.findIndex((t) => t._id === id && t.userId === userId);
      if (idx === -1) return null;
      db.studyTasks[idx] = { ...db.studyTasks[idx], ...patch, updatedAt: new Date() };
      saveLocalDb();
      return { ...db.studyTasks[idx] };
    },

    async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
      if (isMongoConnected()) {
        if (!mongoose.Types.ObjectId.isValid(id)) return false;
        const res = await StudyTaskModel.findOneAndDelete({ _id: id, userId });
        return Boolean(res);
      }
      const db = loadLocalDb();
      const before = db.studyTasks.length;
      db.studyTasks = db.studyTasks.filter((t) => !(t._id === id && t.userId === userId));
      if (db.studyTasks.length !== before) {
        saveLocalDb();
        return true;
      }
      return false;
    },
  },
};
