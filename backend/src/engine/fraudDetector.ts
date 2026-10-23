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
          plain_explanation: `More than half of this filer's income was claimed as deductions. While large deductions can be legitimate (for example, a business with high operating costs), a ratio this high is uncommon and may indicate inflation of deductible expenses.`,
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
          plain_explanation: `This filing reports significant taxable income but shows no tax was paid. Everyone with taxable income above a certain threshold is required to pay some tax. Paying nothing may indicate unreported credits, errors, or deliberate evasion.`,
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
          plain_explanation: `The amount of tax paid is unusually low compared to the income reported. Someone earning more than $50,000 would typically owe more than 5% in taxes. A very low rate can indicate aggressive use of credits or shelters that may not be legal.`,
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
          plain_explanation: `This filing claims charitable donations worth more than 30% of the filer's total income. While generosity is not a crime, donations at this level are statistically rare. Inflated charitable deductions are one of the most common types of tax fraud.`,
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
          plain_explanation: `The business expenses claimed are higher than the total income the business generated. While a startup or business at a loss can legitimately do this, it is a common method for reducing taxable income artificially and warrants verification.`,
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
          plain_explanation: `This filing claims an unusually large number of dependents. Each dependent reduces taxable income, so fabricating dependents is a known fraud tactic. Claiming more than 10 dependents is rare and may indicate identity theft or fictitious family members.`,
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
          plain_explanation: `The numbers on this filing do not add up. Taxable income should equal gross income minus deductions. A large gap between the calculated and reported taxable income suggests a data entry error or deliberate manipulation of figures.`,
          severity: delta > 10000 ? 'critical' : delta > 5000 ? 'high' : 'medium',
        };
      }
      return null;
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
          plain_explanation: `This filer's reported income fell by more than 80% in a single year. While genuine hardship or business closure can cause this, a sudden dramatic income drop is also used to reduce tax liability artificially — especially when paired with large deductions.`,
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
          plain_explanation: `This filer's deductions tripled or more compared to the previous year with no obvious change in circumstances. A sudden spike in deductions — without a corresponding change in income or business activity — is a strong signal of potential fraud.`,
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
    return 'No unusual patterns were detected in this filing. It does not require additional review based on the current rules.';
  }
  const criticalCount = triggered.filter((f) => f!.severity === 'critical').length;
  const highCount     = triggered.filter((f) => f!.severity === 'high').length;
  const parts: string[] = [];

  if (criticalCount > 0) parts.push(`${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}`);
  if (highCount > 0)     parts.push(`${highCount} high-severity issue${highCount > 1 ? 's' : ''}`);
  const remaining = triggered.length - criticalCount - highCount;
  if (remaining > 0)     parts.push(`${remaining} lower-severity concern${remaining > 1 ? 's' : ''}`);

  return `This filing was flagged for human review with a risk score of ${score}/100 (${level} risk). ` +
    `The system detected ${parts.join(', ')}. ` +
    `This does not mean the filer has committed fraud — it means an investigator should examine this filing before any action is taken. ` +
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
