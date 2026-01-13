// shared/bankFirstTriage.ts
// Phase 1: Compliance Filter - filters deals by bank rules

import type { DealCandidate } from './deals';

export interface BankRules {
  ltvCap: number;
  mandatoryVsc: boolean;
  mandatoryGap: boolean;
  maxPaymentToIncome?: number;
}

export interface ComplianceResult {
  validDeals: DealCandidate[];
  rejectedDeals: { deal: DealCandidate; violations: string[] }[];
}

/**
 * Phase 1: Compliance Filter
 * Filters deals based on bank rules (LTV cap, mandatory products)
 */
export function filterCompliantDeals(
  deals: DealCandidate[],
  rules: BankRules
): ComplianceResult {
  const validDeals: DealCandidate[] = [];
  const rejectedDeals: { deal: DealCandidate; violations: string[] }[] = [];

  for (const deal of deals) {
    const violations: string[] = [];

    // Check LTV cap
    if (deal.ltv > rules.ltvCap) {
      violations.push(`LTV ${deal.ltv.toFixed(0)}% exceeds cap of ${rules.ltvCap}%`);
    }

    // Check mandatory VSC (required for high-mileage vehicles)
    if (rules.mandatoryVsc && !deal.hasVsc) {
      violations.push('Mandatory VSC missing (high mileage vehicle)');
    }

    // Check mandatory GAP (required for high LTV deals)
    if (rules.mandatoryGap && !deal.hasGap) {
      violations.push('Mandatory GAP missing (negative equity)');
    }

    // Check PTI limit if specified
    if (rules.maxPaymentToIncome && deal.ptiPercent) {
      const ptiLimit = rules.maxPaymentToIncome * 100;
      if (deal.ptiPercent > ptiLimit) {
        violations.push(`PTI ${deal.ptiPercent.toFixed(0)}% exceeds limit of ${ptiLimit.toFixed(0)}%`);
      }
    }

    if (violations.length === 0) {
      validDeals.push(deal);
    } else {
      rejectedDeals.push({ deal, violations });
    }
  }

  return { validDeals, rejectedDeals };
}

/**
 * Determine bank rules based on deal characteristics
 */
export function determineBankRules(
  vehicleMileage: number,
  ltvPercent: number,
  creditTier: string
): BankRules {
  // High mileage threshold (over 100k miles typically requires VSC)
  const HIGH_MILEAGE_THRESHOLD = 100000;

  // High LTV threshold (over 110% typically requires GAP)
  const HIGH_LTV_THRESHOLD = 110;

  // LTV caps by credit tier
  const ltvCaps: Record<string, number> = {
    prime: 130,
    near_prime: 125,
    subprime: 120,
    deep_subprime: 115,
  };

  // PTI limits by credit tier
  const ptiLimits: Record<string, number> = {
    prime: 0.12,
    near_prime: 0.15,
    subprime: 0.18,
    deep_subprime: 0.25,
  };

  return {
    ltvCap: ltvCaps[creditTier] || 120,
    mandatoryVsc: vehicleMileage > HIGH_MILEAGE_THRESHOLD,
    mandatoryGap: ltvPercent > HIGH_LTV_THRESHOLD,
    maxPaymentToIncome: ptiLimits[creditTier],
  };
}

export interface TriageRequest {
  validDeals: Array<{
    id: string;
    payment: number;
    netCheckToDealer: number;
    hasGap: boolean;
    hasVsc: boolean;
    ltv: number;
    termMonths: number;
    lenderName: string;
  }>;
  targetPayment: number;
  mandatoryProducts: string[];
}

export interface TriageResponse {
  mode: 'profit' | 'survival';
  bestDealId: string;
  reason: string;
  badge: string;
}
