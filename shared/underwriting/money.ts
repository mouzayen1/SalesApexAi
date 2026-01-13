/**
 * Deterministic Money Handling Module
 *
 * All monetary calculations should use these helpers to ensure:
 * 1. Consistent rounding across the application
 * 2. No floating-point drift
 * 3. Predictable, auditable results
 *
 * Strategy: Use cents internally for integer math where practical,
 * and apply banker's rounding (round half to even) for final outputs.
 */

/**
 * Rounding strategy used throughout the application.
 * "half_away_from_zero" - Standard commercial rounding (0.5 rounds up for positive, down for negative)
 * "banker" - Round half to even (reduces bias over many calculations)
 */
export type RoundingStrategy = 'half_away_from_zero' | 'banker';

// Default rounding strategy for the application
const DEFAULT_STRATEGY: RoundingStrategy = 'half_away_from_zero';

/**
 * Round a number to specified decimal places using banker's rounding.
 * Banker's rounding: round half to nearest even number.
 * This minimizes cumulative rounding bias.
 */
export function roundBanker(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid value for rounding: ${value}`);
  }

  const multiplier = Math.pow(10, decimals);
  const shifted = value * multiplier;
  const floored = Math.floor(shifted);
  const decimal = shifted - floored;

  // If exactly 0.5, round to nearest even
  if (Math.abs(decimal - 0.5) < Number.EPSILON) {
    return floored % 2 === 0 ? floored / multiplier : (floored + 1) / multiplier;
  }

  return Math.round(shifted) / multiplier;
}

/**
 * Round a number using standard "half away from zero" rounding.
 * 0.5 always rounds up for positive numbers, down for negative.
 * This is the standard commercial/financial rounding method.
 */
export function roundHalfAway(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid value for rounding: ${value}`);
  }

  const multiplier = Math.pow(10, decimals);
  const sign = value >= 0 ? 1 : -1;
  const absValue = Math.abs(value);

  // Add a small epsilon to handle floating-point precision issues
  const shifted = absValue * multiplier + 1e-10;
  const rounded = Math.floor(shifted + 0.5);

  return (sign * rounded) / multiplier;
}

/**
 * Primary rounding function - uses the configured strategy.
 * All monetary values should be rounded using this function.
 */
export function round(
  value: number,
  decimals: number = 2,
  strategy: RoundingStrategy = DEFAULT_STRATEGY
): number {
  switch (strategy) {
    case 'banker':
      return roundBanker(value, decimals);
    case 'half_away_from_zero':
      return roundHalfAway(value, decimals);
    default:
      return roundHalfAway(value, decimals);
  }
}

/**
 * Round to nearest cent (2 decimal places).
 * Use this for all dollar amounts.
 */
export function roundCents(value: number): number {
  return round(value, 2);
}

/**
 * Round to nearest dollar (0 decimal places).
 * Use for display purposes or when whole dollars are required.
 */
export function roundDollars(value: number): number {
  return round(value, 0);
}

/**
 * Convert dollars to cents (integer).
 * Use for precise integer arithmetic.
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents (integer) back to dollars.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Safe division that returns 0 instead of NaN/Infinity.
 * Use for ratios like LTV, PTI, etc.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return 0;
  }
  const result = numerator / denominator;
  if (!Number.isFinite(result)) {
    return 0;
  }
  return result;
}

/**
 * Calculate percentage: (value / total) * 100
 * Returns 0 if total is 0.
 */
export function toPercent(value: number, total: number, decimals: number = 2): number {
  return round(safeDivide(value, total) * 100, decimals);
}

/**
 * Apply a percentage to a value: value * (percent / 100)
 */
export function applyPercent(value: number, percent: number): number {
  return roundCents(value * (percent / 100));
}

/**
 * Calculate the difference between two values as a percentage of the base.
 * Useful for comparing expected vs actual values.
 */
export function percentDiff(actual: number, expected: number): number {
  if (expected === 0) {
    return actual === 0 ? 0 : 100;
  }
  return round(((actual - expected) / Math.abs(expected)) * 100, 2);
}

/**
 * Check if two monetary values are equal within tolerance.
 * Default tolerance is 1 cent.
 */
export function moneyEquals(a: number, b: number, tolerance: number = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sum an array of numbers with proper rounding.
 */
export function sum(values: number[]): number {
  return roundCents(values.reduce((acc, v) => acc + v, 0));
}

/**
 * Multiply two monetary values with proper rounding.
 */
export function multiply(a: number, b: number): number {
  return roundCents(a * b);
}

/**
 * Format a number as currency string (for display only).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as percentage string (for display only).
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${round(value, decimals)}%`;
}
