// shared/deal-insights.ts
// Pure utility functions for computing badges, AI insights, and smart decisions

import type { DealInput, DealCandidate, CreditTier } from './deals';

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

// High theft risk vehicles (common models targeted for theft)
const HIGH_THEFT_RISK_MAKES = [
  'Hyundai', 'Kia', 'Honda', 'Toyota', 'Chevrolet', 'Ford', 'Dodge', 'Chrysler'
];

const HIGH_THEFT_RISK_MODELS: Record<string, string[]> = {
  'Hyundai': ['Elantra', 'Sonata', 'Accent', 'Santa Fe'],
  'Kia': ['Optima', 'Forte', 'Soul', 'Sportage', 'Rio'],
  'Honda': ['Civic', 'Accord', 'CR-V'],
  'Toyota': ['Camry', 'Corolla', 'RAV4'],
  'Chevrolet': ['Silverado', 'Malibu', 'Equinox'],
  'Ford': ['F-150', 'Explorer', 'Escape'],
  'Dodge': ['Charger', 'Challenger', 'Ram'],
  'Chrysler': ['300']
};

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
// BADGE COMPUTATION
// ============================================================================

export function computeBadges(
  dealInput: DealInput,
  bestDeal: DealCandidate | null,
  vehicleMake?: string,
  vehicleModel?: string
): VehicleBadge[] {
  const badges: VehicleBadge[] = [];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - dealInput.vehicleYear;

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

  // Warranty Status Badge
  const outOfWarranty = vehicleAge > WARRANTY_YEARS || dealInput.vehicleMileage > WARRANTY_MILES;
  if (outOfWarranty) {
    badges.push({
      label: 'Out of Warranty',
      type: 'info',
      detail: `${vehicleAge}yr, ${dealInput.vehicleMileage.toLocaleString()}mi`
    });
  }

  // High Theft Risk Badge
  const make = vehicleMake || dealInput.vehicleMake;
  if (make && isHighTheftRisk(make, vehicleModel, dealInput.vehicleYear)) {
    badges.push({
      label: 'High Theft Risk',
      type: 'warning',
      detail: `${make} ${dealInput.vehicleYear} (-20% advance)`
    });
  }

  // High Mileage Badge
  if (dealInput.vehicleMileage > 100000) {
    badges.push({
      label: 'High Mileage',
      type: 'warning',
      detail: `${dealInput.vehicleMileage.toLocaleString()} miles`
    });
  }

  // Old Vehicle Badge
  if (vehicleAge > 10) {
    badges.push({
      label: 'Aged Vehicle',
      type: 'info',
      detail: `${vehicleAge} years old`
    });
  }

  // Negative Equity on Trade
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

function isHighTheftRisk(make: string, model?: string, year?: number): boolean {
  const normalizedMake = make.trim();

  // Check if make is in high theft list
  if (!HIGH_THEFT_RISK_MAKES.some(m =>
    normalizedMake.toLowerCase() === m.toLowerCase()
  )) {
    return false;
  }

  // Special case: Hyundai/Kia from 2015-2021 without immobilizers
  if (['Hyundai', 'Kia'].some(m => normalizedMake.toLowerCase() === m.toLowerCase())) {
    if (year && year >= 2015 && year <= 2021) {
      return true;
    }
  }

  // Check specific model if provided
  if (model) {
    const modelsForMake = HIGH_THEFT_RISK_MODELS[normalizedMake];
    if (modelsForMake) {
      return modelsForMake.some(m =>
        model.toLowerCase().includes(m.toLowerCase())
      );
    }
  }

  return false;
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
