// shared/rehash.ts
import type { DealInput, DealCandidate, IncludedProducts } from './deals';
import { LENDERS, LenderConfig } from './lenders';

// Default product costs
const GAP_COST = 895;
const VSC_COST = 1800;

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
}

export interface OptimalProductStructure {
  shouldAddGap: boolean;
  shouldAddVsc: boolean;
  gapReason: string;
  vscReason: string;
}

/**
 * Calculate the optimal backend product structure based on vehicle risk profile
 */
export function calculateOptimalBackendStructure(deal: DealInput): OptimalProductStructure {
  // Get book value (use provided or estimate as cost * 1.15)
  const bookValue = deal.bookValue ?? deal.vehicleCost * 1.15;

  // Calculate base amount financed without backend to check LTV
  const taxableBase = deal.vehiclePrice;
  const tax = taxableBase * deal.taxRate;
  const grossWithoutBackend = taxableBase + tax + deal.fees;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  const baseAmountFinanced = Math.max(grossWithoutBackend - totalDown, 0);

  // Calculate LTV without backend
  const ltvWithoutBackend = bookValue > 0 ? (baseAmountFinanced / bookValue) * 100 : 0;

  // Calculate vehicle age
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - deal.vehicleYear;

  // Smart Product Rules
  let shouldAddGap = false;
  let gapReason = '';
  let shouldAddVsc = false;
  let vscReason = '';

  // Auto-Add GAP Logic: If LTV > 100%
  if (ltvWithoutBackend > 100) {
    shouldAddGap = true;
    gapReason = `Added GAP due to ${ltvWithoutBackend.toFixed(0)}% LTV (exceeds 100%)`;
  }

  // Auto-Add VSC Logic: If mileage > 50,000 OR vehicle age > 4 years
  if (deal.vehicleMileage > 50000) {
    shouldAddVsc = true;
    vscReason = `Added VSC due to high mileage (${deal.vehicleMileage.toLocaleString()} miles)`;
  } else if (vehicleAge > 4) {
    shouldAddVsc = true;
    vscReason = `Added VSC due to vehicle age (${vehicleAge} years - factory warranty expired)`;
  }

  return {
    shouldAddGap,
    shouldAddVsc,
    gapReason,
    vscReason,
  };
}

export function calculateMonthlyPayment(
  amountFinanced: number,
  apr: number,
  termMonths: number
): number {
  const r = apr / 100 / 12;
  if (r === 0) return amountFinanced / termMonths;
  const num = r * amountFinanced;
  const den = 1 - Math.pow(1 + r, -termMonths);
  return num / den;
}

function pickApr(lender: LenderConfig, creditTier: DealInput['customerCreditTier']): number | null {
  const row = lender.pricingGrid.find(p => p.creditTier === creditTier);
  if (!row) return null;
  return (row.minApr + row.maxApr) / 2;
}

function computeAmountFinanced(deal: DealInput, backendTotal: number): number {
  const taxableBase = deal.vehiclePrice;
  const tax = taxableBase * deal.taxRate;
  const gross = taxableBase + tax + deal.fees + backendTotal;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  return Math.max(gross - totalDown, 0);
}

function estimateNetCheckAndProfit(
  deal: DealInput,
  lender: LenderConfig,
  tierRow: { baseAdvancePercent: number; maxAdvancePercent: number; maxLtvPercent: number },
  amountFinanced: number,
  backendTotal: number
): {
  netCheckToDealer: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  dealerProfit: number;
  totalDown: number;
  ltv: number;
} {
  const vehicleValue = deal.vehiclePrice;
  const ltv = vehicleValue > 0 ? (amountFinanced / vehicleValue) * 100 : 999;

  const baseAdvance = (tierRow.baseAdvancePercent / 100) * deal.vehicleCost;
  const maxAdvanceByCost = (tierRow.maxAdvancePercent / 100) * deal.vehicleCost;
  const maxAdvanceByLtv = (tierRow.maxLtvPercent / 100) * vehicleValue;

  const grossAdvance = Math.min(amountFinanced, maxAdvanceByCost, maxAdvanceByLtv);

  const lenderFee = (lender.lenderFeePercent / 100) * amountFinanced;
  const netCheck = Math.max(grossAdvance - lenderFee - deal.tradePayoff, 0);

  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  const frontGross = deal.vehiclePrice - deal.vehicleCost;
  const backGross = backendTotal;

  const dealerProfit = netCheck + totalDown - deal.vehicleCost - deal.fees;

  return {
    netCheckToDealer: netCheck,
    dealerFrontGross: frontGross,
    dealerBackEndGross: backGross,
    dealerProfit,
    totalDown,
    ltv,
  };
}

interface BackendScenario {
  label: string;
  value: number;
  gap: boolean;
  vsc: boolean;
  priority: number;  // Lower is better (1 = Dream Deal, 2 = Save, 3 = Bare Bones)
  reason: string;
}

/**
 * Generate prioritized backend scenarios based on optimal structure
 */
function generateBackendScenarios(
  optimalStructure: OptimalProductStructure,
  otherProductsTotal: number,
  lenderMaxBackend: number
): BackendScenario[] {
  const scenarios: BackendScenario[] = [];

  const gapValue = optimalStructure.shouldAddGap ? GAP_COST : 0;
  const vscValue = optimalStructure.shouldAddVsc ? VSC_COST : 0;

  // Build optimization reason
  const reasons: string[] = [];
  if (optimalStructure.gapReason) reasons.push(optimalStructure.gapReason);
  if (optimalStructure.vscReason) reasons.push(optimalStructure.vscReason);
  const baseReason = reasons.length > 0 ? reasons.join('; ') : 'Standard deal structure';

  // Priority 1: Dream Deal - Both GAP & VSC (if conditions met)
  if (optimalStructure.shouldAddGap && optimalStructure.shouldAddVsc) {
    const maxBackendValue = Math.min(gapValue + vscValue + otherProductsTotal, lenderMaxBackend);
    scenarios.push({
      label: 'Dream Deal (GAP + VSC)',
      value: maxBackendValue,
      gap: true,
      vsc: true,
      priority: 1,
      reason: baseReason,
    });
  } else if (optimalStructure.shouldAddGap) {
    // Only GAP recommended
    const maxBackendValue = Math.min(gapValue + otherProductsTotal, lenderMaxBackend);
    scenarios.push({
      label: 'Optimal (GAP Only)',
      value: maxBackendValue,
      gap: true,
      vsc: false,
      priority: 1,
      reason: optimalStructure.gapReason || 'GAP recommended based on deal structure',
    });
  } else if (optimalStructure.shouldAddVsc) {
    // Only VSC recommended
    const maxBackendValue = Math.min(vscValue + otherProductsTotal, lenderMaxBackend);
    scenarios.push({
      label: 'Optimal (VSC Only)',
      value: maxBackendValue,
      gap: false,
      vsc: true,
      priority: 1,
      reason: optimalStructure.vscReason || 'VSC recommended based on vehicle profile',
    });
  }

  // Priority 2: Save Deal - Only GAP (if both were originally recommended)
  if (optimalStructure.shouldAddGap && optimalStructure.shouldAddVsc) {
    const gapOnlyValue = Math.min(gapValue + otherProductsTotal, lenderMaxBackend);
    scenarios.push({
      label: 'Save Deal (GAP Only)',
      value: gapOnlyValue,
      gap: true,
      vsc: false,
      priority: 2,
      reason: 'Removed VSC to reduce payment/meet LTV constraints',
    });
  }

  // Priority 3: Bare Bones - No backend
  scenarios.push({
    label: 'Bare Bones (No Backend)',
    value: otherProductsTotal,  // Only other products if any
    gap: false,
    vsc: false,
    priority: 3,
    reason: 'No backend products to maximize approval chances',
  });

  return scenarios;
}

/**
 * Test a single deal configuration and return candidate if valid
 */
function testDealConfiguration(
  deal: DealInput,
  lender: LenderConfig,
  tierRow: { baseAdvancePercent: number; maxAdvancePercent: number; maxLtvPercent: number; minDownPct: number },
  apr: number,
  term: number,
  downPayment: number,
  scenario: BackendScenario,
  targetPayment: number,
  paymentTolerance: number
): { candidate: DealCandidate | null; failReason: string | null } {
  const modifiedDeal: DealInput = { ...deal, downPayment };
  const amountFinanced = computeAmountFinanced(modifiedDeal, scenario.value);

  // Check amount financed bounds
  if (amountFinanced < lender.minAmountFinanced) {
    return { candidate: null, failReason: 'Below minimum amount financed' };
  }
  if (amountFinanced > lender.maxAmountFinanced) {
    return { candidate: null, failReason: 'Above maximum amount financed' };
  }

  // Check backend percentage
  const backendPct = amountFinanced > 0 ? (scenario.value / amountFinanced) * 100 : 999;
  if (backendPct > lender.maxBackendPercentOfAmount) {
    return { candidate: null, failReason: 'Backend exceeds percentage cap' };
  }

  // Run lender validation
  const check = lender.validateDeal(modifiedDeal, amountFinanced);
  if (!check.isValid) {
    return { candidate: null, failReason: check.reasons.join('; ') };
  }

  // Check LTV against lender max
  const ltv = deal.vehiclePrice > 0 ? (amountFinanced / deal.vehiclePrice) * 100 : 999;
  if (ltv > tierRow.maxLtvPercent) {
    return { candidate: null, failReason: `LTV ${ltv.toFixed(0)}% exceeds max ${tierRow.maxLtvPercent}%` };
  }

  // Calculate payment
  const payment = calculateMonthlyPayment(amountFinanced, apr, term);

  // Calculate financial metrics
  const {
    netCheckToDealer,
    dealerFrontGross,
    dealerBackEndGross,
    dealerProfit,
    totalDown,
    ltv: finalLtv,
  } = estimateNetCheckAndProfit(modifiedDeal, lender, tierRow, amountFinanced, scenario.value);

  // Build adjustments description
  const adjustments: string[] = [];
  adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);
  if (downPayment !== deal.downPayment) {
    adjustments.push(`Increased down from $${deal.downPayment.toFixed(0)} to $${downPayment.toFixed(0)}`);
  }

  if (scenario.gap && scenario.vsc) {
    adjustments.push(`Included GAP ($${GAP_COST}) + VSC ($${VSC_COST})`);
  } else if (scenario.gap) {
    adjustments.push(`Included GAP ($${GAP_COST})`);
  } else if (scenario.vsc) {
    adjustments.push(`Included VSC ($${VSC_COST})`);
  } else {
    adjustments.push('No backend products');
  }

  const candidate: DealCandidate = {
    lenderId: lender.id,
    lenderName: lender.name,
    termMonths: term,
    apr,
    amountFinanced,
    payment,
    netCheckToDealer,
    dealerFrontGross,
    dealerBackEndGross,
    dealerProfit,
    totalDown,
    backendTotal: scenario.value,
    ltv: finalLtv,
    withinGuidelines: true,
    reasons: check.reasons,
    adjustments,
    includedProducts: {
      gap: scenario.gap,
      vsc: scenario.vsc,
    },
    optimizationReason: scenario.reason,
  };

  return { candidate, failReason: null };
}

export function runRehash(deal: DealInput, lenders: LenderConfig[] = LENDERS): RehashResult {
  const candidates: DealCandidate[] = [];
  const activeLenders = lenders.filter(l => l.active);

  // Calculate optimal backend structure based on vehicle/deal profile
  const optimalStructure = calculateOptimalBackendStructure(deal);

  activeLenders.forEach(lender => {
    // Check vehicle eligibility
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    // Get tier pricing
    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    const apr = pickApr(lender, deal.customerCreditTier);
    if (apr == null) return;

    // Generate prioritized backend scenarios
    const backendScenarios = generateBackendScenarios(
      optimalStructure,
      deal.backendProducts.otherProductsTotal,
      lender.maxBackendTotal
    );

    const terms = lender.allowedTerms;
    const downOptions = [deal.downPayment, deal.downPayment + 500, deal.downPayment + 1000];
    const paymentHighLimit = deal.targetPayment + deal.paymentTolerance;

    terms.forEach(term => {
      downOptions.forEach(down => {
        // Fallback Optimization Loop: Try scenarios in priority order
        let foundValidForThisConfig = false;

        for (const scenario of backendScenarios) {
          const result = testDealConfiguration(
            deal,
            lender,
            tierRow,
            apr,
            term,
            down,
            scenario,
            deal.targetPayment,
            deal.paymentTolerance
          );

          if (result.candidate) {
            // Check if payment is within tolerance for priority fallback logic
            const paymentWithinTolerance = result.candidate.payment <= paymentHighLimit;

            // If this is a higher priority scenario and payment exceeds tolerance,
            // update the reason and continue to try lower priority scenarios
            if (!paymentWithinTolerance && scenario.priority < 3) {
              // Add a modified candidate with updated reason explaining the fallback
              const modifiedCandidate = { ...result.candidate };
              if (scenario.gap && scenario.vsc) {
                modifiedCandidate.optimizationReason =
                  `Payment $${result.candidate.payment.toFixed(0)} exceeds target $${paymentHighLimit.toFixed(0)} - consider fallback option`;
              }
              candidates.push(modifiedCandidate);
            } else {
              candidates.push(result.candidate);
            }

            // For "best in class" tracking per term/down combo
            if (paymentWithinTolerance && !foundValidForThisConfig) {
              foundValidForThisConfig = true;
            }
          }
        }
      });
    });
  });

  // Sort candidates: prioritize within payment tolerance, then by net check, then by profit
  const targetLow = deal.targetPayment - deal.paymentTolerance;
  const targetHigh = deal.targetPayment + deal.paymentTolerance;
  const withinPayment = candidates.filter(c => c.payment >= targetLow && c.payment <= targetHigh);

  const pool = withinPayment.length > 0 ? withinPayment : candidates;

  const sorted = pool.sort((a, b) => {
    // First, prefer higher priority scenarios (lower priority number = better)
    const aPriority = getPriorityFromProducts(a.includedProducts);
    const bPriority = getPriorityFromProducts(b.includedProducts);

    // Among same priority, sort by net check (higher is better)
    if (aPriority !== bPriority) {
      // Within payment tolerance, prefer max products; otherwise prefer fundable deals
      if (withinPayment.length > 0) {
        return aPriority - bPriority;  // Lower priority number wins
      }
    }

    // Then by net check
    if (b.netCheckToDealer !== a.netCheckToDealer) {
      return b.netCheckToDealer - a.netCheckToDealer;
    }

    // Then by closeness to target payment
    const aGap = Math.abs(a.payment - deal.targetPayment);
    const bGap = Math.abs(b.payment - deal.targetPayment);
    return aGap - bGap;
  });

  const bestDeal = sorted.length > 0 ? sorted[0] : null;
  return { bestDeal, allCandidates: sorted };
}

/**
 * Get priority score from included products (lower = better)
 */
function getPriorityFromProducts(products: IncludedProducts): number {
  if (products.gap && products.vsc) return 1;  // Dream Deal
  if (products.gap || products.vsc) return 2;  // Save Deal
  return 3;  // Bare Bones
}
