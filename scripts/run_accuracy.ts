#!/usr/bin/env tsx
/**
 * Accuracy Test CLI Runner
 *
 * Runs the 10-deal (or more) test suite and outputs results as CSV.
 *
 * Usage:
 *   npx tsx scripts/run_accuracy.ts
 *   npx tsx scripts/run_accuracy.ts --output results.csv
 *   npx tsx scripts/run_accuracy.ts --verbose
 */

import * as fs from 'fs';
import * as path from 'path';
import { runRehash } from '../shared/rehash';
import type { DealInput, DealCandidate, RiskAssessment } from '../shared/deals';

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const outputIndex = args.findIndex(a => a === '--output' || a === '-o');
const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : 'accuracy_summary.csv';

interface TestDeal {
  id: string;
  description: string;
  input: DealInput;
  expected: {
    hasValidCandidates?: boolean;
    bestLender?: string;
    paymentRange?: { min: number; max: number };
    aprRange?: { min: number; max: number };
    shouldRecommendGap?: boolean;
    shouldRecommendVsc?: boolean;
    vehicleWarningsExpected?: boolean;
    advanceMultiplierLessThan1?: boolean;
    ltvOver100?: boolean;
    ptiShouldPass?: boolean;
    expectedLender?: string;
    excludedFromLenders?: string[];
    notes?: string;
  };
}

interface TestResult {
  dealId: string;
  description: string;
  passed: boolean;
  candidateCount: number;
  bestLender: string | null;
  bestPayment: number | null;
  bestNetCheck: number | null;
  bestApr: number | null;
  recommendGap: boolean;
  recommendVsc: boolean;
  ltvPercent: number;
  errors: string[];
  warnings: string[];
}

function loadDeals(): TestDeal[] {
  const fixturesPath = path.join(__dirname, '../tests/fixtures/deals_10.json');
  const content = fs.readFileSync(fixturesPath, 'utf-8');
  const data = JSON.parse(content);
  return data.deals;
}

function runTest(deal: TestDeal): TestResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const result = runRehash(deal.input);

    // Validate expected outcomes
    if (deal.expected.hasValidCandidates !== false && result.allCandidates.length === 0) {
      errors.push('Expected valid candidates but got none');
    }

    if (deal.expected.bestLender && result.bestDeal?.lenderId !== deal.expected.bestLender) {
      warnings.push(`Expected lender ${deal.expected.bestLender}, got ${result.bestDeal?.lenderId}`);
    }

    if (deal.expected.paymentRange && result.bestDeal) {
      const { min, max } = deal.expected.paymentRange;
      if (result.bestDeal.payment < min || result.bestDeal.payment > max) {
        errors.push(`Payment ${result.bestDeal.payment} outside range [${min}, ${max}]`);
      }
    }

    if (deal.expected.shouldRecommendGap !== undefined) {
      if (result.riskAssessment.recommendGap !== deal.expected.shouldRecommendGap) {
        warnings.push(`GAP recommendation: expected ${deal.expected.shouldRecommendGap}, got ${result.riskAssessment.recommendGap}`);
      }
    }

    if (deal.expected.shouldRecommendVsc !== undefined) {
      if (result.riskAssessment.recommendVsc !== deal.expected.shouldRecommendVsc) {
        warnings.push(`VSC recommendation: expected ${deal.expected.shouldRecommendVsc}, got ${result.riskAssessment.recommendVsc}`);
      }
    }

    if (deal.expected.ltvOver100 && !result.riskAssessment.isUpsideDown) {
      errors.push('Expected LTV > 100% but deal is not upside down');
    }

    if (deal.expected.vehicleWarningsExpected) {
      const hasWarnings = result.allCandidates.some(
        c => c.vehicleWarnings && c.vehicleWarnings.length > 0
      );
      if (!hasWarnings) {
        warnings.push('Expected vehicle warnings but none found');
      }
    }

    if (deal.expected.excludedFromLenders) {
      const lenderIds = new Set(result.allCandidates.map(c => c.lenderId));
      deal.expected.excludedFromLenders.forEach(excluded => {
        if (lenderIds.has(excluded)) {
          errors.push(`Vehicle should be excluded from ${excluded} but candidates exist`);
        }
      });
    }

    return {
      dealId: deal.id,
      description: deal.description,
      passed: errors.length === 0,
      candidateCount: result.allCandidates.length,
      bestLender: result.bestDeal?.lenderId || null,
      bestPayment: result.bestDeal?.payment || null,
      bestNetCheck: result.bestDeal?.netCheckToDealer || null,
      bestApr: result.bestDeal?.apr || null,
      recommendGap: result.riskAssessment.recommendGap,
      recommendVsc: result.riskAssessment.recommendVsc,
      ltvPercent: result.riskAssessment.ltvPercent,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      dealId: deal.id,
      description: deal.description,
      passed: false,
      candidateCount: 0,
      bestLender: null,
      bestPayment: null,
      bestNetCheck: null,
      bestApr: null,
      recommendGap: false,
      recommendVsc: false,
      ltvPercent: 0,
      errors: [`Exception: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }
}

function generateCsv(results: TestResult[]): string {
  const headers = [
    'deal_id',
    'description',
    'pass_fail',
    'candidate_count',
    'best_lender',
    'best_payment',
    'best_net_check',
    'best_apr',
    'recommend_gap',
    'recommend_vsc',
    'ltv_percent',
    'error_count',
    'warning_count',
    'errors',
    'warnings',
  ].join(',');

  const rows = results.map(r => [
    r.dealId,
    `"${r.description.replace(/"/g, '""')}"`,
    r.passed ? 'PASS' : 'FAIL',
    r.candidateCount,
    r.bestLender || '',
    r.bestPayment?.toFixed(2) || '',
    r.bestNetCheck?.toFixed(2) || '',
    r.bestApr?.toFixed(2) || '',
    r.recommendGap ? 'Y' : 'N',
    r.recommendVsc ? 'Y' : 'N',
    r.ltvPercent.toFixed(1),
    r.errors.length,
    r.warnings.length,
    `"${r.errors.join('; ').replace(/"/g, '""')}"`,
    `"${r.warnings.join('; ').replace(/"/g, '""')}"`,
  ].join(','));

  return [headers, ...rows].join('\n');
}

function main() {
  console.log('Accuracy Test Suite Runner');
  console.log('==========================\n');

  const deals = loadDeals();
  console.log(`Loaded ${deals.length} test deals\n`);

  const results: TestResult[] = [];

  for (const deal of deals) {
    if (verbose) {
      console.log(`Running: ${deal.id} - ${deal.description}`);
    }

    const result = runTest(deal);
    results.push(result);

    if (verbose) {
      console.log(`  Status: ${result.passed ? 'PASS' : 'FAIL'}`);
      console.log(`  Candidates: ${result.candidateCount}`);
      console.log(`  Best: ${result.bestLender} @ $${result.bestPayment?.toFixed(2) || 'N/A'}`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.join(', ')}`);
      }
      console.log();
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log('Summary');
  console.log('-------');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Warnings: ${totalWarnings}`);
  console.log(`Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log();

  // Write CSV
  const csv = generateCsv(results);
  const outputPath = path.join(__dirname, '..', outputFile);
  fs.writeFileSync(outputPath, csv);
  console.log(`Results written to: ${outputPath}`);

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main();
