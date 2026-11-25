# Student Study Assistant — AI-Based Academic Workspace

Student Study Assistant is a full-stack academic workspace built with React, Vite, Tailwind CSS, Express.js, Mongoose/MongoDB, and the Google Gemini API (`@google/genai`).

## Core Capabilities

- **Authentication & RBAC**: Student registration, JWT Bearer authentication, `bcryptjs` password hashing, profile & daily study goal management, one-time administrator-assisted password reset, and a first-run Admin Claim flow.
- **Student Dashboard**: Real-time summary of uploaded PDFs, generated notes, average quiz performance, study task progress, daily goal tracker, and recent activity feed.
- **AI Tutor Chatbot**: Subject-scoped conversations with **Detailed Academic** and **Simple Beginner** explanation modes, optional PDF context grounding, follow-up prompts, and persistent chat history.
- **PDF Study Studio**: Multer upload (up to 15 MB, `.pdf` + `%PDF-` binary verification), text extraction via `pdf-parse`, AI-generated executive summaries, chapter-wise notes, important exam questions, difficult-topic breakdowns, MCQ generation, and PDFKit export.
- **AI Quiz Lab**: Generate 3–15 MCQs from uploaded PDFs or custom topics across Easy, Medium, and Hard difficulty levels with server-side grading, answer explanations, and score history.
- **AI Notes Library**: Generate short notes, detailed lecture notes, important definitions, key points, and chapter summaries with downloadable PDF export.
- **Study Planner**: Schedule daily study blocks by subject, priority, duration, and completion state.
- **Admin Console**: Role-protected dashboard for monitoring platform totals, managing user roles/suspensions, issuing one-time reset codes, and moderating uploaded PDFs.

## Project Structure

```text
├── backend/
│   ├── config/          # Environment & MongoDB Mongoose connection
│   ├── controllers/     # Auth, Dashboard, Chat, PDF, Notes, Quiz, Planner, Admin
│   ├── middleware/      # JWT auth, RBAC, Multer PDF upload, rate limiters
│   ├── models/          # Mongoose schemas (User, Chat, Message, Document, GeneratedNotes, Quiz, QuizResult, StudyTask)
│   ├── routes/          # Express REST routers
│   ├── services/        # Server-side @google/genai service
│   └── utils/           # Unified Mongoose/local store adapter, validation, PDFKit export
├── src/
│   ├── components/      # AuthScreen, Sidebar, Header, MarkdownView, Skeleton
│   ├── context/         # AuthContext, ThemeContext, ToastContext
│   ├── pages/           # All 8 application views
│   ├── services/        # API fetch client (in-memory Bearer token)
│   └── types/           # Shared frontend TypeScript types
├── uploads/             # Confined PDF upload directory
├── server.ts            # Unified Express + Vite development/production server
├── .env.example         # Environment variable template
└── package.json
```

## Setup & Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (or AI Studio **Settings > Secrets**):
   - `GEMINI_API_KEY`: Required for all AI Tutor, PDF analysis, Notes, and Quiz generation endpoints.
   - `MONGODB_URI`: Optional MongoDB connection string. When omitted, the server persists records to a local JSON store (`data/scholara_db.json`) with matching schema behavior.
   - `ADMIN_PASSCODE`: Optional setup passcode required when claiming the first administrator account.
3. Run in development:
   ```bash
   npm run dev
   ```
4. Build and run in production:
   ```bash
   npm run build
   npm start
   ```

## REST API Reference

- **Auth**: `GET /api/auth/admin-status`, `POST /api/auth/claim-admin`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`
- **Dashboard**: `GET /api/dashboard/stats`
- **AI Tutor**: `GET /api/chats`, `POST /api/chats`, `GET /api/chats/:id`, `POST /api/chats/:id/messages`, `DELETE /api/chats/:id/messages`, `DELETE /api/chats/:id`
- **PDF Studio**: `GET /api/documents`, `POST /api/documents/upload`, `GET /api/documents/:id`, `POST /api/documents/:id/analyze`, `GET /api/documents/:id/download-notes`, `DELETE /api/documents/:id`
- **AI Notes**: `GET /api/notes`, `POST /api/notes/generate`, `GET /api/notes/:id/download`, `DELETE /api/notes/:id`
- **Quizzes**: `GET /api/quizzes`, `POST /api/quizzes/generate`, `POST /api/quizzes/:id/submit`, `DELETE /api/quizzes/:id`
- **Study Planner**: `GET /api/planner/tasks`, `POST /api/planner/tasks`, `PATCH /api/planner/tasks/:id`, `DELETE /api/planner/tasks/:id`
- **Admin (Admin role only)**: `GET /api/admin/overview`, `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `DELETE /api/admin/users/:id`, `GET /api/admin/documents`, `DELETE /api/admin/documents/:id`

## Author & Contact

- **Name**: Raghuraj Pratap Singh
- **Email**: `raghurajpratapsingh8787@gmail.com`

