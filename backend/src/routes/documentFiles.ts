import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { documentsDb } from '../db';
import { UPLOAD_DIRECTORY } from '../config';
import { accountFrom, requireAuth } from '../middleware/auth';

const router = Router();
const uploadDirectory = UPLOAD_DIRECTORY;

router.get('/:id/download', requireAuth, (req: Request, res: Response) => {
  const document = documentsDb.get(Number(req.params.id));
  if (!document) return res.status(404).json({ error: 'Document not found' });

  const account = accountFrom(req);
  if (account.role !== 'admin' && account.taxpayer_id !== document.taxpayer_id) {
    return res.status(403).json({ error: 'You do not have permission to access this document' });
  }

  const filePath = path.join(UPLOAD_DIRECTORY, path.basename(document.file_name));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Document file is unavailable' });
  res.download(filePath, document.original_name);
});

export default router;