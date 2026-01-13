/**
 * Underwriting Calculation Engine
 *
 * This is the main entry point for the calculation engine.
 * It orchestrates all the calculation modules and produces results
 * that are backward compatible with the existing system.
 */

import { roundCents, round, toPercent, clamp, formatCurrency } from './money';
import { calculatePayment, calculatePaymentWithBreakdown } from './payment';
import { calculateLtv, computeLtv, checkLtvCap, isUpsideDown as checkUpsideDown } from './ltv';
import { estimateBookValue, getBookValueForLtv } from './bookValue';
import { loadLenderConfigs, getLenderTierConfig, checkVehicleEligibility, getVehicleRiskMultiplier } from './lenders/loader';
import type {
  UnderwritingInput,
  DealResult,
  RiskAssessment,
  EngineResult,
  EngineConfig,
  CalculationTrace,
  LenderSchema,
  CreditTier,
  VehicleInfo,
  BookValueInput,
} from './types';

// Engine version for tracking
const ENGINE_VERSION = '2.0.0';

// Product pricing constants
const GAP_PRICE = 900;
const VSC_PRICE = 1800;

// Warranty thresholds
const WARRANTY_AGE_THRESHOLD = 3;
const WARRANTY_MILEAGE_THRESHOLD = 36000;

// PTI limits by credit tier
const PTI_LIMITS: Record<CreditTier, number> = {
  deep_subprime: 0.25,
  subprime: 0.18,
  near_prime: 0.15,
  prime: 0.12,
};

/**
 * Assess vehicle and deal risk
 */
export function assessRisk(input: UnderwritingInput): RiskAssessment {
  const currentYear = new Date().getFullYear();
  const vehicleAgeYears = currentYear - input.vehicle.year;

  // Get book value for LTV calculation
  const bookValueData = getBookValueForLtv(input.vehicle, input.bookValue);
  const bookValue = bookValueData.adjustedValue || bookValueData.wholesaleValue;

  // Calculate preliminary amount financed
  const taxableBase = input.vehicle.retailPrice;
  const tax = roundCents(taxableBase * input.dealStructure.taxRate);
  const baseAmount = taxableBase + tax + input.dealStructure.fees;
  const totalDown = input.dealStructure.downPayment +
    input.dealStructure.tradeAllowance -
    input.dealStructure.tradePayoff;
  const preliminaryAmountFinanced = Math.max(baseAmount - totalDown, 0);

  // Calculate LTV using book value
  const ltvPercent = computeLtv(preliminaryAmountFinanced, bookValue);

  // Check if upside down (LTV > 100%)
  const isUpsideDown = ltvPercent > 100;

  // Check warranty status
  const isOverAge = vehicleAgeYears > WARRANTY_AGE_THRESHOLD;
  const isOverMileage = input.vehicle.mileage > WARRANTY_MILEAGE_THRESHOLD;
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
    vehicleMileage: input.vehicle.mileage,
    recommendGap: isUpsideDown,
    recommendVsc: isOutOfWarranty,
  };
}

/**
 * Compute amount financed with backend products
 */
function computeAmountFinanced(input: UnderwritingInput, backendTotal: number): number {
  const taxableBase = input.vehicle.retailPrice;
  const tax = roundCents(taxableBase * input.dealStructure.taxRate);
  const gross = taxableBase + tax + input.dealStructure.fees + backendTotal;
  const totalDown = input.dealStructure.downPayment +
    input.dealStructure.tradeAllowance -
    input.dealStructure.tradePayoff;
  return roundCents(Math.max(gross - totalDown, 0));
}

/**
 * Pick APR based on tier (use midpoint)
 */
function pickApr(lender: LenderSchema, creditTier: CreditTier): number | null {
  const tierConfig = getLenderTierConfig(lender, creditTier);
  if (!tierConfig) return null;
  return round((tierConfig.minApr + tierConfig.maxApr) / 2, 2);
}

/**
 * Estimate net check and profit
 */
function estimateNetCheckAndProfit(
  input: UnderwritingInput,
  lender: LenderSchema,
  tierConfig: {
    baseAdvancePercent: number;
    maxAdvancePercent: number;
    maxLtvPercent: number;
  },
  amountFinanced: number,
  backendTotal: number,
  advanceMultiplier: number,
  bookValue: number
): {
  netCheckToDealer: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  dealerProfit: number;
  totalDown: number;
  ltv: number;
} {
  // Calculate LTV using book value
  const ltv = computeLtv(amountFinanced, bookValue);

  // Apply advance multiplier to calculations
  const baseAdvance = roundCents(
    (tierConfig.baseAdvancePercent / 100) * input.vehicle.dealerCost * advanceMultiplier
  );
  const maxAdvanceByCost = roundCents(
    (tierConfig.maxAdvancePercent / 100) * input.vehicle.dealerCost * advanceMultiplier
  );
  const maxAdvanceByLtv = roundCents(
    (tierConfig.maxLtvPercent / 100) * bookValue * advanceMultiplier
  );

  // Gross advance is the minimum of the constraints
  const grossAdvance = Math.min(amountFinanced, maxAdvanceByCost, maxAdvanceByLtv);

  // Calculate lender fee
  const lenderFee = roundCents((lender.lenderFeePercent / 100) * amountFinanced);

  // Net check = gross advance - lender fee - trade payoff
  const netCheck = roundCents(
    Math.max(grossAdvance - lenderFee - input.dealStructure.tradePayoff, 0)
  );

  // Calculate totals
  const totalDown = roundCents(
    input.dealStructure.downPayment +
    input.dealStructure.tradeAllowance -
    input.dealStructure.tradePayoff
  );
  const frontGross = roundCents(input.vehicle.retailPrice - input.vehicle.dealerCost);
  const backGross = backendTotal;

  // Dealer profit calculation
  const dealerProfit = roundCents(
    netCheck + totalDown - input.vehicle.dealerCost - input.dealStructure.fees
  );

  return {
    netCheckToDealer: netCheck,
    dealerFrontGross: frontGross,
    dealerBackEndGross: backGross,
    dealerProfit,
    totalDown,
    ltv,
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
        notes.push(`Added VSC - vehicle out of warranty`);
      }
    }
  } else if (optimizationLevel === 'vsc_stripped') {
    notes.push('Removed VSC to meet payment target');
    if (hasGap) notes.push('GAP retained for negative equity protection');
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

/**
 * Backend scenario configuration
 */
interface BackendScenario {
  label: string;
  value: number;
  hasGap: boolean;
  hasVsc: boolean;
  optimizationLevel: 'optimal' | 'vsc_stripped' | 'all_stripped';
}

/**
 * Build smart backend scenarios based on risk assessment
 */
function buildBackendScenarios(
  input: UnderwritingInput,
  riskAssessment: RiskAssessment,
  maxBackendTotal: number
): BackendScenario[] {
  const scenarios: BackendScenario[] = [];
  const { gap, vsc, otherTotal } = input.dealStructure.backendProducts;

  // Scenario 1: Optimal (risk-based GAP + VSC)
  const optimalGap = riskAssessment.recommendGap || gap;
  const optimalVsc = riskAssessment.recommendVsc || vsc;
  const optimalValue = Math.min(
    (optimalGap ? GAP_PRICE : 0) + (optimalVsc ? VSC_PRICE : 0) + otherTotal,
    maxBackendTotal
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
      (optimalGap ? GAP_PRICE : 0) + otherTotal,
      maxBackendTotal
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
    value: otherTotal,
    hasGap: false,
    hasVsc: false,
    optimizationLevel: 'all_stripped',
  });

  return scenarios;
}

/**
 * Main engine entry point
 */
export function runEngine(
  input: UnderwritingInput,
  config: EngineConfig = {}
): EngineResult {
  const { enableTracing = false, allowUnreviewedConfigs = false, scoringVersion = 'v1' } = config;

  // Load lender configurations
  const lenders = loadLenderConfigs({ includeUnreviewed: allowUnreviewedConfigs });

  // Perform risk assessment
  const riskAssessment = assessRisk(input);

  // Get book value for LTV calculations
  const bookValueData = getBookValueForLtv(input.vehicle, input.bookValue);
  const bookValue = bookValueData.adjustedValue || bookValueData.wholesaleValue;

  const candidates: DealResult[] = [];

  for (const lender of lenders) {
    if (!lender.active) continue;

    // Check vehicle eligibility
    const eligibility = checkVehicleEligibility(
      lender,
      input.vehicle.make,
      input.vehicle.model || '',
      input.vehicle.year,
      input.vehicle.mileage
    );

    if (!eligibility.eligible) continue;

    // Get tier configuration
    const tierConfig = getLenderTierConfig(lender, input.customer.creditTier);
    if (!tierConfig) continue;

    // Get APR
    const apr = pickApr(lender, input.customer.creditTier);
    if (apr == null) continue;

    // Build backend scenarios
    const backendScenarios = buildBackendScenarios(
      input,
      riskAssessment,
      lender.maxBackendTotal
    );

    // Down payment options
    const downOptions = [
      input.dealStructure.downPayment,
      input.dealStructure.downPayment + 500,
      input.dealStructure.downPayment + 1000,
    ];

    // Iterate through all combinations
    for (const term of lender.allowedTerms) {
      for (const down of downOptions) {
        for (const scenario of backendScenarios) {
          // Create modified input with new down payment
          const modifiedInput: UnderwritingInput = {
            ...input,
            dealStructure: { ...input.dealStructure, downPayment: down },
          };

          // Calculate amount financed
          const amountFinanced = computeAmountFinanced(modifiedInput, scenario.value);

          // Check amount financed limits
          if (amountFinanced < lender.minAmountFinanced ||
              amountFinanced > lender.maxAmountFinanced) {
            continue;
          }

          // Check backend percentage
          const backendPct = amountFinanced > 0 ? (scenario.value / amountFinanced) * 100 : 999;
          if (backendPct > lender.maxBackendPercent) continue;

          // Check LTV using book value
          const ltv = computeLtv(amountFinanced, bookValue);
          if (ltv > tierConfig.maxLtvPercent) continue;

          // Check minimum down payment
          const minDownRequired = roundCents(input.vehicle.retailPrice * tierConfig.minDownPercent / 100);
          if (down < minDownRequired) continue;

          // Custom rule validation (e.g., UAC's $500 minimum)
          let customRulesFailed = false;
          const customReasons: string[] = [];
          if (lender.customRules) {
            for (const rule of lender.customRules) {
              if (rule.condition === 'min_down_amount' && down < rule.value) {
                customRulesFailed = true;
                customReasons.push(rule.description);
              }
            }
          }
          if (customRulesFailed) continue;

          // Calculate payment
          const payment = calculatePayment(amountFinanced, apr, term);

          // Calculate net check and profit
          const {
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            ltv: finalLtv,
          } = estimateNetCheckAndProfit(
            modifiedInput,
            lender,
            tierConfig,
            amountFinanced,
            scenario.value,
            eligibility.riskMultiplier,
            bookValue
          );

          // Build adjustments list
          const adjustments: string[] = [];
          adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);

          if (down !== input.dealStructure.downPayment) {
            adjustments.push(`Increased down from $${input.dealStructure.downPayment.toFixed(0)} to $${down.toFixed(0)}`);
          }

          // Product adjustments
          const productParts: string[] = [];
          if (scenario.hasGap) productParts.push('GAP');
          if (scenario.hasVsc) productParts.push('VSC');
          if (productParts.length > 0) {
            adjustments.push(`Products: ${productParts.join(' + ')} ($${scenario.value.toFixed(0)})`);
          } else {
            adjustments.push('No products - lean structure');
          }

          // Vehicle risk adjustment
          if (eligibility.riskMultiplier !== 1.0) {
            if (eligibility.riskMultiplier < 1.0) {
              const penalty = round((1 - eligibility.riskMultiplier) * 100, 0);
              adjustments.push(`Advance reduced by ${penalty}% (vehicle risk)`);
            } else {
              const bonus = round((eligibility.riskMultiplier - 1) * 100, 0);
              adjustments.push(`Advance increased by ${bonus}% (preferred vehicle)`);
            }
          }

          // Generate smart note
          let smartNote = generateSmartNote(
            scenario.hasGap,
            scenario.hasVsc,
            riskAssessment,
            scenario.optimizationLevel
          );

          // Add vehicle risk reason
          if (eligibility.riskReason) {
            smartNote += `. ${eligibility.riskReason}`;
          }

          // Calculate PTI
          const ptiLimit = PTI_LIMITS[input.customer.creditTier];
          const requiredIncome = Math.ceil(payment / ptiLimit);
          let ptiPercent: number | null = null;
          let ptiWarning: string | null = null;
          let ptiExceedsLimit = false;

          if (input.customer.monthlyIncome && input.customer.monthlyIncome > 0) {
            const pti = payment / input.customer.monthlyIncome;
            ptiPercent = round(pti * 100, 1);
            ptiExceedsLimit = pti > ptiLimit;

            if (ptiExceedsLimit) {
              const limitPercent = round(ptiLimit * 100, 0);
              ptiWarning = `High PTI (${ptiPercent.toFixed(0)}%). Max ${limitPercent}% for ${input.customer.creditTier.replace('_', ' ')}. Requires income of $${requiredIncome.toLocaleString()}+`;
              adjustments.push(ptiWarning);
            }
          }

          // Build trace if enabled
          let trace: CalculationTrace | undefined;
          if (enableTracing) {
            trace = {
              timestamp: new Date().toISOString(),
              lenderId: lender.id,
              retailPrice: input.vehicle.retailPrice,
              bookValueUsed: bookValue,
              bookValueSource: bookValueData.source,
              taxableAmount: input.vehicle.retailPrice,
              taxAmount: roundCents(input.vehicle.retailPrice * input.dealStructure.taxRate),
              grossCapCost: roundCents(
                input.vehicle.retailPrice +
                input.vehicle.retailPrice * input.dealStructure.taxRate +
                input.dealStructure.fees +
                scenario.value
              ),
              netCapCost: amountFinanced,
              amountFinanced,
              computedLtv: finalLtv,
              lenderLtvCap: tierConfig.maxLtvPercent,
              ltvPassed: finalLtv <= tierConfig.maxLtvPercent,
              baseAdvance: roundCents((tierConfig.baseAdvancePercent / 100) * input.vehicle.dealerCost),
              maxAdvanceByCost: roundCents((tierConfig.maxAdvancePercent / 100) * input.vehicle.dealerCost),
              maxAdvanceByLtv: roundCents((tierConfig.maxLtvPercent / 100) * bookValue),
              grossAdvance: roundCents(Math.min(
                amountFinanced,
                (tierConfig.maxAdvancePercent / 100) * input.vehicle.dealerCost,
                (tierConfig.maxLtvPercent / 100) * bookValue
              )),
              lenderFee: roundCents((lender.lenderFeePercent / 100) * amountFinanced),
              netAdvance: netCheckToDealer,
              vehicleMultiplier: eligibility.riskMultiplier,
              vehicleMultiplierReason: eligibility.riskReason,
              payment,
              netCheckToDealer,
            };
          }

          // Build candidate
          const candidate: DealResult = {
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
            reasons: [],
            adjustments,
            hasGap: scenario.hasGap,
            hasVsc: scenario.hasVsc,
            smartNote,
            optimizationLevel: scenario.optimizationLevel,
            vehicleWarnings: eligibility.riskReason ? [eligibility.riskReason] : [],
            advanceMultiplier: eligibility.riskMultiplier,
            ptiPercent,
            ptiWarning,
            ptiExceedsLimit,
            requiredIncome,
            trace,
          };

          candidates.push(candidate);
        }
      }
    }
  }

  // Filter by payment target if specified
  let pool = candidates;
  if (input.targetPayment && input.paymentTolerance !== undefined) {
    const targetLow = input.targetPayment - input.paymentTolerance;
    const targetHigh = input.targetPayment + input.paymentTolerance;
    const withinPayment = candidates.filter(c =>
      c.payment >= targetLow && c.payment <= targetHigh
    );
    if (withinPayment.length > 0) {
      pool = withinPayment;
    }
  }

  // Sort candidates
  const sorted = pool.sort((a, b) => {
    if (scoringVersion === 'v2') {
      // V2 scoring: weighted combination
      const scoreA = a.netCheckToDealer * 0.7 + (a.ptiExceedsLimit ? 0 : 100) * 0.3;
      const scoreB = b.netCheckToDealer * 0.7 + (b.ptiExceedsLimit ? 0 : 100) * 0.3;
      return scoreB - scoreA;
    }

    // V1 scoring: netCheck primary, payment gap secondary
    if (b.netCheckToDealer !== a.netCheckToDealer) {
      return b.netCheckToDealer - a.netCheckToDealer;
    }
    if (input.targetPayment) {
      const aGap = Math.abs(a.payment - input.targetPayment);
      const bGap = Math.abs(b.payment - input.targetPayment);
      return aGap - bGap;
    }
    return 0;
  });

  const bestDeal = sorted.length > 0 ? sorted[0] : null;

  return {
    bestDeal,
    allCandidates: sorted,
    riskAssessment,
    engineVersion: ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Export for backward compatibility with existing code
 */
export { calculatePayment, computeLtv, estimateBookValue };
