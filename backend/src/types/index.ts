export interface Taxpayer {
  id: number;
  tin: string; // Tax Identification Number
  name: string;
  email: string;
  business_type: 'individual' | 'sole_proprietor' | 'corporation' | 'partnership';
  registered_at: string;
}

export interface TaxReturn {
  id: number;
  taxpayer_id: number;
  tax_year: number;
  filing_date: string;
  gross_income: number;
  declared_deductions: number;
  taxable_income: number;
  tax_paid: number;
  num_dependents: number;
  business_expenses: number;
  charitable_donations: number;
  /**
   * Status lifecycle:
   *   pending → flagged (auto, by engine)
   *           → cleared (auto, no flags)
   *   flagged → needs_review (investigator queues it)
   *   needs_review → approved_for_audit (human sign-off)
   *              → dismissed (human clears it)
   *   approved_for_audit → closed
   *   dismissed → closed
   */
  status: 'pending' | 'flagged' | 'cleared' | 'needs_review' | 'approved_for_audit' | 'dismissed' | 'closed' | 'referred_to_irs';
  /** Investigator who last actioned this return */
  actioned_by?: string;
  /** Timestamp of last human action */
  actioned_at?: string;
  /** Investigator notes */
  notes?: string;
}

export interface FraudFlag {
  id: number;
  tax_return_id: number;
  rule_code: string;
  description: string;
  /** Plain-language explanation for non-technical audiences */
  plain_explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export interface FraudAnalysisResult {
  tax_return_id: number;
  risk_score: number; // 0–100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: FraudFlag[];
  /** Human-readable summary of why this was flagged */
  summary: string;
}

export interface Appeal {
  id: number;
  tax_return_id: number;
  taxpayer_id: number;
  statement: string;          // taxpayer's written explanation
  submitted_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolved_at?: string;
  resolved_by?: string;       // investigator name
  resolution_notes?: string;
}

export interface DashboardStats {
  total_taxpayers: number;
  total_returns: number;
  flagged_returns: number;
  cleared_returns: number;
  pending_returns: number;
  high_risk_count: number;
  average_risk_score: number;
}

export interface FairnessMetrics {
  /** Flag rate per business type — checks for disproportionate targeting */
  flag_rate_by_type: { business_type: string; total: number; flagged: number; rate: number }[];
  /** How often appeals overturn a flag — proxy for false-positive rate */
  appeal_overturn_rate: number;
  /** % of flagged returns that were later dismissed by investigators */
  investigator_dismissal_rate: number;
  /** Total appeals submitted vs resolved */
  appeals_summary: { submitted: number; accepted: number; rejected: number; pending: number };
  /** Returns that required human sign-off before action */
  human_oversight_rate: number;
}

export interface TaxReturnWithTaxpayer extends TaxReturn {
  taxpayer_name: string;
  taxpayer_tin: string;
  risk_score?: number;
  flags?: FraudFlag[];
}
