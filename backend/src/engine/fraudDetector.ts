import { TaxReturn, FraudFlag, FraudAnalysisResult } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Each rule returns a partial flag (without id/tax_return_id/created_at) or null
// ─────────────────────────────────────────────────────────────────────────────

type RuleResult = Omit<FraudFlag, 'id' | 'tax_return_id' | 'created_at'> | null;

interface Rule {
  code: string;
  check: (r: TaxReturn, history: TaxReturn[]) => RuleResult;
}

const RULES: Rule[] = [
  {
    code: 'DEDUCTION_EXCEEDS_INCOME',
    check: (r) => {
      if (r.declared_deductions > r.gross_income) {
        return {
          rule_code: 'DEDUCTION_EXCEEDS_INCOME',
          description: `Declared deductions ($${r.declared_deductions.toLocaleString()}) exceed gross income ($${r.gross_income.toLocaleString()}).`,
          plain_explanation: `This filing claims more money in deductions than the total income earned. For example, if someone earned $40,000 but claimed $45,000 in deductions, that is mathematically inconsistent and warrants a closer look.`,
          severity: 'critical',
        };
      }
      return null;
    },
  },
  {
    code: 'HIGH_DEDUCTION_RATIO',
    check: (r) => {
      if (r.gross_income <= 0) return null;
      const ratio = r.declared_deductions / r.gross_income;
      if (ratio > 0.5 && r.declared_deductions <= r.gross_income) {
        return {
          rule_code: 'HIGH_DEDUCTION_RATIO',
          description: `Deductions are ${(ratio * 100).toFixed(1)}% of gross income — above the 50% threshold.`,
          plain_explanation: `More than half of the reported income was claimed as deductions. Large deductions can be legitimate, so a reviewer should compare the amount with supporting schedules and the filer's circumstances before drawing conclusions.`,
          severity: ratio > 0.8 ? 'high' : 'medium',
        };
      }
      return null;
    },
  },
  {
    code: 'ZERO_TAX_ON_INCOME',
    check: (r) => {
      if (r.taxable_income > 10000 && r.tax_paid < 1) {
        return {
          rule_code: 'ZERO_TAX_ON_INCOME',
          description: `Taxable income of $${r.taxable_income.toLocaleString()} reported but zero tax paid.`,
          plain_explanation: `This filing reports taxable income above the rule threshold but no tax paid. Credits, filing details, or data issues may explain the difference; a reviewer should verify the calculation and supporting information.`,
          severity: 'critical',
        };
      }
      return null;
    },
  },
  {
    code: 'LOW_EFFECTIVE_TAX_RATE',
    check: (r) => {
      if (r.taxable_income <= 0) return null;
      const effectiveRate = r.tax_paid / r.taxable_income;
      if (r.taxable_income > 50000 && effectiveRate < 0.05) {
        return {
          rule_code: 'LOW_EFFECTIVE_TAX_RATE',
          description: `Effective tax rate is ${(effectiveRate * 100).toFixed(2)}% on taxable income of $${r.taxable_income.toLocaleString()}.`,
          plain_explanation: `The reported effective rate is below this rule's 5% threshold. Credits, deductions, and filing circumstances can affect the rate, so review the return and applicable schedules before reaching a conclusion.`,
          severity: 'high',
        };
      }
      return null;
    },
  },
  {
    code: 'EXCESSIVE_CHARITABLE_DONATIONS',
    check: (r) => {
      if (r.gross_income <= 0) return null;
      const ratio = r.charitable_donations / r.gross_income;
      if (ratio > 0.3) {
        return {
          rule_code: 'EXCESSIVE_CHARITABLE_DONATIONS',
          description: `Charitable donations ($${r.charitable_donations.toLocaleString()}) are ${(ratio * 100).toFixed(1)}% of gross income.`,
          plain_explanation: `The claimed donations exceed 30% of reported income. This may be accurate, but the amount should be compared with the relevant documentation and filing rules.`,
          severity: ratio > 0.5 ? 'high' : 'medium',
        };
      }
      return null;
    },
  },
  {
    code: 'BUSINESS_EXPENSES_EXCEED_INCOME',
    check: (r) => {
      if (r.business_expenses > r.gross_income && r.gross_income > 0) {
        return {
          rule_code: 'BUSINESS_EXPENSES_EXCEED_INCOME',
          description: `Business expenses ($${r.business_expenses.toLocaleString()}) exceed gross income ($${r.gross_income.toLocaleString()}).`,
          plain_explanation: `The claimed business expenses exceed reported gross income. This can occur during a legitimate loss period; review the business activity and supporting records for context.`,
          severity: 'high',
        };
      }
      return null;
    },
  },
  {
    code: 'EXCESSIVE_DEPENDENTS',
    check: (r) => {
      if (r.num_dependents > 10) {
        return {
          rule_code: 'EXCESSIVE_DEPENDENTS',
          description: `${r.num_dependents} dependents claimed — unusually high.`,
          plain_explanation: `The return lists more than 10 dependents, which is unusual under this rule. Family circumstances vary; verify eligibility and supporting information rather than assuming the entries are incorrect.`,
          severity: r.num_dependents > 15 ? 'high' : 'medium',
        };
      }
      return null;
    },
  },
  {
    code: 'INCOME_CALCULATION_MISMATCH',
    check: (r) => {
      const expected = r.gross_income - r.declared_deductions;
      const delta = Math.abs(r.taxable_income - expected);
      if (delta > 500 && r.gross_income > 0) {
        return {
          rule_code: 'INCOME_CALCULATION_MISMATCH',
          description: `Taxable income ($${r.taxable_income.toLocaleString()}) does not match gross income minus deductions ($${expected.toLocaleString()}) — discrepancy of $${delta.toLocaleString()}.`,
          plain_explanation: `Taxable income differs from gross income minus declared deductions by more than the rule tolerance. Adjustments or schedules may explain the difference; compare the figures with the full return before drawing conclusions.`,
          severity: delta > 10000 ? 'critical' : delta > 5000 ? 'high' : 'medium',
        };
      }
      return null;
    },
  },
  {
    code: 'THIRD_PARTY_INCOME_MISMATCH',
    check: (r) => {
      const records = r.third_party_income_records ?? [];
      if (records.length === 0) return null;

      const reportedIncome = records.reduce((total, record) => total + record.reported_income, 0);
      const difference = Math.abs(r.gross_income - reportedIncome);
      const threshold = Math.max(1000, reportedIncome * 0.05);
      if (difference <= threshold) return null;

      return {
        rule_code: 'THIRD_PARTY_INCOME_MISMATCH',
        description: `Reported gross income ($${r.gross_income.toLocaleString()}) differs from attached third-party records ($${reportedIncome.toLocaleString()}) by $${difference.toLocaleString()}.`,
        plain_explanation: `The income on this return does not closely match the W-2, 1099, K-1, or other records attached for comparison. Records may be incomplete or require correction, so this discrepancy is a lead for human review, not a finding of fraud.`,
        severity: difference > Math.max(10000, reportedIncome * 0.1) ? 'high' : 'medium',
      };
    },
  },
  {
    code: 'DUPLICATE_TAX_YEAR_RETURN',
    check: (r, history) => {
      if (!history.some((previous) => previous.tax_year === r.tax_year)) return null;
      return {
        rule_code: 'DUPLICATE_TAX_YEAR_RETURN',
        description: `More than one return is recorded for tax year ${r.tax_year}.`,
        plain_explanation: `A second filing for the same taxpayer and year may be an amended return or a duplicate submission. Confirm the filing type and history before taking any action.`,
        severity: 'medium',
      };
    },
  },
  {
    code: 'SUDDEN_INCOME_DROP',
    check: (r, history) => {
      const prev = history.find((h) => h.tax_year === r.tax_year - 1);
      if (!prev || prev.gross_income <= 0) return null;
      const drop = (prev.gross_income - r.gross_income) / prev.gross_income;
      if (drop > 0.8) {
        return {
          rule_code: 'SUDDEN_INCOME_DROP',
          description: `Gross income dropped ${(drop * 100).toFixed(1)}% from ${r.tax_year - 1} ($${prev.gross_income.toLocaleString()}) to ${r.tax_year} ($${r.gross_income.toLocaleString()}).`,
          plain_explanation: `Reported income fell by more than 80% in one year. A business closure, job change, or other circumstance may explain this; compare the figures with prior filings and supporting records.`,
          severity: 'medium',
        };
      }
      return null;
    },
  },
  {
    code: 'SUDDEN_DEDUCTION_SPIKE',
    check: (r, history) => {
      const prev = history.find((h) => h.tax_year === r.tax_year - 1);
      if (!prev || prev.declared_deductions <= 0) return null;
      const increase = (r.declared_deductions - prev.declared_deductions) / prev.declared_deductions;
      if (increase > 2.0) {
        return {
          rule_code: 'SUDDEN_DEDUCTION_SPIKE',
          description: `Deductions increased by ${(increase * 100).toFixed(0)}% from ${r.tax_year - 1} to ${r.tax_year}.`,
          plain_explanation: `Deductions increased sharply compared with the previous year. A change in business or personal circumstances may explain it; check the supporting records and ask for context if needed.`,
          severity: increase > 5 ? 'high' : 'medium',
        };
      }
      return null;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Risk score & level
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<FraudFlag['severity'], number> = {
  low: 5, medium: 15, high: 30, critical: 50,
};

function calculateRiskScore(flags: RuleResult[]): number {
  const total = flags.reduce((acc, f) => f ? acc + SEVERITY_WEIGHTS[f.severity] : acc, 0);
  return Math.min(100, total);
}

function riskLevel(score: number): FraudAnalysisResult['risk_level'] {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain-language summary
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(flags: RuleResult[], score: number, level: string): string {
  const triggered = flags.filter(Boolean);
  if (triggered.length === 0) {
    return 'No configured review signals were triggered. This limited ruleset cannot establish that a return is accurate or compliant.';
  }
  const criticalCount = triggered.filter((f) => f!.severity === 'critical').length;
  const highCount     = triggered.filter((f) => f!.severity === 'high').length;
  const parts: string[] = [];

  if (criticalCount > 0) parts.push(`${criticalCount} critical-severity signal${criticalCount > 1 ? 's' : ''}`);
  if (highCount > 0)     parts.push(`${highCount} high-severity signal${highCount > 1 ? 's' : ''}`);
  const remaining = triggered.length - criticalCount - highCount;
  if (remaining > 0)     parts.push(`${remaining} lower-severity signal${remaining > 1 ? 's' : ''}`);

  return `This filing was flagged for human review with a rule score of ${score}/100 (${level} signal level). ` +
    `The system detected ${parts.join(', ')}. ` +
    `This is not a finding of fraud or wrongdoing. A reviewer should examine the filing and supporting evidence before any action is taken. ` +
    `The filer has the right to submit an explanation or appeal.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeReturn(
  taxReturn: TaxReturn,
  history: TaxReturn[] = []
): FraudAnalysisResult {
  const ruleResults = RULES.map((rule) => rule.check(taxReturn, history));
  const triggered = ruleResults.filter((r): r is NonNullable<typeof r> => r !== null);

  const flags: FraudFlag[] = triggered.map((f, i) => ({
    id: i + 1,
    tax_return_id: taxReturn.id,
    created_at: new Date().toISOString(),
    ...f,
  }));

  const risk_score = calculateRiskScore(ruleResults);
  const level = riskLevel(risk_score);

  return {
    tax_return_id: taxReturn.id,
    risk_score,
    risk_level: level,
    flags,
    summary: buildSummary(ruleResults, risk_score, level),
  };
}

export { RULES };
