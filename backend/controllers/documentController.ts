import fs from 'fs';
import { createRequire } from 'module';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import {
  AiServiceError,
  analyzePdfContent,
  generateQuizQuestions,
  type PdfAnalysisTask,
} from '../services/geminiService.ts';
import { buildNotesPdfBuffer } from '../utils/pdfExport.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString, resolveSafeUploadPath } from '../utils/validation.ts';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  dataBuffer: Buffer
) => Promise<{ numpages: number; text: string }>;

function removeFileSafely(filename: string): void {
  const safePath = resolveSafeUploadPath(filename);
  if (safePath && fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
  }
}

export async function listDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const docs = await dbStore.documents.findByUser(req.user._id);
    const lightweight = docs.map((d) => ({
      _id: d._id,
      title: d.title,
      originalName: d.originalName,
      fileSize: d.fileSize,
      pageCount: d.pageCount,
      subject: d.subject,
      hasSummary: Boolean(d.summary),
      hasChapterNotes: Boolean(d.chapterNotes),
      hasImportantQuestions: Boolean(d.importantQuestions),
      hasDifficultTopics: Boolean(d.difficultTopics),
      textPreview: d.extractedText.slice(0, 420),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    res.json({ documents: lightweight });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list PDFs.' });
  }
}

export async function getDocumentById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const doc = await dbStore.documents.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!doc) {
      res.status(404).json({ error: 'PDF document not found.' });
      return;
    }

    res.json({ document: doc });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load PDF.' });
  }
}

export async function uploadPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  const file = req.file;
  try {
    if (!req.user) {
      if (file) removeFileSafely(file.filename);
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Please select a PDF file to upload.' });
      return;
    }

    const safePath = resolveSafeUploadPath(file.filename);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(400).json({ error: 'Invalid upload file path.' });
      return;
    }

    const buffer = fs.readFileSync(safePath);
    if (buffer.subarray(0, 5).toString('utf-8') !== '%PDF-') {
      removeFileSafely(file.filename);
      res.status(400).json({ error: 'Uploaded file is not a valid PDF binary.' });
      return;
    }

    const parsed = await pdfParse(buffer);
    const extractedText = (parsed.text || '').replace(/\s+\n/g, '\n').trim();
    if (!extractedText) {
      removeFileSafely(file.filename);
      res.status(422).json({
        error:
          'Could not extract selectable text from this PDF. Please upload a text-based PDF rather than a scanned image.',
      });
      return;
    }

    const title =
      asCleanString(req.body?.title, 200) ||
      file.originalname.replace(/\.pdf$/i, '').slice(0, 200);
    const subject = asCleanString(req.body?.subject, 80) || 'General';

    const document = await dbStore.documents.create({
      userId: req.user._id,
      title,
      originalName: file.originalname,
      storedFilename: file.filename,
      fileSize: file.size,
      pageCount: Math.max(1, Number(parsed.numpages) || 1),
      extractedText: extractedText.slice(0, 250000),
      subject,
      summary: '',
      chapterNotes: '',
      importantQuestions: '',
      difficultTopics: '',
    });

    res.status(201).json({ document });
  } catch (err) {
    if (file) removeFileSafely(file.filename);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'PDF upload and parsing failed.',
    });
  }
}

export async function analyzeDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const doc = await dbStore.documents.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!doc) {
      res.status(404).json({ error: 'PDF document not found.' });
      return;
    }

    const task = req.body?.task as PdfAnalysisTask | 'mcqs';
    if (task === 'mcqs') {
      const difficulty =
        req.body?.difficulty === 'Easy' || req.body?.difficulty === 'Hard'
          ? req.body.difficulty
          : 'Medium';
      const questions = await generateQuizQuestions({
        topic: doc.title,
        subject: doc.subject,
        difficulty,
        count: 5,
        documentContext: doc.extractedText,
      });

      const quiz = await dbStore.quizzes.create({
        userId: req.user._id,
        documentId: doc._id,
        title: `${doc.title} — Practice Quiz`,
        subject: doc.subject,
        difficulty,
        questions,
      });

      res.json({ quiz });
      return;
    }

    const allowedTasks: PdfAnalysisTask[] = [
      'summary',
      'chapter_notes',
      'important_questions',
      'difficult_topics',
    ];
    if (!allowedTasks.includes(task)) {
      res.status(400).json({ error: 'Invalid PDF analysis task specified.' });
      return;
    }

    const resultText = await analyzePdfContent({
      title: doc.title,
      subject: doc.subject,
      text: doc.extractedText,
      task,
    });

    const patchMap: Record<PdfAnalysisTask, Partial<typeof doc>> = {
      summary: { summary: resultText },
      chapter_notes: { chapterNotes: resultText },
      important_questions: { importantQuestions: resultText },
      difficult_topics: { difficultTopics: resultText },
    };

    const updated = await dbStore.documents.updateByIdAndUser(
      doc._id,
      req.user._id,
      patchMap[task]
    );

    res.json({ document: updated, generated: resultText, task });
  } catch (err) {
    if (err instanceof AiServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'PDF analysis failed.' });
  }
}

export async function downloadDocumentNotes(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const doc = await dbStore.documents.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!doc) {
      res.status(404).json({ error: 'PDF document not found.' });
      return;
    }

    const sections: string[] = [];
    if (doc.summary) sections.push(`# Executive Summary\n\n${doc.summary}`);
    if (doc.chapterNotes) sections.push(`# Chapter-Wise Notes\n\n${doc.chapterNotes}`);
    if (doc.importantQuestions) sections.push(`# Important Questions\n\n${doc.importantQuestions}`);
    if (doc.difficultTopics) sections.push(`# Difficult Topics Explained\n\n${doc.difficultTopics}`);

    const content =
      sections.length > 0
        ? sections.join('\n\n')
        : `# Extracted Document Text\n\n${doc.extractedText.slice(0, 15000)}`;

    const pdfBuffer = await buildNotesPdfBuffer({
      title: `${doc.title} — Study Guide`,
      subject: doc.subject,
      subtitle: `${doc.pageCount} source pages`,
      content,
    });

    const safeFilename = doc.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'study_guide';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'PDF export failed.' });
  }
}

export async function deleteDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const doc = await dbStore.documents.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!doc) {
      res.status(404).json({ error: 'PDF document not found.' });
      return;
    }

    await dbStore.documents.deleteById(doc._id);
    removeFileSafely(doc.storedFilename);
    res.json({ message: 'PDF document deleted.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed.' });
  }
}
