/**
 * Lightweight JSON file-based store.
 * Persists data to data/fraud.json — no native modules required.
 */
import fs from 'fs';
import path from 'path';
import { Taxpayer, TaxReturn, FraudFlag, Appeal, UserAccount, AuthSessionRecord, CustomerInvitation, CustomerDocument } from '../types';
import { DATA_DIRECTORY } from '../config';

const DATA_DIR = DATA_DIRECTORY;
const DB_FILE  = path.join(DATA_DIR, 'fraud.json');

interface DbStore {
  taxpayers:   Taxpayer[];
  tax_returns: TaxReturn[];
  fraud_flags: FraudFlag[];
  appeals:     Appeal[];
  accounts: UserAccount[];
  sessions: AuthSessionRecord[];
  invitations: CustomerInvitation[];
  documents: CustomerDocument[];
  _seq: { taxpayers: number; tax_returns: number; fraud_flags: number; appeals: number; accounts: number; documents: number };
}

// ─── persistence ─────────────────────────────────────────────────────────────

function load(): DbStore {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    return {
      taxpayers:   [],
      tax_returns: [],
      fraud_flags: [],
      appeals:     [],
      accounts: [],
      sessions: [],
      invitations: [],
      documents: [],
      _seq: { taxpayers: 0, tax_returns: 0, fraud_flags: 0, appeals: 0, accounts: 0, documents: 0 },
    };
  }
  const stored = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<DbStore>;
  return {
    taxpayers: stored.taxpayers ?? [],
    tax_returns: stored.tax_returns ?? [],
    fraud_flags: stored.fraud_flags ?? [],
    appeals: stored.appeals ?? [],
    accounts: stored.accounts ?? [],
    sessions: stored.sessions ?? [],
    invitations: stored.invitations ?? [],
    documents: stored.documents ?? [],
    _seq: {
      taxpayers: stored._seq?.taxpayers ?? 0,
      tax_returns: stored._seq?.tax_returns ?? 0,
      fraud_flags: stored._seq?.fraud_flags ?? 0,
      appeals: stored._seq?.appeals ?? 0,
      accounts: stored._seq?.accounts ?? 0,
      documents: stored._seq?.documents ?? 0,
    },
  };
}

function save(store: DbStore): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// ─── store singleton ──────────────────────────────────────────────────────────

let _store: DbStore = load();

function nextId(table: keyof DbStore['_seq']): number {
  _store._seq[table] += 1;
  return _store._seq[table];
}

function persist() {
  save(_store);
}

// ─── Taxpayers ────────────────────────────────────────────────────────────────

export const taxpayersDb = {
  all(): Taxpayer[] {
    return [..._store.taxpayers].sort((a, b) => a.name.localeCompare(b.name));
  },
  get(id: number): Taxpayer | undefined {
    return _store.taxpayers.find((t) => t.id === id);
  },
  getByTin(tin: string): Taxpayer | undefined {
    return _store.taxpayers.find((t) => t.tin === tin);
  },
  insert(data: Omit<Taxpayer, 'id' | 'registered_at'>): Taxpayer {
    const record: Taxpayer = {
      ...data,
      id: nextId('taxpayers'),
      registered_at: new Date().toISOString(),
    };
    _store.taxpayers.push(record);
    persist();
    return record;
  },
  update(id: number, patch: Partial<Omit<Taxpayer, 'id'>>): Taxpayer | undefined {
    const idx = _store.taxpayers.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    _store.taxpayers[idx] = { ..._store.taxpayers[idx], ...patch };
    persist();
    return _store.taxpayers[idx];
  },
  delete(id: number): boolean {
    const len = _store.taxpayers.length;
    _store.taxpayers = _store.taxpayers.filter((t) => t.id !== id);
    if (_store.taxpayers.length < len) { persist(); return true; }
    return false;
  },
};

export const accountsDb = {
  all(): UserAccount[] { return [..._store.accounts]; },
  get(id: number): UserAccount | undefined { return _store.accounts.find((account) => account.id === id); },
  getByEmail(email: string): UserAccount | undefined {
    return _store.accounts.find((account) => account.email === email.toLowerCase());
  },
  insert(data: Omit<UserAccount, 'id' | 'created_at'>): UserAccount {
    const account: UserAccount = { ...data, id: nextId('accounts'), created_at: new Date().toISOString() };
    _store.accounts.push(account);
    persist();
    return account;
  },
  updateCredentials(id: number, password_salt: string, password_hash: string): boolean {
    const account = _store.accounts.find((item) => item.id === id);
    if (!account) return false;
    account.password_salt = password_salt;
    account.password_hash = password_hash;
    persist();
    return true;
  },
};

export const sessionsDb = {
  get(tokenHash: string): AuthSessionRecord | undefined {
    return _store.sessions.find((session) => session.token_hash === tokenHash);
  },
  insert(session: AuthSessionRecord): void {
    _store.sessions = _store.sessions.filter((item) => item.token_hash !== session.token_hash && item.expires_at > new Date().toISOString());
    _store.sessions.push(session);
    persist();
  },
  delete(tokenHash: string): void {
    _store.sessions = _store.sessions.filter((session) => session.token_hash !== tokenHash);
    persist();
  },
  deleteForAccount(accountId: number, exceptTokenHash?: string): void {
    _store.sessions = _store.sessions.filter((session) => session.account_id !== accountId || session.token_hash === exceptTokenHash);
    persist();
  },
};

export const invitationsDb = {
  get(tokenHash: string): CustomerInvitation | undefined {
    return _store.invitations.find((invitation) => invitation.token_hash === tokenHash);
  },
  insert(invitation: CustomerInvitation): void {
    _store.invitations = _store.invitations.filter((item) => item.expires_at > new Date().toISOString());
    _store.invitations.push(invitation);
    persist();
  },
  delete(tokenHash: string): void {
    _store.invitations = _store.invitations.filter((invitation) => invitation.token_hash !== tokenHash);
    persist();
  },
};

export const documentsDb = {
  all(): CustomerDocument[] { return [..._store.documents].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)); },
  byTaxpayer(taxpayerId: number): CustomerDocument[] {
    return this.all().filter((document) => document.taxpayer_id === taxpayerId);
  },
  get(id: number): CustomerDocument | undefined { return _store.documents.find((document) => document.id === id); },
  insert(data: Omit<CustomerDocument, 'id' | 'uploaded_at'>): CustomerDocument {
    const document: CustomerDocument = { ...data, id: nextId('documents'), uploaded_at: new Date().toISOString() };
    _store.documents.push(document);
    persist();
    return document;
  },
  update(id: number, patch: Pick<CustomerDocument, 'status' | 'reviewed_by' | 'reviewed_at' | 'review_notes'>): CustomerDocument | undefined {
    const document = this.get(id);
    if (!document) return undefined;
    Object.assign(document, patch);
    persist();
    return document;
  },
};

// ─── Tax Returns ──────────────────────────────────────────────────────────────

export const returnsDb = {
  all(): TaxReturn[] {
    return [..._store.tax_returns].sort(
      (a, b) => new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime()
    );
  },
  byTaxpayer(taxpayer_id: number): TaxReturn[] {
    return _store.tax_returns
      .filter((r) => r.taxpayer_id === taxpayer_id)
      .sort((a, b) => b.tax_year - a.tax_year);
  },
  get(id: number): TaxReturn | undefined {
    return _store.tax_returns.find((r) => r.id === id);
  },
  insert(data: Omit<TaxReturn, 'id'>): TaxReturn {
    const record: TaxReturn = { ...data, id: nextId('tax_returns') };
    _store.tax_returns.push(record);
    persist();
    return record;
  },
  updateStatus(id: number, status: TaxReturn['status']): boolean {
    const r = _store.tax_returns.find((r) => r.id === id);
    if (!r) return false;
    r.status = status;
    persist();
    return true;
  },
  action(id: number, patch: Partial<Pick<TaxReturn, 'status' | 'actioned_by' | 'actioned_at' | 'notes'>>): TaxReturn | undefined {
    const idx = _store.tax_returns.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    _store.tax_returns[idx] = { ..._store.tax_returns[idx], ...patch };
    persist();
    return _store.tax_returns[idx];
  },
  delete(id: number): boolean {
    const len = _store.tax_returns.length;
    _store.tax_returns = _store.tax_returns.filter((r) => r.id !== id);
    if (_store.tax_returns.length < len) { persist(); return true; }
    return false;
  },
};

// ─── Fraud Flags ──────────────────────────────────────────────────────────────

export const flagsDb = {
  byReturn(tax_return_id: number): FraudFlag[] {
    return _store.fraud_flags.filter((f) => f.tax_return_id === tax_return_id);
  },
  allFlags(): FraudFlag[] {
    return [..._store.fraud_flags];
  },
  insert(data: Omit<FraudFlag, 'id' | 'created_at'>): FraudFlag {
    const record: FraudFlag = {
      ...data,
      id: nextId('fraud_flags'),
      created_at: new Date().toISOString(),
    };
    _store.fraud_flags.push(record);
    persist();
    return record;
  },
  deleteByReturn(tax_return_id: number): void {
    _store.fraud_flags = _store.fraud_flags.filter((f) => f.tax_return_id !== tax_return_id);
    persist();
  },
};

// ─── Appeals ──────────────────────────────────────────────────────────────────

export const appealsDb = {
  all(): Appeal[] {
    return [..._store.appeals].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
  },
  byReturn(tax_return_id: number): Appeal[] {
    return _store.appeals.filter((a) => a.tax_return_id === tax_return_id);
  },
  byTaxpayer(taxpayer_id: number): Appeal[] {
    return _store.appeals.filter((a) => a.taxpayer_id === taxpayer_id);
  },
  get(id: number): Appeal | undefined {
    return _store.appeals.find((a) => a.id === id);
  },
  insert(data: Omit<Appeal, 'id' | 'submitted_at'>): Appeal {
    const record: Appeal = {
      ...data,
      id: nextId('appeals'),
      submitted_at: new Date().toISOString(),
    };
    _store.appeals.push(record);
    persist();
    return record;
  },
  resolve(id: number, patch: Pick<Appeal, 'status' | 'resolved_by' | 'resolution_notes'>): Appeal | undefined {
    const idx = _store.appeals.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    _store.appeals[idx] = {
      ..._store.appeals[idx],
      ...patch,
      resolved_at: new Date().toISOString(),
    };
    persist();
    return _store.appeals[idx];
  },
};
