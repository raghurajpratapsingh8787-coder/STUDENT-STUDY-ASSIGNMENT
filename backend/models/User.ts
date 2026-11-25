import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'student' | 'admin';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  major: string;
  university: string;
  dailyGoalMinutes: number;
  avatarUrl: string;
  isActive: boolean;
  resetRequestedAt?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExpires?: Date | null;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDoc extends Omit<IUser, '_id'>, Document {}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    major: { type: String, default: 'General Studies', trim: true, maxlength: 120 },
    university: { type: String, default: '', trim: true, maxlength: 160 },
    dailyGoalMinutes: { type: Number, default: 90, min: 15, max: 720 },
    avatarUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    resetRequestedAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    lastActiveAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const UserModel =
  (mongoose.models.User as mongoose.Model<IUserDoc>) ||
  mongoose.model<IUserDoc>('User', UserSchema);
