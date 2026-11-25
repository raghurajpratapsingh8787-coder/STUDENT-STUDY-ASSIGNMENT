import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, FileText, GraduationCap, Trash2, Upload } from 'lucide-react';
import { MarkdownView } from '../components/MarkdownView';
import { SkeletonRows } from '../components/Skeleton';
import type { NavSection } from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import { apiRequest, downloadAuthorizedPdf } from '../services/api';
import type { DocumentSummaryItem, FullDocument, QuizItem } from '../types';

type PdfTab =
  | 'summary'
  | 'chapter_notes'
  | 'important_questions'
  | 'difficult_topics'
  | 'extracted';

export function PdfAssistantPage({
  onNavigate,
}: {
  onNavigate: (section: NavSection) => void;
}) {
  const { notify } = useToast();

  const [docs, setDocs] = useState<DocumentSummaryItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FullDocument | null>(null);
  const [activeTab, setActiveTab] = useState<PdfTab>('summary');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingTask, setAnalyzingTask] = useState<string | null>(null);

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Computer Science');

  const openDocument = useCallback(
    async (id: string) => {
      setLoadingDoc(true);
      try {
        const res = await apiRequest<{ document: FullDocument }>(`/api/documents/${id}`);
        setSelectedDoc(res.document);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to open document.', 'error');
      } finally {
        setLoadingDoc(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    let mounted = true;
    apiRequest<{ documents: DocumentSummaryItem[] }>('/api/documents')
      .then((res) => {
        if (!mounted) return;
        setDocs(res.documents);
        if (res.documents.length > 0) {
          openDocument(res.documents[0]._id);
        }
      })
      .catch((err) => {
        if (mounted) {
          notify(err instanceof Error ? err.message : 'Could not load PDF library.', 'error');
        }
      })
      .finally(() => {
        if (mounted) setLoadingList(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify, openDocument]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      notify('Please choose a PDF file first.', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title.trim()) formData.append('title', title.trim());
      formData.append('subject', subject.trim() || 'General');

      const res = await apiRequest<{ document: FullDocument }>('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const summaryItem: DocumentSummaryItem = {
        _id: res.document._id,
        title: res.document.title,
        originalName: res.document.originalName,
        fileSize: res.document.fileSize,
        pageCount: res.document.pageCount,
        subject: res.document.subject,
        hasSummary: false,
        hasChapterNotes: false,
        hasImportantQuestions: false,
        hasDifficultTopics: false,
        textPreview: res.document.extractedText.slice(0, 400),
        createdAt: res.document.createdAt,
        updatedAt: res.document.updatedAt,
      };

      setDocs((prev) => [summaryItem, ...prev]);
      setSelectedDoc(res.document);
      setActiveTab('extracted');
      setFile(null);
      setTitle('');
      notify('PDF uploaded and text extracted successfully.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'PDF upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis(
    task: 'summary' | 'chapter_notes' | 'important_questions' | 'difficult_topics'
  ) {
    if (!selectedDoc) return;
    setAnalyzingTask(task);
    try {
      const res = await apiRequest<{ document: FullDocument }>(
        `/api/documents/${selectedDoc._id}/analyze`,
        {
          method: 'POST',
          body: JSON.stringify({ task }),
        }
      );
      setSelectedDoc(res.document);
      setDocs((prev) =>
        prev.map((d) =>
          d._id === res.document._id
            ? {
                ...d,
                hasSummary: Boolean(res.document.summary),
                hasChapterNotes: Boolean(res.document.chapterNotes),
                hasImportantQuestions: Boolean(res.document.importantQuestions),
                hasDifficultTopics: Boolean(res.document.difficultTopics),
              }
            : d
        )
      );
      notify('AI analysis completed.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Analysis failed.', 'error');
    } finally {
      setAnalyzingTask(null);
    }
  }

  async function handleGenerateMcqs() {
    if (!selectedDoc) return;
    setAnalyzingTask('mcqs');
    try {
      const res = await apiRequest<{ quiz: QuizItem }>(
        `/api/documents/${selectedDoc._id}/analyze`,
        {
          method: 'POST',
          body: JSON.stringify({ task: 'mcqs', difficulty: 'Medium' }),
        }
      );
      notify(`Created "${res.quiz.title}" in Quiz Lab.`, 'success');
      onNavigate('quizzes');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not generate MCQs.', 'error');
    } finally {
      setAnalyzingTask(null);
    }
  }

  async function handleDownloadGuide() {
    if (!selectedDoc) return;
    try {
      await downloadAuthorizedPdf(
        `/api/documents/${selectedDoc._id}/download-notes`,
        `${selectedDoc.title}.pdf`
      );
      notify('Study guide PDF downloaded.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Download failed.', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
      const remaining = docs.filter((d) => d._id !== id);
      setDocs(remaining);
      if (selectedDoc?._id === id) {
        if (remaining.length > 0) {
          await openDocument(remaining[0]._id);
        } else {
          setSelectedDoc(null);
        }
      }
      notify('PDF document removed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  const tabContentMap: Record<PdfTab, string> = {
    summary: selectedDoc?.summary || '',
    chapter_notes: selectedDoc?.chapterNotes || '',
    important_questions: selectedDoc?.importantQuestions || '',
    difficult_topics: selectedDoc?.difficultTopics || '',
    extracted: selectedDoc?.extractedText || '',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Upload + Library */}
      <div className="lg:col-span-4 space-y-6">
        <form
          onSubmit={handleUpload}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upload Study PDF
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Text-based PDFs up to 15 MB
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              PDF File
            </label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const chosen = e.target.files?.[0] || null;
                setFile(chosen);
                if (chosen && !title) {
                  setTitle(chosen.name.replace(/\.pdf$/i, ''));
                }
              }}
              className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems Chapter 4"
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
              placeholder="Computer Science"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Extracting Text...' : 'Upload & Parse PDF'}</span>
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Uploaded Library ({docs.length})
          </h3>
          {loadingList ? (
            <SkeletonRows count={3} />
          ) : docs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No PDFs uploaded yet. Upload lecture slides, research papers, or textbook chapters
              above.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {docs.map((doc) => {
                const isSelected = selectedDoc?._id === doc._id;
                return (
                  <div key={doc._id} className="py-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openDocument(doc._id)}
                      className={`flex-1 text-left min-w-0 rounded-lg p-1.5 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {doc.subject} · {doc.pageCount} pages ·{' '}
                        {Math.max(1, Math.round(doc.fileSize / 1024))} KB
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label="Delete PDF"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interactive Study Workbench */}
      <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col">
        {loadingDoc ? (
          <SkeletonRows count={6} />
        ) : !selectedDoc ? (
          <div className="my-auto py-16 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Select or upload a PDF to analyze
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Generate executive summaries, chapter-wise study notes, important exam questions,
              plain-language breakdowns of tough concepts, and practice MCQs.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedDoc.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedDoc.subject} · {selectedDoc.pageCount} pages ·{' '}
                  {selectedDoc.originalName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={Boolean(analyzingTask)}
                  onClick={handleGenerateMcqs}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{analyzingTask === 'mcqs' ? 'Generating MCQs...' : 'Generate MCQs'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGuide}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Study PDF</span>
                </button>
              </div>
            </div>

            {/* Analysis Tabs */}
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(
                [
                  { id: 'summary', label: 'Summary' },
                  { id: 'chapter_notes', label: 'Chapter Notes' },
                  { id: 'important_questions', label: 'Important Questions' },
                  { id: 'difficult_topics', label: 'Difficult Topics' },
                  { id: 'extracted', label: 'Extracted Text' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'extracted' ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 max-h-[540px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedDoc.extractedText}
                </pre>
              </div>
            ) : tabContentMap[activeTab] ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={Boolean(analyzingTask)}
                    onClick={() => runAnalysis(activeTab)}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {analyzingTask === activeTab ? 'Regenerating...' : 'Regenerate Analysis'}
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-5 max-h-[560px] overflow-y-auto">
                  <MarkdownView content={tabContentMap[activeTab]} />
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No {activeTab.replace('_', ' ')} generated for this PDF yet.
                </p>
                <button
                  type="button"
                  disabled={Boolean(analyzingTask)}
                  onClick={() => runAnalysis(activeTab)}
                  className="inline-flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-medium transition-colors"
                >
                  {analyzingTask === activeTab
                    ? 'Analyzing PDF with Gemini...'
                    : `Generate ${activeTab.replace('_', ' ')}`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
