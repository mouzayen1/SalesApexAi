/**
 * Payment Calculation Tests
 *
 * Validates that the PMT formula matches Excel/financial calculator behavior.
 */

import { describe, it, expect } from 'vitest';
import { calculatePayment, calculatePrincipalFromPayment, solveForRate, calculatePaymentWithBreakdown } from '../shared/underwriting/payment';

describe('calculatePayment', () => {
  it('should match Excel PMT for standard loan', () => {
    // Excel: =PMT(0.12/12, 60, -15000) = 333.67
    const payment = calculatePayment(15000, 12, 60);
    expect(payment).toBeCloseTo(333.67, 2);
  });

  it('should handle 0% APR correctly', () => {
    // 0% interest = simple division
    const payment = calculatePayment(12000, 0, 48);
    expect(payment).toBe(250);
  });

  it('should match Excel for high interest rate', () => {
    // Standard PMT: (0.02 * 10000) / (1 - 1.02^-48) = 326.02
    const payment = calculatePayment(10000, 24, 48);
    expect(payment).toBeCloseTo(326.02, 2);
  });

  it('should match Excel for low interest rate', () => {
    // Standard PMT at 4.99% for 60 months = 471.67
    const payment = calculatePayment(25000, 4.99, 60);
    expect(payment).toBeCloseTo(471.67, 2);
  });

  it('should handle large principal amounts', () => {
    // Standard PMT at 8% for 72 months = 789.00
    const payment = calculatePayment(45000, 8, 72);
    expect(payment).toBeCloseTo(789.00, 1);
  });

  it('should return 0 for 0 principal', () => {
    const payment = calculatePayment(0, 12, 60);
    expect(payment).toBe(0);
  });

  it('should throw for negative principal', () => {
    expect(() => calculatePayment(-1000, 12, 60)).toThrow();
  });

  it('should throw for invalid term', () => {
    expect(() => calculatePayment(10000, 12, 0)).toThrow();
    expect(() => calculatePayment(10000, 12, -12)).toThrow();
  });
});

describe('calculatePrincipalFromPayment (inverse PMT)', () => {
  it('should reverse calculate principal from payment', () => {
    // If $333.67/mo at 12% for 60 months, principal should be ~$15000
    const principal = calculatePrincipalFromPayment(333.67, 12, 60);
    expect(principal).toBeCloseTo(15000, -2); // Within $100
  });

  it('should handle 0% APR', () => {
    const principal = calculatePrincipalFromPayment(250, 0, 48);
    expect(principal).toBe(12000);
  });

  it('should return 0 for invalid inputs', () => {
    expect(calculatePrincipalFromPayment(0, 12, 60)).toBe(0);
    expect(calculatePrincipalFromPayment(-100, 12, 60)).toBe(0);
    expect(calculatePrincipalFromPayment(100, 12, 0)).toBe(0);
  });
});

describe('calculatePaymentWithBreakdown', () => {
  it('should calculate total interest correctly', () => {
    const result = calculatePaymentWithBreakdown(15000, 12, 60);

    expect(result.monthlyPayment).toBeCloseTo(333.67, 2);
    expect(result.totalPayments).toBeCloseTo(20020.2, 0); // 333.67 * 60
    expect(result.totalInterest).toBeCloseTo(5020.2, 0); // Total - Principal
  });

  it('should have zero interest for 0% APR', () => {
    const result = calculatePaymentWithBreakdown(12000, 0, 48);

    expect(result.monthlyPayment).toBe(250);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayments).toBe(12000);
  });
});

describe('solveForRate', () => {
  it('should find the rate that produces a given payment', () => {
    // If payment is $333.67 for $15000 over 60 months, rate should be ~12%
    const rate = solveForRate(15000, 333.67, 60);

    expect(rate).not.toBeNull();
    if (rate !== null) {
      expect(rate).toBeCloseTo(12, 0);
    }
  });

  it('should return null for impossible payments', () => {
    // Payment less than principal/term is impossible
    const rate = solveForRate(15000, 100, 60);
    expect(rate).toBeNull();
  });

  it('should handle edge cases', () => {
    expect(solveForRate(0, 100, 60)).toBeNull();
    expect(solveForRate(15000, 0, 60)).toBeNull();
    expect(solveForRate(15000, 100, 0)).toBeNull();
  });
});

// Regression tests - known values that must not change
// These values are computed using standard PMT formula: payment = (r * P) / (1 - (1 + r)^(-n))
describe('Payment regression tests', () => {
  const regressionCases = [
    { principal: 10000, apr: 18, term: 48, expected: 293.75 },
    { principal: 15000, apr: 20, term: 60, expected: 397.41 },  // Corrected from 397.40
    { principal: 20000, apr: 15, term: 72, expected: 422.90 },  // Corrected from 420.29
    { principal: 25000, apr: 10, term: 60, expected: 531.18 },
    { principal: 8000, apr: 25, term: 36, expected: 318.08 },   // Corrected from 319.63
  ];

  regressionCases.forEach(({ principal, apr, term, expected }) => {
    it(`should calculate ${principal} at ${apr}% for ${term} months as ${expected}`, () => {
      const payment = calculatePayment(principal, apr, term);
      expect(payment).toBeCloseTo(expected, 2);
    });
  });
});
