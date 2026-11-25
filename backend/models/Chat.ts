import mongoose, { Schema, Document } from 'mongoose';

export type ChatMode = 'detailed' | 'beginner';

export interface IChat {
  _id: string;
  userId: string;
  title: string;
  subject: string;
  mode: ChatMode;
  documentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatDoc extends Omit<IChat, '_id' | 'userId' | 'documentId'>, Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId | null;
}

const ChatSchema = new Schema<IChatDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subject: { type: String, default: 'General', trim: true, maxlength: 80 },
    mode: { type: String, enum: ['detailed', 'beginner'], default: 'detailed' },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
  },
  { timestamps: true }
);

export const ChatModel =
  (mongoose.models.Chat as mongoose.Model<IChatDoc>) ||
  mongoose.model<IChatDoc>('Chat', ChatSchema);
