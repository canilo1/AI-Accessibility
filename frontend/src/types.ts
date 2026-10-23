export interface Taxpayer {
  id: number;
  tin: string;
  name: string;
  email: string;
  business_type: 'individual' | 'sole_proprietor' | 'corporation' | 'partnership';
  registered_at: string;
}

export interface ThirdPartyIncomeRecord {
  source_type: 'W-2' | '1099' | 'K-1' | 'other';
  payer_name: string;
  reported_income: number;
}

export interface TaxReturn {
  id: number;
  taxpayer_id: number;
  taxpayer_name?: string;
  taxpayer_tin?: string;
  tax_year: number;
  filing_date: string;
  gross_income: number;
  declared_deductions: number;
  taxable_income: number;
  tax_paid: number;
  num_dependents: number;
  business_expenses: number;
  charitable_donations: number;
  third_party_income_records?: ThirdPartyIncomeRecord[];
  status: 'pending' | 'flagged' | 'cleared' | 'needs_review' | 'approved_for_audit' | 'dismissed' | 'closed';
  actioned_by?: string;
  actioned_at?: string;
  notes?: string;
  flags?: FraudFlag[];
  analysis?: FraudAnalysisResult;
}

export interface FraudFlag {
  id: number;
  tax_return_id: number;
  rule_code: string;
  description: string;
  plain_explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

export interface FraudAnalysisResult {
  tax_return_id: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: FraudFlag[];
  summary: string;
}

export interface Appeal {
  id: number;
  tax_return_id: number;
  taxpayer_id: number;
  taxpayer_name?: string;
  tax_year?: number;
  statement: string;
  submitted_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface FairnessMetrics {
  flag_rate_by_type: { business_type: string; total: number; flagged: number; rate: number }[];
  appeal_overturn_rate: number;
  investigator_dismissal_rate: number;
  appeals_summary: { submitted: number; accepted: number; rejected: number; pending: number };
  human_oversight_rate: number;
}

export interface DashboardData {
  stats: {
    total_taxpayers: number;
    total_returns: number;
    flagged_returns: number;
    cleared_returns: number;
    pending_returns: number;
    high_risk_count: number;
    average_risk_score: number;
  };
  recent_flags: {
    id: number;
    tax_year: number;
    status: string;
    taxpayer_name: string;
    tin: string;
    flag_count: number;
    max_severity: string | null;
  }[];
  severity_distribution: { severity: string; count: number }[];
  top_rules: { rule_code: string; description: string; severity: string; occurrences: number }[];
  fairness_metrics: FairnessMetrics;
}
