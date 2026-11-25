import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { NoteType } from '../models/GeneratedNotes.ts';
import { AiServiceError, generateStructuredNotes } from '../services/geminiService.ts';
import { buildNotesPdfBuffer } from '../utils/pdfExport.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString } from '../utils/validation.ts';

const VALID_NOTE_TYPES: NoteType[] = [
  'short',
  'detailed',
  'definitions',
  'key_points',
  'chapter_summary',
];

const NOTE_LABELS: Record<NoteType, string> = {
  short: 'Short Notes',
  detailed: 'Detailed Notes',
  definitions: 'Important Definitions',
  key_points: 'Key Points',
  chapter_summary: 'Chapter Summary',
};

export async function listNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    const notes = await dbStore.notes.findByUser(req.user._id);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list notes.' });
  }
}

export async function generateNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const topic = asCleanString(req.body?.topic, 300);
    const subject = asCleanString(req.body?.subject, 80) || 'General';
    const noteType = req.body?.noteType as NoteType;
    const documentId =
      typeof req.body?.documentId === 'string' && req.body.documentId.trim()
        ? req.body.documentId.trim()
        : null;

    if (!VALID_NOTE_TYPES.includes(noteType)) {
      res.status(400).json({ error: 'Invalid note format selected.' });
      return;
    }

    let documentContext: string | undefined;
    let resolvedTopic = topic;

    if (documentId) {
      const doc = await dbStore.documents.findByIdAndUser(documentId, req.user._id);
      if (!doc) {
        res.status(404).json({ error: 'Selected PDF document not found.' });
        return;
      }
      documentContext = doc.extractedText;
      if (!resolvedTopic) {
        resolvedTopic = doc.title;
      }
    }

    if (!resolvedTopic) {
      res.status(400).json({ error: 'Please enter a topic or select an uploaded PDF.' });
      return;
    }

    const content = await generateStructuredNotes({
      topic: resolvedTopic,
      subject,
      noteType,
      documentContext,
    });

    const title = `${resolvedTopic} — ${NOTE_LABELS[noteType]}`.slice(0, 200);
    const note = await dbStore.notes.create({
      userId: req.user._id,
      documentId,
      title,
      subject,
      noteType,
      sourceTopic: resolvedTopic,
      content,
    });

    res.status(201).json({ note });
  } catch (err) {
    if (err instanceof AiServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Notes generation failed.' });
  }
}

export async function downloadNotePdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const note = await dbStore.notes.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!note) {
      res.status(404).json({ error: 'Notes entry not found.' });
      return;
    }

    const pdfBuffer = await buildNotesPdfBuffer({
      title: note.title,
      subject: note.subject,
      subtitle: NOTE_LABELS[note.noteType] || 'Study Notes',
      content: note.content,
    });

    const safeName = note.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'study_notes';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'PDF download failed.' });
  }
}

export async function deleteNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const deleted = await dbStore.notes.deleteByIdAndUser(
      String(req.params.id || ''),
      req.user._id
    );
    if (!deleted) {
      res.status(404).json({ error: 'Notes entry not found.' });
      return;
    }
    res.json({ message: 'Notes deleted.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete notes.' });
  }
}
