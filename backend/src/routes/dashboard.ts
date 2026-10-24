import { Router, Request, Response } from 'express';
import { taxpayersDb, returnsDb, flagsDb, appealsDb } from '../db';
import type { FraudFlag } from '../types';
import { evaluateSyntheticBenchmark } from '../engine/fairnessBenchmark';

const router = Router();

// GET /api/dashboard
router.get('/', (_req: Request, res: Response) => {
  const taxpayers  = taxpayersDb.all();
  const allReturns = returnsDb.all();
  const allFlags   = flagsDb.allFlags();
  const allAppeals = appealsDb.all();

  const total_taxpayers = taxpayers.length;
  const total_returns   = allReturns.length;
  const flagged_returns = allReturns.filter((r) => ['flagged', 'needs_review', 'approved_for_audit'].includes(r.status)).length;
  const cleared_returns = allReturns.filter((r) => r.status === 'cleared').length;
  const pending_returns = allReturns.filter((r) => r.status === 'pending').length;
  const dismissed_returns = allReturns.filter((r) => r.status === 'dismissed').length;

  const highRiskReturnIds = new Set(
    allFlags
      .filter((f) => f.severity === 'high' || f.severity === 'critical')
      .map((f) => f.tax_return_id)
  );
  const high_risk_count = highRiskReturnIds.size;

  const returnFlagCounts = allReturns
    .map((r) => allFlags.filter((f) => f.tax_return_id === r.id).length)
    .filter((c) => c > 0);
  const average_risk_score = returnFlagCounts.length > 0
    ? Math.round((returnFlagCounts.reduce((a, b) => a + b, 0) / returnFlagCounts.length) * 10 * 10) / 10
    : 0;

  // Recent flagged returns (last 10, across active statuses)
  const recent_flags = allReturns
    .filter((r) => ['flagged', 'needs_review', 'approved_for_audit'].includes(r.status))
    .slice(0, 10)
    .map((r) => {
      const tp = taxpayersDb.get(r.taxpayer_id);
      const flags = allFlags.filter((f) => f.tax_return_id === r.id);
      const severities: FraudFlag['severity'][] = ['critical', 'high', 'medium', 'low'];
      const max_severity = severities.find((s) => flags.some((f) => f.severity === s)) ?? null;
      return {
        id: r.id,
        tax_year: r.tax_year,
        status: r.status,
        taxpayer_name: tp?.name ?? '',
        tin: tp?.tin ?? '',
        flag_count: flags.length,
        max_severity,
      };
    });

  // Severity distribution
  const severity_distribution = (['critical', 'high', 'medium', 'low'] as const).map((severity) => ({
    severity,
    count: allFlags.filter((f) => f.severity === severity).length,
  }));

  // Top triggered rules
  const ruleCounts: Record<string, { rule_code: string; description: string; severity: FraudFlag['severity']; occurrences: number }> = {};
  for (const flag of allFlags) {
    if (!ruleCounts[flag.rule_code]) {
      ruleCounts[flag.rule_code] = { rule_code: flag.rule_code, description: flag.description, severity: flag.severity, occurrences: 0 };
    }
    ruleCounts[flag.rule_code].occurrences += 1;
  }
  const top_rules = Object.values(ruleCounts).sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);

  // ── Fairness & Responsible AI Metrics ────────────────────────────────────────

  // Flag rate per business type
  const businessTypes = ['individual', 'sole_proprietor', 'corporation', 'partnership'];
  const flag_rate_by_type = businessTypes.map((bt) => {
    const tpIds = taxpayers.filter((t) => t.business_type === bt).map((t) => t.id);
    const typeReturns = allReturns.filter((r) => tpIds.includes(r.taxpayer_id));
    const typeFlagged = typeReturns.filter((r) => ['flagged', 'needs_review', 'approved_for_audit', 'dismissed'].includes(r.status));
    return {
      business_type: bt,
      total: typeReturns.length,
      flagged: typeFlagged.length,
      rate: typeReturns.length > 0 ? Math.round((typeFlagged.length / typeReturns.length) * 1000) / 10 : 0,
    };
  });

  // Appeal overturn rate (accepted appeals / total resolved appeals)
  const resolvedAppeals = allAppeals.filter((a) => a.status !== 'pending');
  const acceptedAppeals = allAppeals.filter((a) => a.status === 'accepted');
  const appeal_overturn_rate = resolvedAppeals.length > 0
    ? Math.round((acceptedAppeals.length / resolvedAppeals.length) * 1000) / 10
    : 0;

  // Investigator dismissal rate
  const actioned = allReturns.filter((r) => ['dismissed', 'approved_for_audit', 'closed'].includes(r.status));
  const investigator_dismissal_rate = actioned.length > 0
    ? Math.round((dismissed_returns / actioned.length) * 1000) / 10
    : 0;

  // Appeals summary
  const appeals_summary = {
    submitted: allAppeals.length,
    accepted:  acceptedAppeals.length,
    rejected:  allAppeals.filter((a) => a.status === 'rejected').length,
    pending:   allAppeals.filter((a) => a.status === 'pending').length,
  };

  // Human oversight: returns that went through needs_review or beyond
  const needs_human = allReturns.filter((r) =>
    ['needs_review', 'approved_for_audit', 'dismissed', 'closed'].includes(r.status)
  ).length;
  const human_oversight_rate = total_returns > 0
    ? Math.round((needs_human / total_returns) * 1000) / 10
    : 0;

  const fairness_metrics = {
    flag_rate_by_type,
    appeal_overturn_rate,
    investigator_dismissal_rate,
    appeals_summary,
    human_oversight_rate,
  };
  const synthetic_benchmark = evaluateSyntheticBenchmark();

  return res.json({
    stats: { total_taxpayers, total_returns, flagged_returns, cleared_returns, pending_returns, high_risk_count, average_risk_score },
    recent_flags,
    severity_distribution,
    top_rules,
    fairness_metrics,
    synthetic_benchmark,
  });
});

export default router;
