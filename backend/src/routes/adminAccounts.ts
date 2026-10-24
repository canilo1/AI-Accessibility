import { randomBytes, scryptSync } from 'crypto';
import { Router, Request, Response } from 'express';
import { accountsDb, invitationsDb, taxpayersDb } from '../db';
import { hashSessionToken, requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', (_req: Request, res: Response) => {
  const customers = accountsDb.all()
    .filter((account) => account.role === 'customer')
    .map(({ id, email, display_name, taxpayer_id, created_at }) => ({ id, email, display_name, taxpayer_id, created_at }));
  return res.json(customers);
});

router.get('/admins', (_req: Request, res: Response) => {
  const admins = accountsDb.all()
    .filter((account) => account.role === 'admin')
    .map(({ id, email, display_name, created_at }) => ({ id, email, display_name, created_at }));
  return res.json(admins);
});

router.post('/admins', (req: Request, res: Response) => {
  const { name, email, password } = req.body as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 12 and 128 characters long' });
  }
  if (accountsDb.getByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const salt = randomBytes(16).toString('hex');
  const account = accountsDb.insert({
    email: normalizedEmail,
    display_name: name.trim(),
    role: 'admin',
    password_salt: salt,
    password_hash: scryptSync(password, salt, 64).toString('hex'),
  });
  const { password_salt: _salt, password_hash: _hash, ...safeAccount } = account;
  return res.status(201).json(safeAccount);
});

router.post('/invitations', (req: Request, res: Response) => {
  const taxpayerId = Number(req.body.taxpayer_id);
  const taxpayer = taxpayersDb.get(taxpayerId);
  if (!taxpayer) return res.status(404).json({ error: 'Taxpayer not found' });
  if (accountsDb.all().some((account) => account.taxpayer_id === taxpayerId)) {
    return res.status(409).json({ error: 'This taxpayer already has a portal account' });
  }
  const email = taxpayer.email.trim().toLowerCase();
  if (accountsDb.getByEmail(email)) {
    return res.status(409).json({ error: 'This email is already used by another portal account' });
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  invitationsDb.insert({
    token_hash: hashSessionToken(token),
    taxpayer_id: taxpayerId,
    expires_at: expiresAt.toISOString(),
  });
  const frontendOrigin = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
  return res.status(201).json({
    email,
    invite_url: `${frontendOrigin}/?invite=${encodeURIComponent(token)}`,
    expires_at: expiresAt.toISOString(),
  });
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