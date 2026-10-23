import { Router, Request, Response } from 'express';
import { appealsDb, returnsDb, taxpayersDb } from '../db';
import type { Appeal } from '../types';

const router = Router();

// GET /api/appeals — list all appeals
router.get('/', (_req: Request, res: Response) => {
  const all = appealsDb.all().map((a) => {
    const r = returnsDb.get(a.tax_return_id);
    const tp = taxpayersDb.get(a.taxpayer_id);
    return { ...a, taxpayer_name: tp?.name ?? '', tax_year: r?.tax_year ?? null };
  });
  return res.json(all);
});

// GET /api/appeals/:id
router.get('/:id', (req: Request, res: Response) => {
  const appeal = appealsDb.get(Number(req.params.id));
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  const r  = returnsDb.get(appeal.tax_return_id);
  const tp = taxpayersDb.get(appeal.taxpayer_id);
  return res.json({ ...appeal, taxpayer_name: tp?.name ?? '', tax_year: r?.tax_year ?? null });
});

// POST /api/appeals — taxpayer submits appeal
router.post('/', (req: Request, res: Response) => {
  const { tax_return_id, taxpayer_id, statement } = req.body as Partial<Appeal>;

  if (!tax_return_id || !taxpayer_id || !statement?.trim()) {
    return res.status(400).json({ error: 'tax_return_id, taxpayer_id, and statement are required' });
  }

  const taxReturn = returnsDb.get(tax_return_id);
  if (!taxReturn) return res.status(404).json({ error: 'Tax return not found' });
  if (!taxpayersDb.get(taxpayer_id)) return res.status(404).json({ error: 'Taxpayer not found' });

  if (!['flagged', 'needs_review', 'approved_for_audit'].includes(taxReturn.status)) {
    return res.status(409).json({ error: `Appeals can only be submitted for flagged or under-review returns. Current status: ${taxReturn.status}` });
  }

  const appeal = appealsDb.insert({ tax_return_id, taxpayer_id, statement, status: 'pending' });
  return res.status(201).json(appeal);
});

// POST /api/appeals/:id/resolve — investigator resolves appeal
router.post('/:id/resolve', (req: Request, res: Response) => {
  const appeal = appealsDb.get(Number(req.params.id));
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  if (appeal.status !== 'pending') {
    return res.status(409).json({ error: `Appeal is already ${appeal.status}` });
  }

  const { status, resolved_by, resolution_notes } = req.body as {
    status: 'accepted' | 'rejected';
    resolved_by?: string;
    resolution_notes?: string;
  };

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'accepted' or 'rejected'" });
  }

  const resolved = appealsDb.resolve(Number(req.params.id), {
    status,
    resolved_by: resolved_by ?? 'investigator',
    resolution_notes,
  });

  // If accepted, dismiss the return (overturn the flag)
  if (status === 'accepted') {
    returnsDb.action(appeal.tax_return_id, {
      status: 'dismissed',
      actioned_by: resolved_by ?? 'investigator',
      actioned_at: new Date().toISOString(),
      notes: `Appeal accepted: ${resolution_notes ?? ''}`,
    });
  }

  return res.json(resolved);
});

export default router;
