import mongoose, { Schema, Document } from 'mongoose';

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface IQuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface IQuiz {
  _id: string;
  userId: string;
  documentId?: string | null;
  title: string;
  subject: string;
  difficulty: QuizDifficulty;
  questions: IQuizQuestion[];
  createdAt: Date;
}

export interface IQuizDoc extends Omit<IQuiz, '_id' | 'userId' | 'documentId'>, Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId | null;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    question: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length === 4,
        message: 'Each question must have exactly 4 options.',
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const QuizSchema = new Schema<IQuizDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, default: 'General', trim: true, maxlength: 80 },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    questions: { type: [QuizQuestionSchema], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const QuizModel =
  (mongoose.models.Quiz as mongoose.Model<IQuizDoc>) ||
  mongoose.model<IQuizDoc>('Quiz', QuizSchema);
