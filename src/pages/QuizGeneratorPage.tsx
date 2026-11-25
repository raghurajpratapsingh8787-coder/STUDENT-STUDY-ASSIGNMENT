import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, GraduationCap, Play, Trash2, XCircle } from 'lucide-react';
import { SkeletonRows } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type {
  DocumentSummaryItem,
  QuizDifficulty,
  QuizItem,
  QuizResultItem,
  QuizReviewItem,
} from '../types';

export function QuizGeneratorPage() {
  const { notify } = useToast();

  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [docs, setDocs] = useState<DocumentSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generator controls
  const [documentId, setDocumentId] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [count, setCount] = useState(5);

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submissionReview, setSubmissionReview] = useState<{
    result: QuizResultItem;
    review: QuizReviewItem[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<{ quizzes: QuizItem[]; results: QuizResultItem[] }>('/api/quizzes'),
      apiRequest<{ documents: DocumentSummaryItem[] }>('/api/documents'),
    ])
      .then(([quizRes, docRes]) => {
        if (!mounted) return;
        setQuizzes(quizRes.quizzes);
        setResults(quizRes.results);
        setDocs(docRes.documents);
      })
      .catch((err) => {
        if (mounted) {
          notify(err instanceof Error ? err.message : 'Could not load quizzes.', 'error');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [notify]);

  function startQuiz(quiz: QuizItem) {
    setActiveQuiz(quiz);
    setSelectedAnswers(new Array(quiz.questions.length).fill(-1));
    setStartedAt(Date.now());
    setSubmissionReview(null);
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() && !documentId) {
      notify('Enter a topic or choose an uploaded PDF.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const res = await apiRequest<{ quiz: QuizItem }>('/api/quizzes/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim() || 'General',
          difficulty,
          count,
          documentId: documentId || null,
        }),
      });
      setQuizzes((prev) => [res.quiz, ...prev]);
      startQuiz(res.quiz);
      notify('Quiz generated and ready.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Quiz generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitQuiz() {
    if (!activeQuiz) return;
    if (selectedAnswers.some((a) => a === -1)) {
      notify('Please answer all questions before submitting.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const timeTakenSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const res = await apiRequest<{ result: QuizResultItem; review: QuizReviewItem[] }>(
        `/api/quizzes/${activeQuiz._id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers: selectedAnswers, timeTakenSeconds }),
        }
      );
      setSubmissionReview(res);
      setResults((prev) => [res.result, ...prev]);
      notify(`Quiz graded: ${res.result.score}/${res.result.totalQuestions} (${res.result.percentage}%).`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Quiz submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteQuiz(id: string) {
    try {
      await apiRequest(`/api/quizzes/${id}`, { method: 'DELETE' });
      setQuizzes((prev) => prev.filter((q) => q._id !== id));
      if (activeQuiz?._id === id) {
        setActiveQuiz(null);
        setSubmissionReview(null);
      }
      notify('Quiz removed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete quiz.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Grid: Generator + Active Player / Result Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 h-fit"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Generate AI Quiz
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Build multiple-choice drills from PDFs or topics
            </p>
          </div>

          {docs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Source PDF (Optional)
              </label>
              <select
                value={documentId}
                onChange={(e) => {
                  setDocumentId(e.target.value);
                  const chosen = docs.find((d) => d._id === e.target.value);
                  if (chosen) {
                    setSubject(chosen.subject);
                    if (!topic) setTopic(chosen.title);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">Custom Topic Only</option>
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
              Topic Focus
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Memory Paging & Virtual Memory"
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
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(['Easy', 'Medium', 'Hard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    difficulty === level
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Number of Questions
            </label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono"
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} Questions
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            <span>{generating ? 'Generating Quiz...' : 'Generate Quiz'}</span>
          </button>
        </form>

        {/* Active Quiz / Results Area */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col">
          {!activeQuiz ? (
            <div className="my-auto py-14 text-center space-y-3">
              <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ready for practice assessment
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Generate a new quiz on the left or launch any saved quiz below to test your recall
                and receive detailed answer explanations.
              </p>
            </div>
          ) : submissionReview ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {submissionReview.result.quizTitle} — Results
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {submissionReview.result.subject} · {submissionReview.result.difficulty} ·{' '}
                    Completed in {submissionReview.result.timeTakenSeconds}s
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                    {submissionReview.result.percentage}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {submissionReview.result.score} / {submissionReview.result.totalQuestions}{' '}
                    correct
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {submissionReview.review.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {idx + 1}. {item.question}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${
                          item.isCorrect
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Incorrect
                          </>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {item.options.map((opt, optIdx) => {
                        const isChosen = optIdx === item.selectedIndex;
                        const isAnswer = optIdx === item.correctIndex;
                        return (
                          <div
                            key={optIdx}
                            className={`rounded-lg border px-3 py-2 ${
                              isAnswer
                                ? 'border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                                : isChosen
                                ? 'border-red-400/60 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                      <span className="font-semibold">Explanation:</span> {item.explanation}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => startQuiz(activeQuiz)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Retake Quiz
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {activeQuiz.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeQuiz.subject} · {activeQuiz.difficulty} · {activeQuiz.questions.length}{' '}
                    questions
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {selectedAnswers.filter((a) => a !== -1).length} / {activeQuiz.questions.length}{' '}
                  answered
                </span>
              </div>

              <div className="space-y-5">
                {activeQuiz.questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((option, optIdx) => {
                        const checked = selectedAnswers[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              setSelectedAnswers((prev) => {
                                const next = [...prev];
                                next[qIdx] = optIdx;
                                return next;
                              });
                            }}
                            className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              checked
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-mono text-xs mr-2 opacity-70">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitQuiz}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-medium transition-colors"
                >
                  <span>{submitting ? 'Checking Answers...' : 'Submit Quiz'}</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Row: Saved Quizzes + Previous Quiz History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Saved Quiz Sets ({quizzes.length})
          </h3>
          {loading ? (
            <SkeletonRows count={3} />
          ) : quizzes.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              No saved quizzes yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {quizzes.map((q) => (
                <div key={q._id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {q.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {q.subject} · {q.difficulty} · {q.questions.length} Qs
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startQuiz(q)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Play className="w-3 h-3" />
                      <span>Take</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(q._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label="Delete quiz"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Previous Quiz History ({results.length})
          </h3>
          {loading ? (
            <SkeletonRows count={4} />
          ) : results.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Completed quiz attempts and scores will be recorded here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-3 font-medium">Quiz</th>
                    <th className="py-2 px-3 font-medium">Difficulty</th>
                    <th className="py-2 px-3 font-medium text-right">Score</th>
                    <th className="py-2 pl-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {results.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {r.quizTitle}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.subject}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.difficulty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {r.score}/{r.totalQuestions} ({r.percentage}%)
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {new Date(r.completedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
