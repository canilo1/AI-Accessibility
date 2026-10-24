const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluateSyntheticBenchmark } = require('../dist/engine/fairnessBenchmark');

test('synthetic rule benchmark reports per-category false positives and pattern detection', () => {
  const report = evaluateSyntheticBenchmark();

  assert.equal(report.total_cases, 28);
  assert.equal(report.business_types.length, 4);
  for (const result of report.business_types) {
    assert.equal(result.clean_cases, 5);
    assert.equal(result.clean_cases_flagged, 0);
    assert.equal(result.synthetic_false_positive_rate, 0);
    assert.equal(result.injected_pattern_cases, 2);
    assert.equal(result.injected_pattern_cases_detected, 2);
    assert.equal(result.synthetic_detection_rate, 100);
  }
  assert.match(report.interpretation, /do not predict real-world accuracy or fairness/);
});