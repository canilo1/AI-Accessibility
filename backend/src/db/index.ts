/**
 * Lightweight JSON file-based store.
 * Persists data to data/fraud.json — no native modules required.
 */
import fs from 'fs';
import path from 'path';
import { Taxpayer, TaxReturn, FraudFlag, Appeal } from '../types';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE  = path.join(DATA_DIR, 'fraud.json');

interface DbStore {
  taxpayers:   Taxpayer[];
  tax_returns: TaxReturn[];
  fraud_flags: FraudFlag[];
  appeals:     Appeal[];
  _seq: { taxpayers: number; tax_returns: number; fraud_flags: number; appeals: number };
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
      _seq: { taxpayers: 0, tax_returns: 0, fraud_flags: 0, appeals: 0 },
    };
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DbStore;
  // Migrate: add appeals if missing (existing data)
  if (!data.appeals) data.appeals = [];
  if (!data._seq.appeals) data._seq.appeals = 0;
  return data;
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
