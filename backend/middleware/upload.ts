import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${crypto.randomUUID()}.pdf`);
  },
});

export const pdfUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validMime =
      file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
    if (ext !== '.pdf' || !validMime) {
      cb(new Error('Only valid PDF files (.pdf) are allowed.'));
      return;
    }
    cb(null, true);
  },
});
