// shared/deal-insights.ts
// Pure utility functions for computing badges, AI insights, and smart decisions

import type { DealInput, DealCandidate, CreditTier } from './deals';
import type { RuleHit } from './lender-rules';

// ============================================================================
// TYPES
// ============================================================================

export interface VehicleBadge {
  label: string;
  type: 'warning' | 'info' | 'danger';
  detail?: string;
}

export interface AiInsight {
  status: 'realistic' | 'needs_adjustment' | 'challenging';
  statusLabel: string;
  gap: number;
  explanations: string[];
  strategy: string;
}

export interface SmartDecision {
  products: Array<{ name: string; reason: string }>;
  narrative: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Warranty thresholds (typical factory warranty)
const WARRANTY_YEARS = 5;
const WARRANTY_MILES = 60000;

// Credit tier display labels
export const CREDIT_TIER_LABELS: Record<CreditTier, string> = {
  'prime': 'Prime (700+)',
  'near_prime': 'Near Prime (650-699)',
  'subprime': 'Subprime (550-649)',
  'deep_subprime': 'Deep Subprime (<550)'
};

// ============================================================================
// BADGE COMPUTATION - DERIVED FROM RULE HITS
// ============================================================================

/**
 * Compute vehicle badges based on deal input and lender rule hits.
 * The "High Theft Risk" badge is ONLY shown if there is at least one
 * RuleHit with code === 'THEFT_RISK' from the lender rules engine.
 *
 * This ensures non-theft penalties (e.g., Chevy Cruze MODEL_RISK) do NOT
 * incorrectly show as theft risk.
 */
export function computeBadges(
  dealInput: DealInput,
  bestDeal: DealCandidate | null,
  vehicleMake?: string,
  vehicleModel?: string,
  allRuleHits?: RuleHit[]
): VehicleBadge[] {
  const badges: VehicleBadge[] = [];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - dealInput.vehicleYear;
  const ruleHits = allRuleHits || [];

  // LTV Badge - Upside Down Warning
  if (bestDeal && bestDeal.ltv > 100) {
    badges.push({
      label: `Upside Down (${bestDeal.ltv.toFixed(0)}% LTV)`,
      type: 'danger',
      detail: 'Amount financed exceeds vehicle value'
    });
  } else if (bestDeal && bestDeal.ltv > 90) {
    badges.push({
      label: `High LTV (${bestDeal.ltv.toFixed(0)}%)`,
      type: 'warning',
      detail: 'Loan-to-value ratio is elevated'
    });
  }

  // Warranty Status Badge (not derived from rule hits - universal logic)
  const outOfWarranty = vehicleAge > WARRANTY_YEARS || dealInput.vehicleMileage > WARRANTY_MILES;
  if (outOfWarranty) {
    badges.push({
      label: 'Out of Warranty',
      type: 'info',
      detail: `${vehicleAge}yr, ${dealInput.vehicleMileage.toLocaleString()}mi`
    });
  }

  // HIGH THEFT RISK Badge - ONLY if THEFT_RISK rule hit exists
  const theftRiskHits = ruleHits.filter(h => h.code === 'THEFT_RISK');
  if (theftRiskHits.length > 0) {
    // Get unique lenders with theft risk
    const lendersWithTheftRisk = [...new Set(theftRiskHits.map(h => h.lender))];
    const detail = theftRiskHits[0].label; // Use first hit's label
    badges.push({
      label: 'High Theft Risk',
      type: 'danger',
      detail: `${detail} (${lendersWithTheftRisk.length} lender${lendersWithTheftRisk.length > 1 ? 's' : ''} penalize)`
    });
  }

  // Model Risk Badge - for MODEL_RISK hits (non-theft)
  const modelRiskHits = ruleHits.filter(h => h.code === 'MODEL_RISK');
  if (modelRiskHits.length > 0 && theftRiskHits.length === 0) {
    // Only show model risk if no theft risk (avoid double badges)
    const uniqueLabels = [...new Set(modelRiskHits.map(h => h.label))];
    badges.push({
      label: 'Model Risk Penalty',
      type: 'warning',
      detail: uniqueLabels[0]
    });
  }

  // Mileage Risk Badge - for MILEAGE_RISK hits
  const mileageRiskHits = ruleHits.filter(h => h.code === 'MILEAGE_RISK');
  if (mileageRiskHits.length > 0) {
    badges.push({
      label: 'High Mileage Penalty',
      type: 'warning',
      detail: `${dealInput.vehicleMileage.toLocaleString()} miles - lender penalty applies`
    });
  } else if (dealInput.vehicleMileage > 100000) {
    // Fallback: show high mileage even if no specific rule hit
    badges.push({
      label: 'High Mileage',
      type: 'warning',
      detail: `${dealInput.vehicleMileage.toLocaleString()} miles`
    });
  }

  // Age Risk Badge - for AGE_RISK hits
  const ageRiskHits = ruleHits.filter(h => h.code === 'AGE_RISK');
  if (ageRiskHits.length > 0) {
    badges.push({
      label: 'Age Penalty',
      type: 'warning',
      detail: ageRiskHits[0].label
    });
  } else if (vehicleAge > 10) {
    // Fallback: show aged vehicle even if no specific rule hit
    badges.push({
      label: 'Aged Vehicle',
      type: 'info',
      detail: `${vehicleAge} years old`
    });
  }

  // Excluded Make Badge - if any lender excludes this make
  const excludedMakeHits = ruleHits.filter(h => h.code === 'EXCLUDED_MAKE');
  if (excludedMakeHits.length > 0) {
    const lenders = [...new Set(excludedMakeHits.map(h => h.lender))];
    badges.push({
      label: 'Excluded by Lenders',
      type: 'danger',
      detail: `${lenders.length} lender${lenders.length > 1 ? 's' : ''} won't finance this make`
    });
  }

  // Bonus indicators (positive badges)
  const bonusHits = ruleHits.filter(h =>
    h.code === 'BONUS_MAKE' ||
    h.code === 'BONUS_MODEL' ||
    h.code === 'BONUS_AGE' ||
    h.code === 'BONUS_MILEAGE'
  );
  if (bonusHits.length > 0) {
    const bestBonus = Math.max(...bonusHits.map(h => h.factor || 1.0));
    if (bestBonus > 1.0) {
      const bonusPct = ((bestBonus - 1) * 100).toFixed(0);
      badges.push({
        label: `Lender Preferred (+${bonusPct}%)`,
        type: 'info',
        detail: bonusHits[0].label
      });
    }
  }

  // Negative Equity on Trade (universal logic)
  if (dealInput.tradePayoff > dealInput.tradeAllowance && dealInput.tradeAllowance > 0) {
    const negEquity = dealInput.tradePayoff - dealInput.tradeAllowance;
    badges.push({
      label: `Negative Trade Equity`,
      type: 'danger',
      detail: `$${negEquity.toLocaleString()} rolled in`
    });
  }

  return badges;
}

// ============================================================================
// AI INSIGHT COMPUTATION
// ============================================================================

export function computeAiInsight(
  dealInput: DealInput,
  bestDeal: DealCandidate | null,
  allCandidates: DealCandidate[]
): AiInsight {
  const explanations: string[] = [];
  let status: AiInsight['status'] = 'realistic';
  let strategy = '';

  // No valid deals found
  if (!bestDeal || allCandidates.length === 0) {
    return {
      status: 'challenging',
      statusLabel: 'Challenging Deal',
      gap: 0,
      explanations: [
        'No lenders approved this structure.',
        'Consider increasing down payment or adjusting vehicle selection.'
      ],
      strategy: 'Restructure deal with more cash down or select a different vehicle.'
    };
  }

  // Calculate payment gap
  const paymentGap = bestDeal.payment - dealInput.targetPayment;
  const absGap = Math.abs(paymentGap);

  // LTV analysis
  if (bestDeal.ltv > 120) {
    status = 'needs_adjustment';
    explanations.push(`LTV at ${bestDeal.ltv.toFixed(0)}% is very high. Most lenders cap at 120-145%.`);
  } else if (bestDeal.ltv > 100) {
    explanations.push(`LTV at ${bestDeal.ltv.toFixed(0)}% - customer is slightly underwater.`);
  }

  // Payment analysis
  if (paymentGap > dealInput.paymentTolerance) {
    status = status === 'challenging' ? 'challenging' : 'needs_adjustment';
    explanations.push(`Best payment is $${bestDeal.payment.toFixed(0)}/mo, which is $${absGap.toFixed(0)} above target.`);
  } else if (paymentGap < -dealInput.paymentTolerance) {
    explanations.push(`Payment of $${bestDeal.payment.toFixed(0)}/mo is below target - room for backend products.`);
  } else {
    explanations.push(`Payment of $${bestDeal.payment.toFixed(0)}/mo is within target range.`);
  }

  // Profit analysis
  if (bestDeal.dealerProfit < 0) {
    status = 'needs_adjustment';
    explanations.push(`Negative profit of ${formatCurrency(bestDeal.dealerProfit)}. Consider increasing price or reducing trade allowance.`);
  } else if (bestDeal.dealerProfit < 1000) {
    explanations.push(`Thin profit margin of ${formatCurrency(bestDeal.dealerProfit)}.`);
  }

  // PTI analysis if income provided
  if (dealInput.monthlyGrossIncome && dealInput.monthlyGrossIncome > 0) {
    const pti = (bestDeal.payment / dealInput.monthlyGrossIncome) * 100;
    if (pti > 20) {
      status = status === 'realistic' ? 'needs_adjustment' : status;
      explanations.push(`PTI at ${pti.toFixed(0)}% exceeds 20% guideline. May affect approval odds.`);
    } else {
      explanations.push(`PTI at ${pti.toFixed(0)}% is within acceptable range.`);
    }
  }

  // Determine strategy
  if (status === 'challenging') {
    strategy = 'Consider a different vehicle in a lower price range or significantly increase down payment.';
  } else if (status === 'needs_adjustment') {
    if (paymentGap > 50) {
      strategy = `Increase down payment by $${Math.ceil(paymentGap * 24 / 100) * 100} or extend term to reduce payment.`;
    } else if (bestDeal.ltv > 120) {
      strategy = 'Add more cash down to reduce LTV, or remove backend products temporarily.';
    } else {
      strategy = 'Minor adjustments to down payment or term should make this deal work.';
    }
  } else {
    strategy = 'Deal structure is solid. Proceed with lender submission.';
  }

  // Set status label
  const statusLabel = status === 'realistic'
    ? 'Realistic Deal'
    : status === 'needs_adjustment'
      ? 'Needs Adjustment'
      : 'Challenging Deal';

  return {
    status,
    statusLabel,
    gap: absGap,
    explanations: explanations.slice(0, 2), // Max 2 explanations
    strategy
  };
}

// ============================================================================
// SMART DECISION COMPUTATION
// ============================================================================

export function computeSmartDecision(
  dealInput: DealInput,
  bestDeal: DealCandidate | null
): SmartDecision {
  const products: SmartDecision['products'] = [];
  const narrativeParts: string[] = [];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - dealInput.vehicleYear;

  if (!bestDeal) {
    return { products: [], narrative: '' };
  }

  // Check if GAP is included and why
  if (dealInput.backendProducts.gap && bestDeal.backendTotal > 0) {
    if (bestDeal.ltv > 100) {
      products.push({ name: 'GAP', reason: `High LTV (${bestDeal.ltv.toFixed(0)}%)` });
      narrativeParts.push(`Added GAP due to high LTV (${bestDeal.ltv.toFixed(0)}%)`);
    } else if (bestDeal.ltv > 80) {
      products.push({ name: 'GAP', reason: 'Elevated LTV' });
      narrativeParts.push('Added GAP for LTV protection');
    }
  }

  // Check if VSC is included and why
  if (dealInput.backendProducts.vsc && bestDeal.backendTotal > 0) {
    const outOfWarranty = vehicleAge > WARRANTY_YEARS || dealInput.vehicleMileage > WARRANTY_MILES;
    if (outOfWarranty) {
      products.push({
        name: 'VSC',
        reason: `Out of warranty (${vehicleAge}yr, ${dealInput.vehicleMileage.toLocaleString()}mi)`
      });
      narrativeParts.push(`Added VSC - vehicle out of warranty (${vehicleAge}yr, ${dealInput.vehicleMileage.toLocaleString()}mi)`);
    } else if (dealInput.vehicleMileage > 40000) {
      products.push({ name: 'VSC', reason: 'Higher mileage vehicle' });
      narrativeParts.push('Added VSC for higher mileage protection');
    }
  }

  // If no backend products were added
  if (bestDeal.backendTotal === 0 && (dealInput.backendProducts.gap || dealInput.backendProducts.vsc)) {
    narrativeParts.push('Backend products removed to maximize net check to dealer');
  }

  // Build narrative
  const narrative = narrativeParts.length > 0
    ? narrativeParts.join('. ') + '.'
    : 'Standard deal structure - no special product recommendations.';

  return { products, narrative };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// Calculate Payment-to-Income ratio
export function calculatePTI(payment: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0;
  return (payment / monthlyIncome) * 100;
}

// Check if PTI is within acceptable range (typically 15-20%)
export function isPTIAcceptable(pti: number): boolean {
  return pti <= 20;
}
