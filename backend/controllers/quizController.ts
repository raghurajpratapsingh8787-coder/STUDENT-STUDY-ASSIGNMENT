import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { QuizDifficulty } from '../models/Quiz.ts';
import { AiServiceError, generateQuizQuestions } from '../services/geminiService.ts';
import { dbStore } from '../utils/store.ts';
import { asCleanString, asPositiveInt } from '../utils/validation.ts';

export async function listQuizzes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const [quizzes, results] = await Promise.all([
      dbStore.quizzes.findByUser(req.user._id),
      dbStore.quizResults.findByUser(req.user._id),
    ]);

    res.json({ quizzes, results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load quizzes.' });
  }
}

export async function generateQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const topicInput = asCleanString(req.body?.topic, 200);
    const subject = asCleanString(req.body?.subject, 80) || 'General';
    const difficulty: QuizDifficulty =
      req.body?.difficulty === 'Easy' || req.body?.difficulty === 'Hard'
        ? req.body.difficulty
        : 'Medium';
    const count = asPositiveInt(req.body?.count, 3, 15, 5);
    const documentId =
      typeof req.body?.documentId === 'string' && req.body.documentId.trim()
        ? req.body.documentId.trim()
        : null;

    let documentContext: string | undefined;
    let resolvedTopic = topicInput;

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
      res.status(400).json({ error: 'Please specify a topic or select an uploaded PDF.' });
      return;
    }

    const questions = await generateQuizQuestions({
      topic: resolvedTopic,
      subject,
      difficulty,
      count,
      documentContext,
    });

    const quiz = await dbStore.quizzes.create({
      userId: req.user._id,
      documentId,
      title: `${resolvedTopic} (${difficulty})`.slice(0, 200),
      subject,
      difficulty,
      questions,
    });

    res.status(201).json({ quiz });
  } catch (err) {
    if (err instanceof AiServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Quiz generation failed.' });
  }
}

export async function submitQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const quiz = await dbStore.quizzes.findByIdAndUser(String(req.params.id || ''), req.user._id);
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const timeTakenSeconds = asPositiveInt(req.body?.timeTakenSeconds, 0, 7200, 0);

    const normalizedAnswers = quiz.questions.map((_, idx) => {
      const val = Number(rawAnswers[idx]);
      return Number.isInteger(val) && val >= 0 && val <= 3 ? val : -1;
    });

    let score = 0;
    const review = quiz.questions.map((q, idx) => {
      const selectedIndex = normalizedAnswers[idx];
      const isCorrect = selectedIndex === q.correctIndex;
      if (isCorrect) score += 1;
      return {
        question: q.question,
        options: q.options,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / Math.max(1, totalQuestions)) * 100);

    const result = await dbStore.quizResults.create({
      userId: req.user._id,
      quizId: quiz._id,
      quizTitle: quiz.title,
      subject: quiz.subject,
      difficulty: quiz.difficulty,
      answers: normalizedAnswers,
      score,
      totalQuestions,
      percentage,
      timeTakenSeconds,
    });

    res.status(201).json({ result, review });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Quiz submission failed.' });
  }
}

export async function deleteQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const deleted = await dbStore.quizzes.deleteByIdAndUser(
      String(req.params.id || ''),
      req.user._id
    );
    if (!deleted) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }
    res.json({ message: 'Quiz deleted.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete quiz.' });
  }
}
