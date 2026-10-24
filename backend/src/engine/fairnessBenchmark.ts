import type { TaxReturn, Taxpayer } from '../types';
import { analyzeReturn } from './fraudDetector';

type BusinessType = Taxpayer['business_type'];

export interface BusinessTypeBenchmark {
  business_type: BusinessType;
  clean_cases: number;
  clean_cases_flagged: number;
  synthetic_false_positive_rate: number;
  injected_pattern_cases: number;
  injected_pattern_cases_detected: number;
  synthetic_detection_rate: number;
}

export interface SyntheticBenchmark {
  label: string;
  interpretation: string;
  total_cases: number;
  business_types: BusinessTypeBenchmark[];
}

const BUSINESS_TYPES: BusinessType[] = ['individual', 'sole_proprietor', 'corporation', 'partnership'];

function cleanCase(businessType: BusinessType, id: number, variation: number): TaxReturn {
  const gross = 60000 + variation * 5000;
  const deductions = 8000 + variation * 500;
  const taxable = gross - deductions;
  return {
    id,
    taxpayer_id: id,
    tax_year: 2025,
    filing_date: '2026-04-15',
    gross_income: gross,
    declared_deductions: deductions,
    taxable_income: taxable,
    tax_paid: taxable * 0.18,
    num_dependents: variation % 3,
    business_expenses: businessType === 'individual' ? 0 : gross * 0.08,
    charitable_donations: gross * 0.02,
    status: 'pending',
  };
}

function injectedDeductionPattern(businessType: BusinessType, id: number): TaxReturn {
  return {
    ...cleanCase(businessType, id, 0),
    declared_deductions: 70000,
    taxable_income: 0,
    tax_paid: 0,
  };
}

function injectedCalculationPattern(businessType: BusinessType, id: number): TaxReturn {
  return {
    ...cleanCase(businessType, id, 1),
    taxable_income: 1000,
  };
}

export function evaluateSyntheticBenchmark(): SyntheticBenchmark {
  const business_types = BUSINESS_TYPES.map((businessType, typeIndex): BusinessTypeBenchmark => {
    const cleanCases = Array.from({ length: 5 }, (_, index) => cleanCase(businessType, typeIndex * 100 + index + 1, index));
    const injectedCases = [
      injectedDeductionPattern(businessType, typeIndex * 100 + 50),
      injectedCalculationPattern(businessType, typeIndex * 100 + 51),
    ];
    const cleanCasesFlagged = cleanCases.filter((taxReturn) => analyzeReturn(taxReturn).flags.length > 0).length;
    const injectedCasesDetected = injectedCases.filter((taxReturn) => analyzeReturn(taxReturn).flags.length > 0).length;

    return {
      business_type: businessType,
      clean_cases: cleanCases.length,
      clean_cases_flagged: cleanCasesFlagged,
      synthetic_false_positive_rate: Math.round((cleanCasesFlagged / cleanCases.length) * 1000) / 10,
      injected_pattern_cases: injectedCases.length,
      injected_pattern_cases_detected: injectedCasesDetected,
      synthetic_detection_rate: Math.round((injectedCasesDetected / injectedCases.length) * 1000) / 10,
    };
  });

  return {
    label: 'Synthetic rule-check benchmark',
    interpretation: 'Rates measure rule behavior on a small, hand-authored synthetic set. Injected patterns are not verified fraud labels and these results do not predict real-world accuracy or fairness.',
    total_cases: business_types.reduce((total, item) => total + item.clean_cases + item.injected_pattern_cases, 0),
    business_types,
  };
}