import { Router, Request, Response } from 'express';
import { documentsDb, taxpayersDb } from '../db';
import { accountFrom, requireAuth, requireRole } from '../middleware/auth';
import type { CustomerDocument } from '../types';

const router = Router();
const statuses: CustomerDocument['status'][] = ['awaiting_review', 'in_review', 'approved', 'needs_info'];

router.use(requireAuth, requireRole('admin'));

router.get('/', (_req: Request, res: Response) => {
  const documents = documentsDb.all().map((document) => {
    const { file_name: _privateFileName, ...visible } = document;
    const taxpayer = taxpayersDb.get(document.taxpayer_id);
    return { ...visible, taxpayer_name: taxpayer?.name ?? 'Unknown customer', taxpayer_email: taxpayer?.email ?? '' };
  });
  return res.json(documents);
});

router.patch('/:id', (req: Request, res: Response) => {
  const document = documentsDb.get(Number(req.params.id));
  if (!document) return res.status(404).json({ error: 'Document not found' });

  const { status, review_notes } = req.body as { status?: CustomerDocument['status']; review_notes?: string };
  if (!status || !statuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${statuses.join(', ')}` });
  }
  if (review_notes !== undefined && typeof review_notes !== 'string') {
    return res.status(400).json({ error: 'review_notes must be text' });
  }

  const account = accountFrom(req);
  const updated = documentsDb.update(document.id, {
    status,
    reviewed_by: account.display_name,
    reviewed_at: new Date().toISOString(),
    review_notes: review_notes?.trim().slice(0, 2000),
  });
  const { file_name: _privateFileName, ...visible } = updated!;
  return res.json(visible);
});

export default router;