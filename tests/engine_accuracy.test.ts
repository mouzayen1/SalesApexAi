/**
 * Engine Accuracy Test Suite
 *
 * Runs the 10-deal test suite against the rehash optimizer
 * to validate calculation accuracy and expected behaviors.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runRehash } from '../shared/rehash';
import type { DealInput } from '../shared/deals';
import dealsFixture from './fixtures/deals_10.json';

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

const deals = dealsFixture.deals as TestDeal[];

describe('10-Deal Accuracy Test Suite', () => {
  describe('Basic functionality', () => {
    deals.forEach((deal) => {
      describe(`${deal.id}: ${deal.description}`, () => {
        const result = runRehash(deal.input);

        if (deal.expected.hasValidCandidates !== false) {
          it('should produce valid candidates', () => {
            expect(result.allCandidates.length).toBeGreaterThan(0);
            expect(result.bestDeal).not.toBeNull();
          });
        }

        if (deal.expected.bestLender) {
          it(`should select ${deal.expected.bestLender} as best lender`, () => {
            expect(result.bestDeal?.lenderId).toBe(deal.expected.bestLender);
          });
        }

        if (deal.expected.paymentRange) {
          it('should produce payment within expected range', () => {
            expect(result.bestDeal?.payment).toBeGreaterThanOrEqual(deal.expected.paymentRange!.min);
            expect(result.bestDeal?.payment).toBeLessThanOrEqual(deal.expected.paymentRange!.max);
          });
        }

        if (deal.expected.aprRange) {
          it('should produce APR within expected range', () => {
            expect(result.bestDeal?.apr).toBeGreaterThanOrEqual(deal.expected.aprRange!.min);
            expect(result.bestDeal?.apr).toBeLessThanOrEqual(deal.expected.aprRange!.max);
          });
        }
      });
    });
  });

  describe('Risk Assessment', () => {
    deals.forEach((deal) => {
      const result = runRehash(deal.input);

      if (deal.expected.shouldRecommendGap !== undefined) {
        it(`${deal.id}: GAP recommendation should be ${deal.expected.shouldRecommendGap}`, () => {
          expect(result.riskAssessment.recommendGap).toBe(deal.expected.shouldRecommendGap);
        });
      }

      if (deal.expected.shouldRecommendVsc !== undefined) {
        it(`${deal.id}: VSC recommendation should be ${deal.expected.shouldRecommendVsc}`, () => {
          expect(result.riskAssessment.recommendVsc).toBe(deal.expected.shouldRecommendVsc);
        });
      }

      if (deal.expected.ltvOver100) {
        it(`${deal.id}: should detect upside down deal`, () => {
          expect(result.riskAssessment.isUpsideDown).toBe(true);
          expect(result.riskAssessment.ltvPercent).toBeGreaterThan(100);
        });
      }
    });
  });

  describe('Vehicle Eligibility', () => {
    deals.forEach((deal) => {
      const result = runRehash(deal.input);

      if (deal.expected.vehicleWarningsExpected) {
        it(`${deal.id}: should have vehicle warnings`, () => {
          // Check if any candidate has vehicle warnings
          const hasWarnings = result.allCandidates.some(
            c => c.vehicleWarnings && c.vehicleWarnings.length > 0
          );
          expect(hasWarnings).toBe(true);
        });
      }

      if (deal.expected.advanceMultiplierLessThan1) {
        it(`${deal.id}: should have reduced advance multiplier`, () => {
          const hasReducedMultiplier = result.allCandidates.some(
            c => c.advanceMultiplier !== undefined && c.advanceMultiplier < 1.0
          );
          expect(hasReducedMultiplier).toBe(true);
        });
      }

      if (deal.expected.excludedFromLenders) {
        it(`${deal.id}: should be excluded from specified lenders`, () => {
          const lenderIds = result.allCandidates.map(c => c.lenderId);
          const uniqueLenders = Array.from(new Set(lenderIds));

          deal.expected.excludedFromLenders!.forEach(excludedLender => {
            expect(uniqueLenders).not.toContain(excludedLender);
          });
        });
      }
    });
  });

  describe('PTI Validation', () => {
    deals.forEach((deal) => {
      if (deal.input.monthlyIncome) {
        const result = runRehash(deal.input);

        if (deal.expected.ptiShouldPass) {
          it(`${deal.id}: PTI should pass for provided income`, () => {
            // At least some candidates should have PTI within limits
            const passingCandidates = result.allCandidates.filter(
              c => c.ptiExceedsLimit === false
            );
            expect(passingCandidates.length).toBeGreaterThan(0);
          });
        }
      }
    });
  });
});

describe('Payment Determinism', () => {
  it('should produce identical results for identical inputs', () => {
    const deal = deals[0];

    const result1 = runRehash(deal.input);
    const result2 = runRehash(deal.input);

    // Results should be exactly identical
    expect(result1.allCandidates.length).toBe(result2.allCandidates.length);
    expect(result1.bestDeal?.payment).toBe(result2.bestDeal?.payment);
    expect(result1.bestDeal?.netCheckToDealer).toBe(result2.bestDeal?.netCheckToDealer);
  });

  it('should round payments to cents', () => {
    deals.forEach((deal) => {
      const result = runRehash(deal.input);

      result.allCandidates.forEach((candidate) => {
        // Check that payment has at most 2 decimal places
        const paymentCents = Math.round(candidate.payment * 100);
        expect(candidate.payment).toBeCloseTo(paymentCents / 100, 2);
      });
    });
  });
});

describe('Sorting and Selection', () => {
  it('should sort by netCheckToDealer descending', () => {
    const deal = deals[0];
    const result = runRehash(deal.input);

    // Verify descending order
    for (let i = 1; i < result.allCandidates.length; i++) {
      expect(result.allCandidates[i - 1].netCheckToDealer)
        .toBeGreaterThanOrEqual(result.allCandidates[i].netCheckToDealer);
    }
  });

  it('should prefer candidates within payment tolerance', () => {
    const deal = deals[0];
    const result = runRehash(deal.input);

    const targetLow = deal.input.targetPayment - deal.input.paymentTolerance;
    const targetHigh = deal.input.targetPayment + deal.input.paymentTolerance;

    // If best deal is within tolerance, verify it was selected correctly
    if (result.bestDeal && result.bestDeal.payment >= targetLow && result.bestDeal.payment <= targetHigh) {
      const withinTolerance = result.allCandidates.filter(
        c => c.payment >= targetLow && c.payment <= targetHigh
      );

      // Best deal should have highest net check among those in tolerance
      withinTolerance.forEach((c) => {
        expect(result.bestDeal!.netCheckToDealer).toBeGreaterThanOrEqual(c.netCheckToDealer);
      });
    }
  });
});

describe('Backend Scenarios', () => {
  it('should generate multiple backend scenarios', () => {
    const deal = deals[0];
    const result = runRehash(deal.input);

    // Should have candidates with different optimization levels
    const levels = new Set(result.allCandidates.map(c => c.optimizationLevel));
    expect(levels.size).toBeGreaterThanOrEqual(2);
  });

  it('should include GAP-only and no-products scenarios', () => {
    const deal = deals[0];
    const result = runRehash(deal.input);

    const hasOptimal = result.allCandidates.some(c => c.optimizationLevel === 'optimal');
    const hasAllStripped = result.allCandidates.some(c => c.optimizationLevel === 'all_stripped');

    expect(hasOptimal).toBe(true);
    expect(hasAllStripped).toBe(true);
  });
});

describe('Edge Cases', () => {
  it('should handle zero down payment', () => {
    const zeroDealDown = { ...deals[0].input, downPayment: 0 };
    const result = runRehash(zeroDealDown);

    // Should still produce results (may have fewer due to min down requirements)
    expect(result.riskAssessment).toBeDefined();
  });

  it('should handle trade with negative equity', () => {
    const negativeEquityDeal = {
      ...deals[0].input,
      tradeAllowance: 5000,
      tradePayoff: 8000, // Owes more than trade is worth
    };

    const result = runRehash(negativeEquityDeal);

    // Should handle negative equity gracefully
    expect(result.riskAssessment).toBeDefined();
  });

  it('should handle high mileage vehicles', () => {
    const highMileageDeal = {
      ...deals[0].input,
      vehicleMileage: 175000,
    };

    const result = runRehash(highMileageDeal);

    // Some lenders should be excluded due to mileage
    const uniqueLenders = new Set(result.allCandidates.map(c => c.lenderId));

    // UAC has 150k max, should not appear
    expect(uniqueLenders.has('uac')).toBe(false);
  });
});
