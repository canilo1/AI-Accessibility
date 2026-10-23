import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router, Request, Response, NextFunction } from 'express';
import { appealsDb, documentsDb, flagsDb, returnsDb, taxpayersDb } from '../db';
import { UPLOAD_DIRECTORY } from '../config';
import { accountFrom, requireAuth, requireRole } from '../middleware/auth';
import type { CustomerDocument } from '../types';

const router = Router();
const uploadDirectory = UPLOAD_DIRECTORY;
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes: Record<string, { extension: string; signature: (header: Buffer) => boolean }> = {
  'application/pdf': { extension: '.pdf', signature: (header) => header.subarray(0, 5).toString() === '%PDF-' },
  'image/jpeg': { extension: '.jpg', signature: (header) => header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff },
  'image/png': { extension: '.png', signature: (header) => header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const type = allowedTypes[file.mimetype];
      callback(null, `${randomUUID()}${type?.extension ?? '.upload'}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes[file.mimetype]) return callback(new Error('Only PDF, JPEG, or PNG documents are accepted'));
    return callback(null, true);
  },
});

function parseUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('document')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
      return;
    }
    if (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed' });
      return;
    }
    next();
  });
}

function publicDocument(document: CustomerDocument) {
  const { file_name: _privateFileName, ...publicFields } = document;
  return publicFields;
}

router.use(requireAuth, requireRole('customer'));

router.get('/dashboard', (req: Request, res: Response) => {
  const account = accountFrom(req);
  const taxpayer = account.taxpayer_id ? taxpayersDb.get(account.taxpayer_id) : undefined;
  if (!taxpayer) return res.status(404).json({ error: 'Customer profile not found' });
  const returns = returnsDb.byTaxpayer(taxpayer.id).map((taxReturn) => ({
    ...taxReturn,
    flags: flagsDb.byReturn(taxReturn.id),
  }));
  const documents = documentsDb.byTaxpayer(taxpayer.id).map(publicDocument);
  const appeals = appealsDb.all().filter((appeal) => appeal.taxpayer_id === taxpayer.id);
  return res.json({
    taxpayer: { id: taxpayer.id, name: taxpayer.name, email: taxpayer.email },
    returns,
    documents,
    appeals,
  });
});

router.post('/documents', parseUpload, (req: Request, res: Response) => {
  const account = accountFrom(req);
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Choose a document to upload' });

  const type = allowedTypes[file.mimetype];
  const header = Buffer.alloc(8);
  const descriptor = fs.openSync(file.path, 'r');
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!type?.signature(header)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'The uploaded file does not match its declared file type' });
  }

  const taxYear = Number(req.body.tax_year);
  const categories = ['tax_return', 'income_statement', 'expense_receipt', 'identity', 'other'];
  const category = req.body.category;
  if (!Number.isInteger(taxYear) || taxYear < 1900 || taxYear > new Date().getFullYear() + 1 || !categories.includes(category)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Choose a valid tax year and document category' });
  }

  const document = documentsDb.insert({
    taxpayer_id: account.taxpayer_id!,
    tax_year: taxYear,
    category,
    original_name: path.basename(file.originalname).slice(0, 255),
    file_name: file.filename,
    mime_type: file.mimetype,
    size: file.size,
    status: 'awaiting_review',
  });
  return res.status(201).json(publicDocument(document));
});

router.post('/appeals', (req: Request, res: Response) => {
  const account = accountFrom(req);
  const taxReturnId = Number(req.body.tax_return_id);
  const statement = typeof req.body.statement === 'string' ? req.body.statement.trim() : '';
  const taxReturn = returnsDb.get(taxReturnId);
  if (!taxReturn || taxReturn.taxpayer_id !== account.taxpayer_id) {
    return res.status(404).json({ error: 'Tax return not found' });
  }
  if (!statement) return res.status(400).json({ error: 'An appeal statement is required' });
  if (!['flagged', 'needs_review', 'approved_for_audit'].includes(taxReturn.status)) {
    return res.status(409).json({ error: 'This return is not currently eligible for an appeal' });
  }
  const appeal = appealsDb.insert({
    tax_return_id: taxReturn.id,
    taxpayer_id: account.taxpayer_id!,
    statement: statement.slice(0, 5000),
    status: 'pending',
  });
  return res.status(201).json(appeal);
});

export default router;