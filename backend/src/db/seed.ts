/**
 * Seed script: generates synthetic taxpayer + tax return examples,
 * including deliberately injected review patterns.
 *
 * Run: npm run seed
 */
import { taxpayersDb, returnsDb, flagsDb } from '../db';
import { analyzeReturn } from '../engine/fraudDetector';
import { Taxpayer, TaxReturn } from '../types';

const TAXPAYERS: Omit<Taxpayer, 'id' | 'registered_at'>[] = [
  { tin: 'TIN-001-SMITH',  name: 'Demo Person One',          email: 'person-one@example.test',       business_type: 'individual'      },
  { tin: 'TIN-002-JONES',  name: 'Demo Sole Proprietor',     email: 'sole-proprietor@example.test',  business_type: 'sole_proprietor' },
  { tin: 'TIN-003-ACME',   name: 'Demo Corporation',         email: 'corporation@example.test',      business_type: 'corporation'     },
  { tin: 'TIN-004-BROWN',  name: 'Demo Person Two',          email: 'person-two@example.test',       business_type: 'individual'      },
  { tin: 'TIN-005-GREEN',  name: 'Demo Partnership One',     email: 'partnership-one@example.test',  business_type: 'partnership'     },
  { tin: 'TIN-006-WHITE',  name: 'Demo Person Three',        email: 'person-three@example.test',     business_type: 'individual'      },
  { tin: 'TIN-007-DAVIS',  name: 'Demo Partnership Two',     email: 'partnership-two@example.test',  business_type: 'partnership'     },
  { tin: 'TIN-008-MILLER', name: 'Demo Sole Proprietor Two', email: 'sole-proprietor-two@example.test', business_type: 'individual' },
];

type ReturnRow = {
  tin: string; year: number; gross: number; deductions: number; taxable: number;
  tax_paid: number; dependents: number; expenses: number; donations: number;
};

const RETURNS: ReturnRow[] = [
  // Demo Person One — no configured review signals
  { tin: 'TIN-001-SMITH', year: 2022, gross: 80000,  deductions: 12000, taxable: 68000,  tax_paid: 15000, dependents: 2, expenses: 0,     donations: 500  },
  { tin: 'TIN-001-SMITH', year: 2023, gross: 85000,  deductions: 13000, taxable: 72000,  tax_paid: 16000, dependents: 2, expenses: 0,     donations: 600  },
  // Demo Sole Proprietor — high deduction ratio pattern
  { tin: 'TIN-002-JONES', year: 2022, gross: 60000,  deductions: 35000, taxable: 25000,  tax_paid: 3000,  dependents: 1, expenses: 20000, donations: 5000 },
  { tin: 'TIN-002-JONES', year: 2023, gross: 65000,  deductions: 55000, taxable: 10000,  tax_paid: 500,   dependents: 1, expenses: 40000, donations: 8000 },
  // Demo Corporation — zero tax on reported taxable income
  { tin: 'TIN-003-ACME',  year: 2022, gross: 500000, deductions: 50000, taxable: 450000, tax_paid: 0,     dependents: 0, expenses: 80000, donations: 10000},
  { tin: 'TIN-003-ACME',  year: 2023, gross: 520000, deductions: 48000, taxable: 472000, tax_paid: 100,   dependents: 0, expenses: 85000, donations: 12000},
  // Demo Person Two — deductions exceed reported income
  { tin: 'TIN-004-BROWN', year: 2022, gross: 40000,  deductions: 45000, taxable: 0,      tax_paid: 0,     dependents: 3, expenses: 0,     donations: 1000 },
  // Demo Partnership One — sudden income drop pattern
  { tin: 'TIN-005-GREEN', year: 2021, gross: 200000, deductions: 30000, taxable: 170000, tax_paid: 35000, dependents: 0, expenses: 50000, donations: 2000 },
  { tin: 'TIN-005-GREEN', year: 2022, gross: 200000, deductions: 30000, taxable: 170000, tax_paid: 35000, dependents: 0, expenses: 50000, donations: 2000 },
  { tin: 'TIN-005-GREEN', year: 2023, gross: 20000,  deductions: 5000,  taxable: 15000,  tax_paid: 2000,  dependents: 0, expenses: 3000,  donations: 500  },
  // Demo Person Three — high dependent count
  { tin: 'TIN-006-WHITE', year: 2023, gross: 55000,  deductions: 10000, taxable: 45000,  tax_paid: 9000,  dependents: 18,expenses: 0,     donations: 200  },
  // Demo Partnership Two — income calculation mismatch
  { tin: 'TIN-007-DAVIS', year: 2023, gross: 300000, deductions: 50000, taxable: 400000, tax_paid: 80000, dependents: 0, expenses: 60000, donations: 5000 },
  // Demo Sole Proprietor Two — sudden deduction spike pattern
  { tin: 'TIN-008-MILLER',year: 2022, gross: 90000,  deductions: 10000, taxable: 80000,  tax_paid: 17000, dependents: 1, expenses: 5000,  donations: 1000 },
  { tin: 'TIN-008-MILLER',year: 2023, gross: 92000,  deductions: 45000, taxable: 47000,  tax_paid: 8000,  dependents: 1, expenses: 30000, donations: 5000 },
];

function seed() {
  // Insert taxpayers (skip if already present)
  const tinToId: Record<string, number> = {};
  for (const t of TAXPAYERS) {
    const existing = taxpayersDb.getByTin(t.tin);
    if (existing) {
      tinToId[t.tin] = existing.id;
    } else {
      const created = taxpayersDb.insert(t);
      tinToId[t.tin] = created.id;
    }
  }
  console.log(`✔ ${TAXPAYERS.length} taxpayers ready`);

  let count = 0;
  for (const row of RETURNS) {
    const taxpayer_id = tinToId[row.tin];
    // Skip duplicates (same taxpayer + year)
    const existing = returnsDb.byTaxpayer(taxpayer_id).find((r: TaxReturn) => r.tax_year === row.year);
    if (existing) continue;

    const newReturn = returnsDb.insert({
      taxpayer_id,
      tax_year:             row.year,
      filing_date:          `${row.year}-04-15`,
      gross_income:         row.gross,
      declared_deductions:  row.deductions,
      taxable_income:       row.taxable,
      tax_paid:             row.tax_paid,
      num_dependents:       row.dependents,
      business_expenses:    row.expenses,
      charitable_donations: row.donations,
      status:               'pending',
    });

    const history = returnsDb.byTaxpayer(taxpayer_id).filter((r: TaxReturn) => r.id !== newReturn.id);
    const analysis = analyzeReturn(newReturn, history);

    flagsDb.deleteByReturn(newReturn.id);
    for (const flag of analysis.flags) {
      flagsDb.insert({ tax_return_id: newReturn.id, rule_code: flag.rule_code, description: flag.description, plain_explanation: flag.plain_explanation, severity: flag.severity });
    }
    returnsDb.updateStatus(newReturn.id, analysis.flags.length > 0 ? 'flagged' : 'cleared');
    count++;
  }
  console.log(`✔ ${count} tax returns inserted & analyzed`);
  console.log('✔ Seeding complete.');
}

seed();
