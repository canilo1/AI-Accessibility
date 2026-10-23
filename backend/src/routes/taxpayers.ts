import { Router, Request, Response } from 'express';
import { taxpayersDb } from '../db';
import { Taxpayer } from '../types';

const router = Router();

// GET /api/taxpayers
router.get('/', (_req: Request, res: Response) => {
  res.json(taxpayersDb.all());
});

// GET /api/taxpayers/:id
router.get('/:id', (req: Request, res: Response) => {
  const taxpayer = taxpayersDb.get(Number(req.params.id));
  if (!taxpayer) return res.status(404).json({ error: 'Taxpayer not found' });
  return res.json(taxpayer);
});

// POST /api/taxpayers
router.post('/', (req: Request, res: Response) => {
  const { tin, name, email, business_type } = req.body as Partial<Taxpayer>;
  if (!tin || !name || !email) {
    return res.status(400).json({ error: 'tin, name, and email are required' });
  }
  if (taxpayersDb.getByTin(tin)) {
    return res.status(409).json({ error: 'A taxpayer with this TIN already exists' });
  }
  const created = taxpayersDb.insert({ tin, name, email, business_type: business_type ?? 'individual' });
  return res.status(201).json(created);
});

// PUT /api/taxpayers/:id
router.put('/:id', (req: Request, res: Response) => {
  const existing = taxpayersDb.get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Taxpayer not found' });

  const patch = req.body as Partial<Omit<Taxpayer, 'id'>>;
  const updated = taxpayersDb.update(Number(req.params.id), patch);
  return res.json(updated);
});

// DELETE /api/taxpayers/:id
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = taxpayersDb.delete(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Taxpayer not found' });
  return res.status(204).send();
});

export default router;
