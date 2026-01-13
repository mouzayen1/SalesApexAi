/**
 * LTV (Loan-to-Value) Calculation Module
 *
 * LTV DEFINITION:
 * LTV = (Amount Financed / Book Value) * 100
 *
 * IMPORTANT: LTV should be calculated using BOOK VALUE (wholesale/guide value),
 * NOT retail selling price. This is the industry standard because:
 *
 * 1. Book value represents the lender's collateral recovery value
 * 2. If the borrower defaults, the lender will recover the book value, not retail
 * 3. Using retail price would understate the lender's true risk
 *
 * Example:
 * - Retail Price: $20,000 (what customer pays)
 * - Book Value: $16,000 (wholesale/auction value)
 * - Amount Financed: $18,000
 * - LTV using book value: 112.5% (correct - shows lender risk)
 * - LTV using retail: 90% (incorrect - understates risk)
 *
 * Lenders typically cap LTV at 120-150% depending on credit tier.
 * Higher LTV = more risk = higher rates or denial.
 */

import { roundCents, toPercent, safeDivide } from './money';
import { estimateBookValue, getBookValueForLtv } from './bookValue';
import type { VehicleInfo, BookValueInput } from './types';

/**
 * LTV calculation result with full context
 */
export interface LtvResult {
  // Primary LTV (using book value)
  ltv: number;                  // LTV percentage (e.g., 125.5 for 125.5%)
  amountFinanced: number;       // Loan amount
  bookValueUsed: number;        // Book value used for calculation
  bookValueSource: string;      // Source of book value ('estimated', 'black_book', etc.)

  // Alternative LTV calculation (for reference)
  ltvUsingRetail: number;       // LTV if calculated using retail price (for comparison)
  retailPrice: number;          // The retail selling price

  // Diagnostic info
  spread: number;               // Difference between retail and book value
  spreadPercent: number;        // Spread as percentage of retail
}

/**
 * Calculate LTV using proper book value methodology.
 *
 * @param amountFinanced - Total amount being financed
 * @param vehicle - Vehicle information
 * @param bookValue - Optional external book value; if not provided, will be estimated
 * @returns LTV calculation result with full breakdown
 */
export function calculateLtv(
  amountFinanced: number,
  vehicle: VehicleInfo,
  bookValue?: BookValueInput
): LtvResult {
  // Get the book value to use (prefer provided, fall back to estimate)
  const bookValueData = getBookValueForLtv(vehicle, bookValue);
  const bookValueUsed = bookValueData.adjustedValue || bookValueData.wholesaleValue;

  // Calculate LTV using book value (the correct method)
  const ltv = toPercent(amountFinanced, bookValueUsed, 2);

  // Also calculate LTV using retail for comparison/diagnostics
  const ltvUsingRetail = toPercent(amountFinanced, vehicle.retailPrice, 2);

  // Calculate spread between retail and book
  const spread = roundCents(vehicle.retailPrice - bookValueUsed);
  const spreadPercent = toPercent(spread, vehicle.retailPrice, 1);

  return {
    ltv,
    amountFinanced,
    bookValueUsed,
    bookValueSource: bookValueData.source,
    ltvUsingRetail,
    retailPrice: vehicle.retailPrice,
    spread,
    spreadPercent,
  };
}

/**
 * Simple LTV calculation when you already have the book value.
 *
 * @param amountFinanced - Loan amount
 * @param bookValue - Book/wholesale value
 * @returns LTV percentage
 */
export function computeLtv(amountFinanced: number, bookValue: number): number {
  return toPercent(amountFinanced, bookValue, 2);
}

/**
 * Check if LTV is within a lender's cap.
 *
 * @param ltv - Current LTV percentage
 * @param lenderMaxLtv - Lender's maximum allowed LTV
 * @returns Object with pass/fail and excess amount
 */
export interface LtvCheckResult {
  passes: boolean;
  ltv: number;
  maxLtv: number;
  excessPercent: number;        // How much over the cap (0 if under)
  excessDollars: number;        // Dollar amount over the cap
}

export function checkLtvCap(
  ltv: number,
  lenderMaxLtv: number,
  amountFinanced: number,
  bookValue: number
): LtvCheckResult {
  const passes = ltv <= lenderMaxLtv;
  const excessPercent = passes ? 0 : roundCents(ltv - lenderMaxLtv);

  // Calculate excess in dollars
  const maxFinancedAmount = roundCents((lenderMaxLtv / 100) * bookValue);
  const excessDollars = passes ? 0 : roundCents(amountFinanced - maxFinancedAmount);

  return {
    passes,
    ltv,
    maxLtv: lenderMaxLtv,
    excessPercent,
    excessDollars,
  };
}

/**
 * Calculate maximum amount that can be financed under an LTV cap.
 *
 * @param bookValue - Book value of the vehicle
 * @param maxLtvPercent - Maximum LTV percentage allowed
 * @returns Maximum financeable amount
 */
export function calculateMaxFinancedAmount(
  bookValue: number,
  maxLtvPercent: number
): number {
  return roundCents((maxLtvPercent / 100) * bookValue);
}

/**
 * Determine if a deal is "upside down" (underwater).
 * A deal is upside down when the loan amount exceeds the vehicle's book value.
 *
 * @param amountFinanced - Loan amount
 * @param bookValue - Book value
 * @returns True if upside down (LTV > 100%)
 */
export function isUpsideDown(amountFinanced: number, bookValue: number): boolean {
  return amountFinanced > bookValue;
}

/**
 * Calculate the equity position in a vehicle.
 * Positive = equity, Negative = upside down.
 *
 * @param bookValue - Current book value
 * @param loanBalance - Current loan balance (amount financed for new loans)
 */
export function calculateEquity(bookValue: number, loanBalance: number): number {
  return roundCents(bookValue - loanBalance);
}

/**
 * Calculate negative equity (how much upside down).
 * Returns 0 if not upside down.
 */
export function calculateNegativeEquity(bookValue: number, loanBalance: number): number {
  const equity = calculateEquity(bookValue, loanBalance);
  return equity < 0 ? Math.abs(equity) : 0;
}

/**
 * Estimate the required down payment to meet an LTV target.
 *
 * @param targetAmount - Total deal amount before down payment
 * @param bookValue - Vehicle book value
 * @param targetLtv - Target LTV percentage
 * @returns Required down payment
 */
export function calculateRequiredDownForLtv(
  targetAmount: number,
  bookValue: number,
  targetLtv: number
): number {
  const maxFinanced = calculateMaxFinancedAmount(bookValue, targetLtv);
  const requiredDown = targetAmount - maxFinanced;
  return roundCents(Math.max(0, requiredDown));
}

/**
 * Generate LTV tier classification for risk assessment.
 */
export type LtvTier = 'excellent' | 'good' | 'acceptable' | 'elevated' | 'high';

export function classifyLtv(ltv: number): LtvTier {
  if (ltv <= 80) return 'excellent';
  if (ltv <= 100) return 'good';
  if (ltv <= 120) return 'acceptable';
  if (ltv <= 140) return 'elevated';
  return 'high';
}

/**
 * Get risk assessment based on LTV.
 */
export interface LtvRiskAssessment {
  tier: LtvTier;
  riskLevel: 1 | 2 | 3 | 4 | 5;
  gapRecommended: boolean;
  notes: string[];
}

export function assessLtvRisk(ltv: number): LtvRiskAssessment {
  const tier = classifyLtv(ltv);
  const notes: string[] = [];

  let riskLevel: 1 | 2 | 3 | 4 | 5;
  let gapRecommended = false;

  switch (tier) {
    case 'excellent':
      riskLevel = 1;
      notes.push('Strong equity position');
      break;
    case 'good':
      riskLevel = 2;
      notes.push('Adequate equity');
      break;
    case 'acceptable':
      riskLevel = 3;
      gapRecommended = true;
      notes.push('Moderate negative equity - GAP insurance recommended');
      break;
    case 'elevated':
      riskLevel = 4;
      gapRecommended = true;
      notes.push('Significant negative equity - GAP insurance strongly recommended');
      break;
    case 'high':
      riskLevel = 5;
      gapRecommended = true;
      notes.push('High LTV - may face lender restrictions');
      notes.push('GAP insurance essential');
      break;
  }

  return {
    tier,
    riskLevel,
    gapRecommended,
    notes,
  };
}

/**
 * Format LTV for display purposes.
 */
export function formatLtv(ltv: number): string {
  return `${ltv.toFixed(1)}%`;
}

/**
 * Generate a summary of LTV analysis for a deal.
 */
export interface LtvSummary {
  ltv: number;
  formatted: string;
  tier: LtvTier;
  passesLenderCap: boolean;
  lenderMaxLtv: number;
  bookValueUsed: number;
  bookValueSource: string;
  recommendation: string;
}

export function generateLtvSummary(
  amountFinanced: number,
  vehicle: VehicleInfo,
  lenderMaxLtv: number,
  bookValue?: BookValueInput
): LtvSummary {
  const ltvResult = calculateLtv(amountFinanced, vehicle, bookValue);
  const tier = classifyLtv(ltvResult.ltv);
  const passesLenderCap = ltvResult.ltv <= lenderMaxLtv;

  let recommendation: string;
  if (passesLenderCap) {
    if (tier === 'excellent' || tier === 'good') {
      recommendation = 'LTV within healthy range';
    } else {
      recommendation = `LTV acceptable but elevated - consider ${calculateRequiredDownForLtv(
        amountFinanced + ltvResult.retailPrice * 0.05,
        ltvResult.bookValueUsed,
        100
      ).toFixed(0)} additional down to improve equity`;
    }
  } else {
    const excess = roundCents(ltvResult.ltv - lenderMaxLtv);
    recommendation = `LTV exceeds lender cap by ${excess}% - increase down payment or reduce backend`;
  }

  return {
    ltv: ltvResult.ltv,
    formatted: formatLtv(ltvResult.ltv),
    tier,
    passesLenderCap,
    lenderMaxLtv,
    bookValueUsed: ltvResult.bookValueUsed,
    bookValueSource: ltvResult.bookValueSource,
    recommendation,
  };
}
