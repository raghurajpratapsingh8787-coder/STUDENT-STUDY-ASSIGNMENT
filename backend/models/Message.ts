import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  _id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IMessageDoc extends Omit<IMessage, '_id' | 'chatId' | 'userId'>, Document {
  chatId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const MessageSchema = new Schema<IMessageDoc>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const MessageModel =
  (mongoose.models.Message as mongoose.Model<IMessageDoc>) ||
  mongoose.model<IMessageDoc>('Message', MessageSchema);
