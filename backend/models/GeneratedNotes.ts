import mongoose, { Schema, Document } from 'mongoose';

export type NoteType = 'short' | 'detailed' | 'definitions' | 'key_points' | 'chapter_summary';

export interface IGeneratedNotes {
  _id: string;
  userId: string;
  documentId?: string | null;
  title: string;
  subject: string;
  noteType: NoteType;
  sourceTopic: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGeneratedNotesDoc
  extends Omit<IGeneratedNotes, '_id' | 'userId' | 'documentId'>,
    Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId | null;
}

const GeneratedNotesSchema = new Schema<IGeneratedNotesDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, default: 'General', trim: true, maxlength: 80 },
    noteType: {
      type: String,
      enum: ['short', 'detailed', 'definitions', 'key_points', 'chapter_summary'],
      required: true,
    },
    sourceTopic: { type: String, required: true, trim: true, maxlength: 300 },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const GeneratedNotesModel =
  (mongoose.models.GeneratedNotes as mongoose.Model<IGeneratedNotesDoc>) ||
  mongoose.model<IGeneratedNotesDoc>('GeneratedNotes', GeneratedNotesSchema);
