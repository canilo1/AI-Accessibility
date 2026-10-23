import { randomBytes, scryptSync } from 'crypto';
import { Router, Request, Response } from 'express';
import { accountsDb, taxpayersDb } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', (_req: Request, res: Response) => {
  const customers = accountsDb.all()
    .filter((account) => account.role === 'customer')
    .map(({ id, email, display_name, taxpayer_id, created_at }) => ({ id, email, display_name, taxpayer_id, created_at }));
  return res.json(customers);
});

router.post('/', (req: Request, res: Response) => {
  const taxpayerId = Number(req.body.taxpayer_id);
  const password = req.body.password;
  const taxpayer = taxpayersDb.get(taxpayerId);
  if (!taxpayer) return res.status(404).json({ error: 'Taxpayer not found' });
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Initial password must be between 12 and 128 characters long' });
  }
  if (accountsDb.all().some((account) => account.taxpayer_id === taxpayerId)) {
    return res.status(409).json({ error: 'This taxpayer already has a portal account' });
  }

  const email = taxpayer.email.trim().toLowerCase();
  if (accountsDb.getByEmail(email)) {
    return res.status(409).json({ error: 'This email is already used by another portal account' });
  }
  const password_salt = randomBytes(16).toString('hex');
  const password_hash = scryptSync(password, password_salt, 64).toString('hex');
  const account = accountsDb.insert({
    email,
    display_name: taxpayer.name,
    role: 'customer',
    taxpayer_id: taxpayerId,
    password_salt,
    password_hash,
  });
  const { password_salt: _salt, password_hash: _hash, ...safeAccount } = account;
  return res.status(201).json(safeAccount);
});

export default router;