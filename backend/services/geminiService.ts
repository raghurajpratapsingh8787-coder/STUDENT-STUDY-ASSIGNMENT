import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.ts';
import type { ChatMode } from '../models/Chat.ts';
import type { NoteType } from '../models/GeneratedNotes.ts';
import type { IQuizQuestion, QuizDifficulty } from '../models/Quiz.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';

export class AiServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || env.geminiApiKey || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiServiceError(
      'GEMINI_API_KEY is not configured. Open Settings > Secrets in AI Studio and add GEMINI_API_KEY to enable AI study assistance.',
      503
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // not raw JSON
  }
  return raw;
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        await new Promise((r) => setTimeout(r, attempt * 800));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

function handleGeminiError(err: unknown): never {
  if (err instanceof AiServiceError) throw err;
  const message = extractCleanErrorMessage(err);
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403') || raw.includes('401')) {
    throw new AiServiceError(
      'The configured GEMINI_API_KEY was rejected. Please verify your API key in Settings > Secrets.',
      502
    );
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    throw new AiServiceError(
      'Gemini API rate limit reached. Please wait a moment before sending another request.',
      429
    );
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    throw new AiServiceError(
      'Requested Gemini model is currently unavailable. Please try again shortly.',
      502
    );
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    throw new AiServiceError(
      'The AI service is temporarily experiencing high demand. Please retry in a few seconds.',
      503
    );
  }
  throw new AiServiceError(`AI generation failed: ${message}`, 502);
}

export async function askStudyAssistant(params: {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  subject: string;
  mode: ChatMode;
  documentContext?: string;
}): Promise<string> {
  const ai = getClient();

  const styleGuide =
    params.mode === 'beginner'
      ? 'Explain concepts simply for beginners using intuitive analogies, clear step-by-step breakdowns, and jargon-free language before introducing formal terms.'
      : 'Provide rigorous, comprehensive academic explanations with structured headings, clear reasoning, formulas or mechanisms where relevant, and concrete examples.';

  const contextBlock = params.documentContext
    ? `\n\nReference Study Material Excerpt:\n"""\n${params.documentContext.slice(0, 24000)}\n"""\nGround your answers in this study material when relevant.`
    : '';

  const systemInstruction = `You are Student Study Assistant, an expert university-level academic tutor specializing in ${params.subject}.
${styleGuide}
Always encourage critical thinking, format responses cleanly with Markdown headings and bullet points, and suggest 1-2 thoughtful follow-up questions at the end when helpful.${contextBlock}`;

  const recentHistory = params.history.slice(-12);
  const transcript = recentHistory
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n\n');

  const prompt = transcript
    ? `Previous conversation:\n${transcript}\n\nStudent: ${params.message}\n\nRespond directly as Tutor:`
    : params.message;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
        },
      })
    );
    const text = (response.text || '').trim();
    if (!text) {
      throw new AiServiceError('AI returned an empty response. Please rephrase your question.', 502);
    }
    return text;
  } catch (err) {
    handleGeminiError(err);
  }
}

export type PdfAnalysisTask =
  | 'summary'
  | 'chapter_notes'
  | 'important_questions'
  | 'difficult_topics';

export async function analyzePdfContent(params: {
  title: string;
  subject: string;
  text: string;
  task: PdfAnalysisTask;
}): Promise<string> {
  const ai = getClient();
  const excerpt = params.text.slice(0, 40000);

  const taskPrompts: Record<PdfAnalysisTask, string> = {
    summary:
      'Write a clear, structured executive summary of this document. Include: Core Thesis/Objective, Major Sections Covered, Key Takeaways, and Practical Applications.',
    chapter_notes:
      'Create organized chapter-wise or section-wise study notes from this document. Use clear headings for each section, bulleted core concepts, formulas/principles, and concise takeaways.',
    important_questions:
      'Generate 10 high-yield exam and conceptual review questions based on this document, grouped by Short Answer and Long Analytical Questions, each paired with a concise model answer outline.',
    difficult_topics:
      'Identify the 4-6 most challenging or nuanced concepts in this document. For each topic, explain why students find it tricky, break it down step-by-step in plain language, and give a memorable analogy or worked example.',
  };

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Document Title: ${params.title}\nSubject: ${params.subject}\n\nTask: ${taskPrompts[params.task]}\n\nDocument Text:\n"""\n${excerpt}\n"""`,
        config: {
          systemInstruction:
            'You are an academic study architect. Output clean, well-structured Markdown suitable for university revision.',
        },
      })
    );
    const text = (response.text || '').trim();
    if (!text) throw new AiServiceError('AI could not analyze this document.', 502);
    return text;
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function generateStructuredNotes(params: {
  topic: string;
  subject: string;
  noteType: NoteType;
  documentContext?: string;
}): Promise<string> {
  const ai = getClient();

  const noteTypeInstructions: Record<NoteType, string> = {
    short: 'Create crisp, high-density revision short notes ideal for quick pre-exam review (bulleted, scannable, under 500 words).',
    detailed: 'Create comprehensive, structured lecture-grade study notes with clear sections, explanations, mechanisms, and worked examples.',
    definitions: 'Compile a glossary of essential terminology and formal definitions with brief context on how each term is applied.',
    key_points: 'Extract the critical core concepts, laws, theorems, and high-yield bullet points students must memorize.',
    chapter_summary: 'Write a cohesive chapter summary outlining the narrative arc, major arguments, supporting evidence, and synthesis.',
  };

  const contextSection = params.documentContext
    ? `\n\nBase these notes primarily on the following uploaded PDF content:\n"""\n${params.documentContext.slice(0, 35000)}\n"""`
    : '';

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Subject: ${params.subject}\nTopic / Title: ${params.topic}\nFormat: ${noteTypeInstructions[params.noteType]}${contextSection}`,
        config: {
          systemInstruction:
            'You are an academic note-taking specialist. Write accurate, clearly organized Markdown notes with headings, bullet points, and bold key terms.',
        },
      })
    );
    const text = (response.text || '').trim();
    if (!text) throw new AiServiceError('AI returned empty notes.', 502);
    return text;
  } catch (err) {
    handleGeminiError(err);
  }
}

export async function generateQuizQuestions(params: {
  topic: string;
  subject: string;
  difficulty: QuizDifficulty;
  count: number;
  documentContext?: string;
}): Promise<IQuizQuestion[]> {
  const ai = getClient();

  const contextSection = params.documentContext
    ? `\n\nUse the following document excerpt as the source material:\n"""\n${params.documentContext.slice(0, 32000)}\n"""`
    : '';

  const prompt = `Generate exactly ${params.count} multiple-choice academic quiz questions on "${params.topic}" in subject "${params.subject}" at "${params.difficulty}" difficulty.
Each question must have exactly 4 distinct options, a valid correctIndex (0, 1, 2, or 3), and a clear explanation of why the correct answer is right.${contextSection}`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a university exam author. Create rigorous, unambiguous multiple-choice questions with plausible distractors and educational explanations.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: 'The question stem.' },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exactly 4 answer choices.',
                },
                correctIndex: {
                  type: Type.INTEGER,
                  description: 'Zero-based index (0-3) of the correct option.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Concise explanation of the correct answer.',
                },
              },
              required: ['question', 'options', 'correctIndex', 'explanation'],
            },
          },
        },
      })
    );

    const raw = (response.text || '[]').trim();
    const parsed = JSON.parse(raw) as Array<{
      question?: unknown;
      options?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new AiServiceError('AI could not generate valid quiz questions.', 502);
    }

    const sanitized: IQuizQuestion[] = parsed
      .map((item) => {
        const opts = Array.isArray(item.options)
          ? item.options.slice(0, 4).map((o) => String(o))
          : [];
        if (opts.length !== 4) return null;
        const idx = Number(item.correctIndex);
        const safeIdx = Number.isInteger(idx) && idx >= 0 && idx <= 3 ? idx : 0;
        return {
          question: String(item.question || '').trim(),
          options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string],
          correctIndex: safeIdx,
          explanation: String(item.explanation || 'Review this concept in your study notes.').trim(),
        };
      })
      .filter((q): q is IQuizQuestion => Boolean(q && q.question));

    if (sanitized.length === 0) {
      throw new AiServiceError('Generated quiz questions failed format validation.', 502);
    }

    return sanitized;
  } catch (err) {
    handleGeminiError(err);
  }
}
