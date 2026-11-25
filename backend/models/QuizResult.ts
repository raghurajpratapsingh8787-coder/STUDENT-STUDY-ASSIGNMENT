import mongoose, { Schema, Document } from 'mongoose';
import type { QuizDifficulty } from './Quiz.ts';

export interface IQuizResult {
  _id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  subject: string;
  difficulty: QuizDifficulty;
  answers: number[];
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds: number;
  completedAt: Date;
}

export interface IQuizResultDoc
  extends Omit<IQuizResult, '_id' | 'userId' | 'quizId'>,
    Document {
  userId: mongoose.Types.ObjectId;
  quizId: mongoose.Types.ObjectId;
}

const QuizResultSchema = new Schema<IQuizResultDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    quizTitle: { type: String, required: true },
    subject: { type: String, default: 'General' },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    timeTakenSeconds: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export const QuizResultModel =
  (mongoose.models.QuizResult as mongoose.Model<IQuizResultDoc>) ||
  mongoose.model<IQuizResultDoc>('QuizResult', QuizResultSchema);
