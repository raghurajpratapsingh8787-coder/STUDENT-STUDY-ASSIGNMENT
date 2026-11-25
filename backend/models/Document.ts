import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument {
  _id: string;
  userId: string;
  title: string;
  originalName: string;
  storedFilename: string;
  fileSize: number;
  pageCount: number;
  extractedText: string;
  subject: string;
  summary: string;
  chapterNotes: string;
  importantQuestions: string;
  difficultTopics: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentDoc extends Omit<IDocument, '_id' | 'userId'>, Document {
  userId: mongoose.Types.ObjectId;
}

const DocumentSchema = new Schema<IDocumentDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    originalName: { type: String, required: true },
    storedFilename: { type: String, required: true },
    fileSize: { type: Number, required: true },
    pageCount: { type: Number, default: 1 },
    extractedText: { type: String, required: true },
    subject: { type: String, default: 'General', trim: true, maxlength: 80 },
    summary: { type: String, default: '' },
    chapterNotes: { type: String, default: '' },
    importantQuestions: { type: String, default: '' },
    difficultTopics: { type: String, default: '' },
  },
  { timestamps: true }
);

export const DocumentModel =
  (mongoose.models.Document as mongoose.Model<IDocumentDoc>) ||
  mongoose.model<IDocumentDoc>('Document', DocumentSchema);
