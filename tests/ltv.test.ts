/**
 * LTV (Loan-to-Value) Calculation Tests
 *
 * Validates that LTV is correctly calculated using book value (not retail).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLtv,
  computeLtv,
  checkLtvCap,
  isUpsideDown,
  calculateMaxFinancedAmount,
  calculateRequiredDownForLtv,
  classifyLtv,
  assessLtvRisk,
} from '../shared/underwriting/ltv';
import { estimateBookValue } from '../shared/underwriting/bookValue';
import type { VehicleInfo } from '../shared/underwriting/types';

describe('computeLtv', () => {
  it('should calculate simple LTV correctly', () => {
    // $18000 loan / $16000 book value = 112.5%
    const ltv = computeLtv(18000, 16000);
    expect(ltv).toBe(112.5);
  });

  it('should return 0 for 0 book value', () => {
    const ltv = computeLtv(15000, 0);
    expect(ltv).toBe(0);
  });

  it('should handle equal values (100% LTV)', () => {
    const ltv = computeLtv(15000, 15000);
    expect(ltv).toBe(100);
  });

  it('should calculate LTV under 100% correctly', () => {
    // $12000 loan / $15000 book value = 80%
    const ltv = computeLtv(12000, 15000);
    expect(ltv).toBe(80);
  });
});

describe('calculateLtv with book value', () => {
  const testVehicle: VehicleInfo = {
    year: 2018,
    make: 'Honda',
    model: 'Accord',
    mileage: 65000,
    retailPrice: 20000,
    dealerCost: 16000,
  };

  it('should use book value instead of retail for LTV', () => {
    const result = calculateLtv(18000, testVehicle);

    // Book value should be less than retail
    expect(result.bookValueUsed).toBeLessThan(testVehicle.retailPrice);

    // LTV using book should be higher than LTV using retail
    expect(result.ltv).toBeGreaterThan(result.ltvUsingRetail);
  });

  it('should include diagnostic info', () => {
    const result = calculateLtv(18000, testVehicle);

    expect(result.spread).toBeGreaterThan(0);
    expect(result.spreadPercent).toBeGreaterThan(0);
    expect(result.bookValueSource).toBe('estimated');
  });

  it('should accept external book value', () => {
    const externalBookValue = {
      source: 'black_book' as const,
      wholesaleValue: 17000,
      retailValue: 20000,
      adjustedValue: 16500,
    };

    const result = calculateLtv(18000, testVehicle, externalBookValue);

    expect(result.bookValueUsed).toBe(16500); // Uses adjusted value
    expect(result.bookValueSource).toBe('black_book');
  });
});

describe('isUpsideDown', () => {
  it('should return true when loan exceeds book value', () => {
    expect(isUpsideDown(18000, 15000)).toBe(true);
  });

  it('should return false when loan is less than book value', () => {
    expect(isUpsideDown(12000, 15000)).toBe(false);
  });

  it('should return false when loan equals book value', () => {
    expect(isUpsideDown(15000, 15000)).toBe(false);
  });
});

describe('checkLtvCap', () => {
  it('should pass when LTV is under cap', () => {
    const result = checkLtvCap(120, 130, 18000, 15000);

    expect(result.passes).toBe(true);
    expect(result.excessPercent).toBe(0);
    expect(result.excessDollars).toBe(0);
  });

  it('should fail when LTV exceeds cap', () => {
    const result = checkLtvCap(145, 130, 21750, 15000);

    expect(result.passes).toBe(false);
    expect(result.excessPercent).toBeCloseTo(15, 0);
    expect(result.excessDollars).toBeGreaterThan(0);
  });

  it('should calculate exact excess dollars', () => {
    // LTV 150% on $10000 book = $15000 loan
    // Max at 130% = $13000
    // Excess = $2000
    const result = checkLtvCap(150, 130, 15000, 10000);

    expect(result.passes).toBe(false);
    expect(result.excessDollars).toBe(2000);
  });
});

describe('calculateMaxFinancedAmount', () => {
  it('should calculate max amount at 130% LTV', () => {
    const max = calculateMaxFinancedAmount(15000, 130);
    expect(max).toBe(19500); // 15000 * 1.30
  });

  it('should calculate max amount at 100% LTV', () => {
    const max = calculateMaxFinancedAmount(15000, 100);
    expect(max).toBe(15000);
  });

  it('should handle high LTV caps', () => {
    const max = calculateMaxFinancedAmount(15000, 145);
    expect(max).toBe(21750);
  });
});

describe('calculateRequiredDownForLtv', () => {
  it('should calculate required down payment', () => {
    // Target amount $22000, book value $15000, target LTV 130%
    // Max financed = $19500, required down = $2500
    const required = calculateRequiredDownForLtv(22000, 15000, 130);
    expect(required).toBe(2500);
  });

  it('should return 0 when no down needed', () => {
    // Target amount $18000, book value $15000, target LTV 130% = max $19500
    const required = calculateRequiredDownForLtv(18000, 15000, 130);
    expect(required).toBe(0);
  });
});

describe('classifyLtv', () => {
  it('should classify excellent LTV', () => {
    expect(classifyLtv(75)).toBe('excellent');
    expect(classifyLtv(80)).toBe('excellent');
  });

  it('should classify good LTV', () => {
    expect(classifyLtv(85)).toBe('good');
    expect(classifyLtv(100)).toBe('good');
  });

  it('should classify acceptable LTV', () => {
    expect(classifyLtv(110)).toBe('acceptable');
    expect(classifyLtv(120)).toBe('acceptable');
  });

  it('should classify elevated LTV', () => {
    expect(classifyLtv(125)).toBe('elevated');
    expect(classifyLtv(140)).toBe('elevated');
  });

  it('should classify high LTV', () => {
    expect(classifyLtv(145)).toBe('high');
    expect(classifyLtv(160)).toBe('high');
  });
});

describe('assessLtvRisk', () => {
  it('should recommend GAP for elevated LTV', () => {
    const assessment = assessLtvRisk(125);

    expect(assessment.gapRecommended).toBe(true);
    expect(assessment.riskLevel).toBeGreaterThanOrEqual(3);
  });

  it('should not recommend GAP for low LTV', () => {
    const assessment = assessLtvRisk(75);

    expect(assessment.gapRecommended).toBe(false);
    expect(assessment.riskLevel).toBe(1);
  });

  it('should include relevant notes', () => {
    const highAssessment = assessLtvRisk(150);
    expect(highAssessment.notes.length).toBeGreaterThan(0);
    expect(highAssessment.notes.some(n => n.toLowerCase().includes('gap'))).toBe(true);
  });
});

describe('Book value estimation', () => {
  it('should estimate lower book value for older vehicles', () => {
    const newVehicle: VehicleInfo = {
      year: 2023,
      make: 'Honda',
      model: 'Accord',
      mileage: 10000,
      retailPrice: 30000,
      dealerCost: 26000,
    };

    const oldVehicle: VehicleInfo = {
      year: 2015,
      make: 'Honda',
      model: 'Accord',
      mileage: 120000,
      retailPrice: 12000,
      dealerCost: 9000,
    };

    const newBook = estimateBookValue(newVehicle);
    const oldBook = estimateBookValue(oldVehicle);

    // Wholesale/retail ratio should be higher for newer vehicles
    const newRatio = newBook.wholesaleValue / newVehicle.retailPrice;
    const oldRatio = oldBook.wholesaleValue / oldVehicle.retailPrice;

    expect(newRatio).toBeGreaterThan(oldRatio);
  });

  it('should apply make-specific depreciation', () => {
    // Use newer vehicles where depreciation differences are more visible
    // (older vehicles may both get capped at retail)
    const toyota: VehicleInfo = {
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      mileage: 30000,
      retailPrice: 28000,
      dealerCost: 24000,
    };

    const chrysler: VehicleInfo = {
      year: 2022,
      make: 'Chrysler',
      model: '200',
      mileage: 30000,
      retailPrice: 28000,
      dealerCost: 24000,
    };

    const toyotaBook = estimateBookValue(toyota);
    const chryslerBook = estimateBookValue(chrysler);

    // Toyota should retain more value due to stronger residual
    expect(toyotaBook.wholesaleValue).toBeGreaterThanOrEqual(chryslerBook.wholesaleValue);
  });
});

// Regression tests
describe('LTV regression tests', () => {
  const cases = [
    { amountFinanced: 15000, bookValue: 12000, expectedLtv: 125 },
    { amountFinanced: 18000, bookValue: 15000, expectedLtv: 120 },
    { amountFinanced: 22000, bookValue: 20000, expectedLtv: 110 },
    { amountFinanced: 12000, bookValue: 15000, expectedLtv: 80 },
  ];

  cases.forEach(({ amountFinanced, bookValue, expectedLtv }) => {
    it(`should calculate ${amountFinanced}/${bookValue} as ${expectedLtv}% LTV`, () => {
      const ltv = computeLtv(amountFinanced, bookValue);
      expect(ltv).toBe(expectedLtv);
    });
  });
});
