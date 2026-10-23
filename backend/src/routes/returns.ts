import { Router, Request, Response } from 'express';
import { taxpayersDb, returnsDb, flagsDb } from '../db';
import type { TaxReturn, TaxReturnWithTaxpayer } from '../types';
import { analyzeReturn } from '../engine/fraudDetector';

const router = Router();

// GET /api/returns  — list all, optional ?taxpayer_id=
router.get('/', (req: Request, res: Response) => {
  const { taxpayer_id } = req.query;
  const allReturns = taxpayer_id
    ? returnsDb.byTaxpayer(Number(taxpayer_id))
    : returnsDb.all();

  const result: TaxReturnWithTaxpayer[] = allReturns.map((r) => {
    const tp = taxpayersDb.get(r.taxpayer_id);
    return { ...r, taxpayer_name: tp?.name ?? '', taxpayer_tin: tp?.tin ?? '' };
  });
  return res.json(result);
});

// GET /api/returns/:id
router.get('/:id', (req: Request, res: Response) => {
  const r = returnsDb.get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Tax return not found' });

  const tp = taxpayersDb.get(r.taxpayer_id);
  const flags = flagsDb.byReturn(r.id);
  return res.json({ ...r, taxpayer_name: tp?.name ?? '', taxpayer_tin: tp?.tin ?? '', flags });
});

// POST /api/returns — create and auto-analyze
router.post('/', (req: Request, res: Response) => {
  const {
    taxpayer_id, tax_year, filing_date,
    gross_income, declared_deductions, taxable_income,
    tax_paid, num_dependents, business_expenses, charitable_donations,
    third_party_income_records,
  } = req.body as Partial<TaxReturn>;

  if (!taxpayer_id || !tax_year) {
    return res.status(400).json({ error: 'taxpayer_id and tax_year are required' });
  }
  if (!taxpayersDb.get(taxpayer_id)) {
    return res.status(404).json({ error: 'Taxpayer not found' });
  }
  const incomeRecords = third_party_income_records ?? [];
  const validSources = ['W-2', '1099', 'K-1', 'other'];
  if (!Array.isArray(incomeRecords) || incomeRecords.some((record) =>
    !record || typeof record !== 'object' ||
    !validSources.includes(record.source_type) ||
    typeof record.payer_name !== 'string' || !record.payer_name.trim() ||
    !Number.isFinite(record.reported_income) || record.reported_income < 0
  )) {
    return res.status(400).json({ error: 'Third-party income records need a valid source, payer, and non-negative amount' });
  }

  const newReturn = returnsDb.insert({
    taxpayer_id,
    tax_year,
    filing_date: filing_date ?? new Date().toISOString().slice(0, 10),
    gross_income:         gross_income         ?? 0,
    declared_deductions:  declared_deductions  ?? 0,
    taxable_income:       taxable_income       ?? 0,
    tax_paid:             tax_paid             ?? 0,
    num_dependents:       num_dependents       ?? 0,
    business_expenses:    business_expenses    ?? 0,
    charitable_donations: charitable_donations ?? 0,
    third_party_income_records: incomeRecords,
    status: 'pending',
  });

  const history = returnsDb.byTaxpayer(taxpayer_id).filter((r) => r.id !== newReturn.id);
  const analysis = analyzeReturn(newReturn, history);

  for (const flag of analysis.flags) {
    flagsDb.insert({
      tax_return_id: newReturn.id,
      rule_code: flag.rule_code,
      description: flag.description,
      plain_explanation: flag.plain_explanation,
      severity: flag.severity,
    });
  }
  const newStatus: TaxReturn['status'] = analysis.flags.length > 0 ? 'flagged' : 'cleared';
  returnsDb.updateStatus(newReturn.id, newStatus);

  return res.status(201).json({ ...newReturn, status: newStatus, analysis });
});

// POST /api/returns/:id/analyze — re-analyze an existing return
router.post('/:id/analyze', (req: Request, res: Response) => {
  const taxReturn = returnsDb.get(Number(req.params.id));
  if (!taxReturn) return res.status(404).json({ error: 'Tax return not found' });

  const history = returnsDb.byTaxpayer(taxReturn.taxpayer_id).filter((r) => r.id !== taxReturn.id);
  const analysis = analyzeReturn(taxReturn, history);

  flagsDb.deleteByReturn(taxReturn.id);
  for (const flag of analysis.flags) {
    flagsDb.insert({
      tax_return_id: taxReturn.id,
      rule_code: flag.rule_code,
      description: flag.description,
      plain_explanation: flag.plain_explanation,
      severity: flag.severity,
    });
  }
  const newStatus: TaxReturn['status'] = analysis.flags.length > 0 ? 'flagged' : 'cleared';
  returnsDb.updateStatus(taxReturn.id, newStatus);

  return res.json(analysis);
});

// POST /api/returns/:id/action — human investigator workflow
// Body: { action: 'queue_review' | 'approve_audit' | 'dismiss' | 'close', investigator, notes }
router.post('/:id/action', (req: Request, res: Response) => {
  const taxReturn = returnsDb.get(Number(req.params.id));
  if (!taxReturn) return res.status(404).json({ error: 'Tax return not found' });

  const { action, investigator, notes } = req.body as {
    action: 'queue_review' | 'approve_audit' | 'dismiss' | 'close';
    investigator?: string;
    notes?: string;
  };

  const TRANSITIONS: Record<string, { from: TaxReturn['status'][]; to: TaxReturn['status'] }> = {
    queue_review:  { from: ['flagged'],                           to: 'needs_review'       },
    approve_audit: { from: ['needs_review'],                      to: 'approved_for_audit' },
    dismiss:       { from: ['needs_review', 'flagged'],           to: 'dismissed'          },
    close:         { from: ['approved_for_audit', 'dismissed'],   to: 'closed'             },
  };

  const transition = TRANSITIONS[action];
  if (!transition) return res.status(400).json({ error: `Unknown action: ${action}` });
  if (!transition.from.includes(taxReturn.status)) {
    return res.status(409).json({
      error: `Cannot perform '${action}' on a return with status '${taxReturn.status}'. Expected: ${transition.from.join(' or ')}.`,
    });
  }

  const updated = returnsDb.action(Number(req.params.id), {
    status: transition.to,
    actioned_by: investigator ?? 'system',
    actioned_at: new Date().toISOString(),
    notes: notes ?? taxReturn.notes,
  });

  return res.json(updated);
});

// PATCH /api/returns/:id/status — direct status override (admin use)
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body as { status: TaxReturn['status'] };
  const valid: TaxReturn['status'][] = ['pending', 'flagged', 'cleared', 'needs_review', 'approved_for_audit', 'dismissed', 'closed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }
  const updated = returnsDb.updateStatus(Number(req.params.id), status);
  if (!updated) return res.status(404).json({ error: 'Tax return not found' });
  return res.json({ id: Number(req.params.id), status });
});

export default router;
