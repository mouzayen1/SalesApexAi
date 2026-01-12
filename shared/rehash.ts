// shared/rehash.ts
import type { DealInput, DealCandidate, RiskAssessment, SmartProductRecommendation } from './deals';
import { LENDERS, LenderConfig } from './lenders';

// Product pricing constants
const GAP_PRICE = 900;
const VSC_PRICE = 1800;

// Warranty thresholds (factory warranty typically 3 years / 36,000 miles)
const WARRANTY_AGE_THRESHOLD = 3;
const WARRANTY_MILEAGE_THRESHOLD = 36000;

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
  riskAssessment: RiskAssessment;
}

/**
 * Assess vehicle and deal risk to determine product recommendations
 */
export function assessRisk(deal: DealInput): RiskAssessment {
  const currentYear = new Date().getFullYear();
  const vehicleAgeYears = currentYear - deal.vehicleYear;

  // Calculate preliminary LTV to determine if deal is upside down
  const taxableBase = deal.vehiclePrice;
  const tax = taxableBase * deal.taxRate;
  const baseAmountFinanced = taxableBase + tax + deal.fees;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  const preliminaryAmountFinanced = Math.max(baseAmountFinanced - totalDown, 0);
  const ltvPercent = deal.vehiclePrice > 0 ? (preliminaryAmountFinanced / deal.vehiclePrice) * 100 : 0;

  // Check if upside down (LTV > 100%)
  const isUpsideDown = ltvPercent > 100;

  // Check if out of factory warranty
  const isOverAge = vehicleAgeYears > WARRANTY_AGE_THRESHOLD;
  const isOverMileage = deal.vehicleMileage > WARRANTY_MILEAGE_THRESHOLD;
  const isOutOfWarranty = isOverAge || isOverMileage;

  let outOfWarrantyReason: 'age' | 'mileage' | 'both' | null = null;
  if (isOverAge && isOverMileage) {
    outOfWarrantyReason = 'both';
  } else if (isOverAge) {
    outOfWarrantyReason = 'age';
  } else if (isOverMileage) {
    outOfWarrantyReason = 'mileage';
  }

  return {
    isUpsideDown,
    ltvPercent,
    isOutOfWarranty,
    outOfWarrantyReason,
    vehicleAgeYears,
    vehicleMileage: deal.vehicleMileage,
    recommendGap: isUpsideDown,
    recommendVsc: isOutOfWarranty,
  };
}

/**
 * Generate smart note explaining product decisions
 */
function generateSmartNote(
  hasGap: boolean,
  hasVsc: boolean,
  riskAssessment: RiskAssessment,
  optimizationLevel: 'optimal' | 'vsc_stripped' | 'all_stripped'
): string {
  const notes: string[] = [];

  if (optimizationLevel === 'optimal') {
    if (hasGap && riskAssessment.isUpsideDown) {
      notes.push(`Added GAP due to high LTV (${riskAssessment.ltvPercent.toFixed(0)}%)`);
    }
    if (hasVsc && riskAssessment.isOutOfWarranty) {
      if (riskAssessment.outOfWarrantyReason === 'mileage') {
        notes.push(`Added VSC due to high mileage (${riskAssessment.vehicleMileage.toLocaleString()} mi)`);
      } else if (riskAssessment.outOfWarrantyReason === 'age') {
        notes.push(`Added VSC due to vehicle age (${riskAssessment.vehicleAgeYears} years old)`);
      } else if (riskAssessment.outOfWarrantyReason === 'both') {
        notes.push(`Added VSC - vehicle out of warranty (${riskAssessment.vehicleAgeYears}yr, ${riskAssessment.vehicleMileage.toLocaleString()}mi)`);
      }
    }
    if (hasGap && !riskAssessment.isUpsideDown) {
      notes.push('GAP included for maximum protection');
    }
    if (hasVsc && !riskAssessment.isOutOfWarranty) {
      notes.push('VSC included for extended coverage');
    }
  } else if (optimizationLevel === 'vsc_stripped') {
    notes.push('Removed VSC to meet payment target');
    if (hasGap) {
      notes.push('GAP retained for negative equity protection');
    }
  } else if (optimizationLevel === 'all_stripped') {
    notes.push('Products removed to meet lender/payment requirements');
  }

  if (notes.length === 0) {
    if (!hasGap && !hasVsc) {
      notes.push('No products - maximizing approval odds');
    } else {
      notes.push('Optimal product coverage included');
    }
  }

  return notes.join('. ');
}

interface BackendScenario {
  label: string;
  value: number;
  hasGap: boolean;
  hasVsc: boolean;
  optimizationLevel: 'optimal' | 'vsc_stripped' | 'all_stripped';
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

export function runRehash(deal: DealInput, lenders: LenderConfig[] = LENDERS): RehashResult {
  const candidates: DealCandidate[] = [];

  // Perform risk assessment
  const riskAssessment = assessRisk(deal);

  const activeLenders = lenders.filter(l => l.active);

  activeLenders.forEach(lender => {
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    const apr = pickApr(lender, deal.customerCreditTier);
    if (apr == null) return;

    const terms = lender.allowedTerms;

    // Smart backend scenarios based on risk assessment
    // Priority order: Optimal (GAP+VSC) → VSC Stripped (GAP only) → All Stripped
    const buildSmartScenarios = (): BackendScenario[] => {
      const scenarios: BackendScenario[] = [];
      const other = deal.backendProducts.otherProductsTotal;

      // Scenario 1: Optimal Coverage (risk-based GAP + VSC)
      const optimalGap = riskAssessment.recommendGap || deal.backendProducts.gap;
      const optimalVsc = riskAssessment.recommendVsc || deal.backendProducts.vsc;
      const optimalValue = Math.min(
        (optimalGap ? GAP_PRICE : 0) + (optimalVsc ? VSC_PRICE : 0) + other,
        lender.maxBackendTotal
      );
      scenarios.push({
        label: 'Optimal Coverage',
        value: optimalValue,
        hasGap: optimalGap,
        hasVsc: optimalVsc,
        optimizationLevel: 'optimal',
      });

      // Scenario 2: VSC Stripped (keep GAP if recommended, drop VSC)
      if (optimalVsc) {
        const vscStrippedValue = Math.min(
          (optimalGap ? GAP_PRICE : 0) + other,
          lender.maxBackendTotal
        );
        scenarios.push({
          label: 'GAP Only',
          value: vscStrippedValue,
          hasGap: optimalGap,
          hasVsc: false,
          optimizationLevel: 'vsc_stripped',
        });
      }

      // Scenario 3: All Products Stripped
      scenarios.push({
        label: 'No Products',
        value: other,
        hasGap: false,
        hasVsc: false,
        optimizationLevel: 'all_stripped',
      });

      return scenarios;
    };

    const backendScenarios = buildSmartScenarios();

    const downOptions = [deal.downPayment, deal.downPayment + 500, deal.downPayment + 1000];

    terms.forEach(term => {
      downOptions.forEach(down => {
        backendScenarios.forEach(scenario => {
          const modifiedDeal: DealInput = { ...deal, downPayment: down };
          const amountFinanced = computeAmountFinanced(modifiedDeal, scenario.value);

          if (
            amountFinanced < lender.minAmountFinanced ||
            amountFinanced > lender.maxAmountFinanced
          )
            return;

          const backendPct = amountFinanced > 0 ? (scenario.value / amountFinanced) * 100 : 999;
          if (backendPct > lender.maxBackendPercentOfAmount) return;

          const check = lender.validateDeal(modifiedDeal, amountFinanced);
          if (!check.isValid) return;

          const ltv =
            deal.vehiclePrice > 0 ? (amountFinanced / deal.vehiclePrice) * 100 : 999;
          if (ltv > tierRow.maxLtvPercent) return;

          const payment = calculateMonthlyPayment(amountFinanced, apr, term);

          const {
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            ltv: finalLtv,
          } = estimateNetCheckAndProfit(
            modifiedDeal,
            lender,
            tierRow,
            amountFinanced,
            scenario.value
          );

          const adjustments: string[] = [];
          adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);
          if (down !== deal.downPayment) {
            adjustments.push(
              `Increased down from $${deal.downPayment.toFixed(0)} to $${down.toFixed(0)}`
            );
          }

          // Smart product adjustments
          const productParts: string[] = [];
          if (scenario.hasGap) productParts.push('GAP');
          if (scenario.hasVsc) productParts.push('VSC');

          if (productParts.length > 0) {
            adjustments.push(`Products: ${productParts.join(' + ')} ($${scenario.value.toFixed(0)})`);
          } else {
            adjustments.push('No products - lean structure');
          }

          // Generate smart note
          const smartNote = generateSmartNote(
            scenario.hasGap,
            scenario.hasVsc,
            riskAssessment,
            scenario.optimizationLevel
          );

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
            // Smart Finance Manager fields
            hasGap: scenario.hasGap,
            hasVsc: scenario.hasVsc,
            smartNote,
            riskAssessment,
            optimizationLevel: scenario.optimizationLevel,
          };

          candidates.push(candidate);
        });
      });
    });
  });

  const targetLow = deal.targetPayment - deal.paymentTolerance;
  const targetHigh = deal.targetPayment + deal.paymentTolerance;
  const withinPayment = candidates.filter(c => c.payment >= targetLow && c.payment <= targetHigh);

  const pool = withinPayment.length > 0 ? withinPayment : candidates;

  const sorted = pool.sort((a, b) => {
    if (b.netCheckToDealer !== a.netCheckToDealer) {
      return b.netCheckToDealer - a.netCheckToDealer;
    }
    const aGap = Math.abs(a.payment - deal.targetPayment);
    const bGap = Math.abs(b.payment - deal.targetPayment);
    return aGap - bGap;
  });

  const bestDeal = sorted.length > 0 ? sorted[0] : null;
  return { bestDeal, allCandidates: sorted, riskAssessment };
}
