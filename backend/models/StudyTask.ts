import mongoose, { Schema, Document } from 'mongoose';

export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface IStudyTask {
  _id: string;
  userId: string;
  subject: string;
  topic: string;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  priority: TaskPriority;
  goalNote: string;
  completed: boolean;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudyTaskDoc extends Omit<IStudyTask, '_id' | 'userId'>, Document {
  userId: mongoose.Types.ObjectId;
}

const StudyTaskSchema = new Schema<IStudyTaskDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    scheduledDate: { type: String, required: true },
    startTime: { type: String, default: '09:00' },
    durationMinutes: { type: Number, default: 45, min: 5, max: 480 },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    goalNote: { type: String, default: '', maxlength: 400 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const StudyTaskModel =
  (mongoose.models.StudyTask as mongoose.Model<IStudyTaskDoc>) ||
  mongoose.model<IStudyTaskDoc>('StudyTask', StudyTaskSchema);
