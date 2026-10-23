import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { accountsDb, sessionsDb } from '../db';
import type { AccountRole, UserAccount } from '../types';

export const SESSION_COOKIE = 'fraudguard_session';

export interface AuthenticatedRequest extends Request {
  account?: UserAccount;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getCookie(req: Request, name: string): string | undefined {
  const pair = req.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}

export function sessionTokenFrom(req: Request): string | undefined {
  return getCookie(req, SESSION_COOKIE);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = sessionTokenFrom(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const tokenHash = hashSessionToken(token);
  const session = sessionsDb.get(tokenHash);
  if (!session || session.expires_at <= new Date().toISOString()) {
    if (session) sessionsDb.delete(tokenHash);
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const account = accountsDb.get(session.account_id);
  if (!account) {
    sessionsDb.delete(tokenHash);
    res.status(401).json({ error: 'Account no longer exists' });
    return;
  }

  (req as AuthenticatedRequest).account = account;
  next();
}

export function requireRole(...roles: AccountRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const account = (req as AuthenticatedRequest).account;
    if (!account) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(account.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource' });
      return;
    }
    next();
  };
}

export function accountFrom(req: Request): UserAccount {
  return (req as AuthenticatedRequest).account!;
}