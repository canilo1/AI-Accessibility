import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { accountsDb, invitationsDb, taxpayersDb, sessionsDb } from '../db';
import { accountFrom, hashSessionToken, requireAuth, sessionTokenFrom, SESSION_COOKIE } from '../middleware/auth';
import type { AccountRole, UserAccount } from '../types';

const router = Router();
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

function publicAccount(account: UserAccount) {
  return {
    id: account.id,
    email: account.email,
    display_name: account.display_name,
    role: account.role,
    taxpayer_id: account.taxpayer_id,
  };
}

function passwordHash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function startSession(account: UserAccount, res: Response): void {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  sessionsDb.insert({
    token_hash: hashSessionToken(token),
    account_id: account.id,
    expires_at: expiresAt.toISOString(),
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS,
  });
}

router.post('/register', (_req: Request, res: Response) => {
  return res.status(403).json({ error: 'Customer accounts must be provisioned by an administrator' });
});

router.get('/invitation/:token', (req: Request, res: Response) => {
  const invitation = invitationsDb.get(hashSessionToken(req.params.token));
  if (!invitation || invitation.expires_at <= new Date().toISOString()) {
    if (invitation) invitationsDb.delete(invitation.token_hash);
    return res.status(404).json({ error: 'This customer invitation is invalid or has expired' });
  }
  const taxpayer = taxpayersDb.get(invitation.taxpayer_id);
  if (!taxpayer) return res.status(404).json({ error: 'The invited taxpayer profile is unavailable' });
  return res.json({ email: taxpayer.email, display_name: taxpayer.name, expires_at: invitation.expires_at });
});

router.post('/accept-invitation', (req: Request, res: Response) => {
  const { token, password } = req.body as Record<string, unknown>;
  if (typeof token !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invitation and password are required' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 12 and 128 characters long' });
  }
  const invitation = invitationsDb.get(hashSessionToken(token));
  if (!invitation || invitation.expires_at <= new Date().toISOString()) {
    if (invitation) invitationsDb.delete(invitation.token_hash);
    return res.status(404).json({ error: 'This customer invitation is invalid or has expired' });
  }
  const taxpayer = taxpayersDb.get(invitation.taxpayer_id);
  if (!taxpayer) return res.status(404).json({ error: 'The invited taxpayer profile is unavailable' });
  const email = taxpayer.email.trim().toLowerCase();
  if (accountsDb.getByEmail(email)) {
    invitationsDb.delete(invitation.token_hash);
    return res.status(409).json({ error: 'A portal account already exists for this email' });
  }

  const salt = randomBytes(16).toString('hex');
  const account = accountsDb.insert({
    email,
    display_name: taxpayer.name,
    role: 'customer',
    taxpayer_id: taxpayer.id,
    password_salt: salt,
    password_hash: passwordHash(password, salt),
  });
  invitationsDb.delete(invitation.token_hash);
  startSession(account, res);
  return res.status(201).json(publicAccount(account));
});

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length > 128) return res.status(401).json({ error: 'Email or password is incorrect' });
  const account = accountsDb.getByEmail(email.trim().toLowerCase());
  const candidate = account ? passwordHash(password, account.password_salt) : scryptSync(password, 'invalid-account-salt', 64).toString('hex');
  if (!account || !timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(account.password_hash, 'hex'))) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }

  startSession(account, res);
  return res.json(publicAccount(account));
});

router.get('/me', requireAuth, (req: Request, res: Response) => res.json(publicAccount(accountFrom(req))));

router.post('/change-password', requireAuth, (req: Request, res: Response) => {
  const { current_password, new_password } = req.body as Record<string, unknown>;
  if (typeof current_password !== 'string' || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  if (new_password.length < 12 || new_password.length > 128) {
    return res.status(400).json({ error: 'New password must be between 12 and 128 characters long' });
  }
  const account = accountFrom(req);
  const currentHash = passwordHash(current_password, account.password_salt);
  if (!timingSafeEqual(Buffer.from(currentHash, 'hex'), Buffer.from(account.password_hash, 'hex'))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const salt = randomBytes(16).toString('hex');
  accountsDb.updateCredentials(account.id, salt, passwordHash(new_password, salt));
  const currentToken = sessionTokenFrom(req);
  sessionsDb.deleteForAccount(account.id, currentToken ? hashSessionToken(currentToken) : undefined);
  return res.json({ message: 'Password updated. Other active sessions have been signed out.' });
});

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const token = sessionTokenFrom(req);
  if (token) sessionsDb.delete(hashSessionToken(token));
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  return res.status(204).send();
});

export function bootstrapAdminAccount(): void {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('Admin login disabled: set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap an administrator.');
    return;
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters long');
  }
  if (accountsDb.getByEmail(email)) return;

  const salt = randomBytes(16).toString('hex');
  accountsDb.insert({
    email,
    display_name: process.env.ADMIN_NAME?.trim() || 'Administrator',
    role: 'admin' satisfies AccountRole,
    password_salt: salt,
    password_hash: passwordHash(password, salt),
  });
  console.log(`Administrator account initialized for ${email}`);
}

export default router;