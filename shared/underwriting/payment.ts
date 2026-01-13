/**
 * Payment Calculation Module
 *
 * Implements the standard PMT formula used in financial calculations.
 * This matches Excel/Google Sheets PMT function behavior.
 *
 * PMT Formula:
 * payment = (rate * principal) / (1 - (1 + rate)^(-nper))
 *
 * Where:
 * - rate = periodic interest rate (APR / 12 / 100 for monthly)
 * - principal = amount financed (present value)
 * - nper = number of periods (term in months)
 */

import { roundCents, safeDivide } from './money';

/**
 * Payment calculation result with breakdown
 */
export interface PaymentResult {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  effectiveRate: number;  // Monthly rate used
}

/**
 * Calculate monthly payment using standard PMT formula.
 * This matches Excel PMT(rate, nper, pv) behavior.
 *
 * @param principal - Amount financed (loan amount)
 * @param annualRate - Annual interest rate as percentage (e.g., 18.5 for 18.5%)
 * @param termMonths - Loan term in months
 * @returns Monthly payment amount, rounded to cents
 *
 * @example
 * // $15,000 loan at 12% APR for 60 months
 * calculatePayment(15000, 12, 60) // Returns 333.67
 */
export function calculatePayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  // Validate inputs
  if (!Number.isFinite(principal) || principal < 0) {
    throw new Error(`Invalid principal: ${principal}`);
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new Error(`Invalid annual rate: ${annualRate}`);
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    throw new Error(`Invalid term: ${termMonths}`);
  }

  // If principal is 0, payment is 0
  if (principal === 0) {
    return 0;
  }

  // Handle 0% interest rate (simple division)
  if (annualRate === 0) {
    return roundCents(principal / termMonths);
  }

  // Convert annual rate to monthly rate (as decimal)
  const monthlyRate = annualRate / 100 / 12;

  // PMT formula: payment = (r * P) / (1 - (1 + r)^(-n))
  // Where r = monthly rate, P = principal, n = number of periods
  const numerator = monthlyRate * principal;
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);

  // Protect against division by zero (shouldn't happen with valid inputs)
  if (denominator === 0) {
    return roundCents(principal / termMonths);
  }

  const payment = numerator / denominator;

  return roundCents(payment);
}

/**
 * Calculate payment with full breakdown including total interest.
 *
 * @param principal - Amount financed
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Term in months
 */
export function calculatePaymentWithBreakdown(
  principal: number,
  annualRate: number,
  termMonths: number
): PaymentResult {
  const monthlyPayment = calculatePayment(principal, annualRate, termMonths);
  const totalPayments = roundCents(monthlyPayment * termMonths);
  const totalInterest = roundCents(totalPayments - principal);
  const effectiveRate = annualRate / 12;

  return {
    monthlyPayment,
    totalPayments,
    totalInterest,
    effectiveRate,
  };
}

/**
 * Inverse PMT: Calculate the principal that would result in a given payment.
 * Useful for "what can they afford" calculations.
 *
 * @param payment - Target monthly payment
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Term in months
 * @returns Maximum principal (amount financed) for this payment
 */
export function calculatePrincipalFromPayment(
  payment: number,
  annualRate: number,
  termMonths: number
): number {
  if (!Number.isFinite(payment) || payment <= 0) {
    return 0;
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return 0;
  }

  // Handle 0% interest rate
  if (annualRate === 0) {
    return roundCents(payment * termMonths);
  }

  // Convert annual rate to monthly rate
  const monthlyRate = annualRate / 100 / 12;

  // Inverse PMT formula: P = payment * (1 - (1 + r)^(-n)) / r
  const factor = 1 - Math.pow(1 + monthlyRate, -termMonths);
  const principal = safeDivide(payment * factor, monthlyRate);

  return roundCents(principal);
}

/**
 * Calculate the APR that would result in a specific payment for a given principal/term.
 * Uses Newton-Raphson method for numerical solution.
 *
 * @param principal - Amount financed
 * @param payment - Target monthly payment
 * @param termMonths - Term in months
 * @returns Annual rate as percentage, or null if no solution
 */
export function solveForRate(
  principal: number,
  payment: number,
  termMonths: number,
  maxIterations: number = 100,
  tolerance: number = 0.0001
): number | null {
  if (principal <= 0 || payment <= 0 || termMonths <= 0) {
    return null;
  }

  // Check if payment is less than simple interest-free payment
  if (payment < principal / termMonths) {
    return null; // No valid rate exists
  }

  // Initial guess (reasonable starting point)
  let rate = 0.1 / 12; // Start at 10% APR monthly

  for (let i = 0; i < maxIterations; i++) {
    // Calculate payment at current rate
    const factor = 1 - Math.pow(1 + rate, -termMonths);
    const calculatedPayment = (rate * principal) / factor;

    // Check convergence
    if (Math.abs(calculatedPayment - payment) < tolerance) {
      // Convert monthly rate back to annual percentage
      return roundCents(rate * 12 * 100 * 100) / 100; // Round to 2 decimals
    }

    // Newton-Raphson step
    // Derivative of PMT with respect to rate is complex, use numerical approximation
    const h = 0.00001;
    const factorH = 1 - Math.pow(1 + rate + h, -termMonths);
    const paymentH = ((rate + h) * principal) / factorH;
    const derivative = (paymentH - calculatedPayment) / h;

    if (Math.abs(derivative) < 1e-10) {
      break; // Derivative too small, can't continue
    }

    rate = rate - (calculatedPayment - payment) / derivative;

    // Ensure rate stays positive
    if (rate <= 0) {
      rate = 0.001 / 12;
    }
    if (rate > 1) {
      rate = 0.5 / 12; // Cap at reasonable maximum
    }
  }

  return null; // Failed to converge
}

/**
 * Generate an amortization schedule for a loan.
 *
 * @param principal - Initial loan amount
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Term in months
 */
export interface AmortizationRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function generateAmortization(
  principal: number,
  annualRate: number,
  termMonths: number
): AmortizationRow[] {
  const monthlyPayment = calculatePayment(principal, annualRate, termMonths);
  const monthlyRate = annualRate / 100 / 12;

  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let period = 1; period <= termMonths; period++) {
    const interest = roundCents(balance * monthlyRate);
    let principalPart = roundCents(monthlyPayment - interest);

    // Last payment adjustment for rounding
    if (period === termMonths) {
      principalPart = roundCents(balance);
    }

    balance = roundCents(Math.max(0, balance - principalPart));

    schedule.push({
      period,
      payment: roundCents(principalPart + interest),
      principal: principalPart,
      interest,
      balance,
    });
  }

  return schedule;
}

/**
 * Validate that a calculated payment is reasonable.
 * Returns validation result with warnings.
 */
export interface PaymentValidation {
  isValid: boolean;
  warnings: string[];
}

export function validatePayment(
  payment: number,
  principal: number,
  termMonths: number
): PaymentValidation {
  const warnings: string[] = [];
  let isValid = true;

  // Payment should be at least principal / term (0% interest floor)
  const minPayment = principal / termMonths;
  if (payment < minPayment * 0.99) { // Allow 1% tolerance
    warnings.push(`Payment ${payment} is less than interest-free minimum ${roundCents(minPayment)}`);
    isValid = false;
  }

  // Payment shouldn't be more than 2x the 30% APR payment (sanity check)
  const maxReasonablePayment = calculatePayment(principal, 30, termMonths) * 2;
  if (payment > maxReasonablePayment) {
    warnings.push(`Payment ${payment} exceeds reasonable maximum ${roundCents(maxReasonablePayment)}`);
    isValid = false;
  }

  // Check for NaN or Infinity
  if (!Number.isFinite(payment)) {
    warnings.push('Payment is not a valid number');
    isValid = false;
  }

  return { isValid, warnings };
}
