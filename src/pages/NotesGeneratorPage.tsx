import { useEffect, useState, type FormEvent } from 'react';
import { Download, NotebookPen, Trash2 } from 'lucide-react';
import { MarkdownView } from '../components/MarkdownView';
import { SkeletonRows } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { apiRequest, downloadAuthorizedPdf } from '../services/api';
import type { DocumentSummaryItem, GeneratedNote, NoteType } from '../types';

const NOTE_TYPE_OPTIONS: Array<{ value: NoteType; label: string }> = [
  { value: 'short', label: 'Short Notes' },
  { value: 'detailed', label: 'Detailed Notes' },
  { value: 'definitions', label: 'Important Definitions' },
  { value: 'key_points', label: 'Key Points' },
  { value: 'chapter_summary', label: 'Chapter Summary' },
];

export function NotesGeneratorPage() {
  const { notify } = useToast();

  const [notes, setNotes] = useState<GeneratedNote[]>([]);
  const [docs, setDocs] = useState<DocumentSummaryItem[]>([]);
  const [selectedNote, setSelectedNote] = useState<GeneratedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [noteType, setNoteType] = useState<NoteType>('detailed');
  const [documentId, setDocumentId] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ notes: GeneratedNote[] }>('/api/notes'),
      apiRequest<{ documents: DocumentSummaryItem[] }>('/api/documents'),
    ])
      .then(([notesRes, docsRes]) => {
        if (!mounted) return;
        setNotes(notesRes.notes);
        setDocs(docsRes.documents);
        if (notesRes.notes.length > 0) {
          setSelectedNote(notesRes.notes[0]);
        }
      })
      .catch((err) => {
        if (mounted) {
          notify(err instanceof Error ? err.message : 'Failed to load notes.', 'error');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() && !documentId) {
      notify('Enter a topic or select an uploaded PDF.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await apiRequest<{ note: GeneratedNote }>('/api/notes/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim() || 'General',
          noteType,
          documentId: documentId || null,
        }),
      });
      setNotes((prev) => [res.note, ...prev]);
      setSelectedNote(res.note);
      notify('Study notes generated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Notes generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(note: GeneratedNote) {
    try {
      await downloadAuthorizedPdf(`/api/notes/${note._id}/download`, `${note.title}.pdf`);
      notify('Notes exported as PDF.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'PDF download failed.', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiRequest(`/api/notes/${id}`, { method: 'DELETE' });
      const remaining = notes.filter((n) => n._id !== id);
      setNotes(remaining);
      if (selectedNote?._id === id) {
        setSelectedNote(remaining[0] || null);
      }
      notify('Notes entry deleted.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete notes.', 'error');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Form & Saved Notes */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              AI Notes Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate revision sheets and export as PDF
            </p>
          </div>

          {docs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Reference PDF (Optional)
              </label>
              <select
                value={documentId}
                onChange={(e) => {
                  setDocumentId(e.target.value);
                  const doc = docs.find((d) => d._id === e.target.value);
                  if (doc) {
                    setSubject(doc.subject);
                    if (!topic) setTopic(doc.title);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">Generate from Topic</option>
                {docs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Topic or Chapter Name
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Organic Reaction Mechanisms"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Note Format
            </label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {NOTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <NotebookPen className="w-4 h-4" />
            <span>{generating ? 'Composing Notes...' : 'Generate Notes'}</span>
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Saved Notes ({notes.length})
          </h3>
          {loading ? (
            <SkeletonRows count={4} />
          ) : notes.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No notes generated yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto">
              {notes.map((n) => (
                <div key={n._id} className="py-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNote(n)}
                    className={`flex-1 text-left min-w-0 rounded-lg p-1.5 transition-colors ${
                      selectedNote?._id === n._id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {n.subject} · {n.noteType.replace('_', ' ')}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(n._id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Reader Pane */}
      <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col">
        {!selectedNote ? (
          <div className="my-auto py-16 text-center space-y-3">
            <NotebookPen className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Select or generate study notes
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Choose short revision sheets, detailed lecture notes, important definitions, key
              points, or chapter summaries. Download any note as a formatted PDF.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedNote.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedNote.subject} · {selectedNote.noteType.replace('_', ' ')} ·{' '}
                  {new Date(selectedNote.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(selectedNote)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-5 max-h-[620px] overflow-y-auto">
              <MarkdownView content={selectedNote.content} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
