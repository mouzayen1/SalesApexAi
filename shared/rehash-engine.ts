// shared/rehash-engine.ts
// Deterministic core math for dealer-grade rehash calculations
// All formulas are auditable and produce consistent outputs

import type {
  VehicleInput,
  CustomerInput,
  DealInput,
  BookValueResult,
  AmountFinancedBreakdown,
  APRCalculation,
  PaymentCalculation,
  LenderEvaluation,
  DealerProfitBreakdown,
  RuleHit,
} from './rehash-types';

import {
  StateConfig,
  LenderProgram,
  FicoTier,
  getStateConfig,
  getAgeFactor,
  getMileageUtilization,
  getMakeMultiplier,
  getSeasonalMultiplier,
  getFicoTier,
  GAP_PRICING,
  VSC_PRICING,
} from './lender-programs';

import {
  checkEligibility,
  getPreferenceMultiplier,
  validateDealStructure,
} from './rules-engine';

// ============================================================================
// BOOK VALUE CALCULATION
// ============================================================================

/**
 * Calculate the estimated book value of a vehicle
 * Formula: BaseValue × AgeFactor × MileageUtilization × MakeMultiplier × SeasonalMultiplier
 */
export function calculateBookValue(vehicle: VehicleInput): BookValueResult {
  const calculationSteps: string[] = [];

  // Start with retail price as base
  const baseValue = vehicle.retailPrice;
  calculationSteps.push(`Base value (retail price): $${baseValue.toLocaleString()}`);

  // Apply age factor
  const ageFactor = getAgeFactor(vehicle.year);
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;
  calculationSteps.push(`Age factor (${vehicleAge} years): ${ageFactor.toFixed(2)}`);

  // Apply mileage utilization
  const mileageUtilization = getMileageUtilization(vehicle.mileage);
  calculationSteps.push(`Mileage utilization (${vehicle.mileage.toLocaleString()} mi): ${mileageUtilization.toFixed(2)}`);

  // Apply make multiplier
  const makeMultiplier = getMakeMultiplier(vehicle.make);
  calculationSteps.push(`Make multiplier (${vehicle.make}): ${makeMultiplier.toFixed(2)}`);

  // Apply seasonal multiplier
  const seasonalMultiplier = getSeasonalMultiplier();
  calculationSteps.push(`Seasonal multiplier: ${seasonalMultiplier.toFixed(2)}`);

  // Calculate final book value
  const finalBookValue = Math.round(
    baseValue * ageFactor * mileageUtilization * makeMultiplier * seasonalMultiplier
  );
  calculationSteps.push(`Final book value: $${finalBookValue.toLocaleString()}`);

  return {
    baseValue,
    ageFactor,
    mileageUtilization,
    makeMultiplier,
    seasonalMultiplier,
    finalBookValue,
    calculationSteps,
  };
}

// ============================================================================
// AMOUNT FINANCED CALCULATION
// ============================================================================

/**
 * Calculate itemized amount financed with all components
 */
export function calculateAmountFinanced(
  deal: DealInput,
  stateConfig: StateConfig
): AmountFinancedBreakdown {
  const retailPrice = deal.vehicle.retailPrice;

  // Calculate sales tax
  const salesTax = Math.round(retailPrice * stateConfig.salesTaxRate);

  // Fees
  const docFee = Math.min(stateConfig.docFeeCap, 499); // Use reasonable default
  const registrationFee = stateConfig.registrationFee;
  const deliveryFee = stateConfig.deliveryFee;

  // Product costs (retail prices to customer)
  let gapCost = 0;
  let vscCost = 0;
  let otherProducts = 0;

  if (deal.products.gap) {
    const tier = deal.products.gapTier || 'standard';
    gapCost = GAP_PRICING[tier]?.retailPrice || 900;
  }

  if (deal.products.vsc) {
    const tier = deal.products.vscTier || 'standard';
    vscCost = VSC_PRICING[tier]?.retailPrice || 1800;
  }

  otherProducts = deal.products.otherProductsTotal || 0;

  // Acquisition fee (lender-specific, included in financing)
  const acquisitionFee = 0; // Added later per lender

  // Calculate gross amount
  const grossAmount = retailPrice + salesTax + docFee + registrationFee +
                      deliveryFee + gapCost + vscCost + otherProducts + acquisitionFee;

  // Trade equity
  const tradeEquity = deal.trade ? deal.trade.allowance - deal.trade.payoff : 0;

  // Total down (cash down + positive trade equity)
  const totalDown = deal.downPayment + Math.max(0, tradeEquity);

  // If trade is underwater, add negative equity to amount financed
  const negativeEquity = tradeEquity < 0 ? Math.abs(tradeEquity) : 0;

  // Final amount financed
  const amountFinanced = Math.max(0, grossAmount - totalDown + negativeEquity);

  return {
    retailPrice,
    salesTax,
    docFee,
    registrationFee,
    deliveryFee,
    gapCost,
    vscCost,
    otherProducts,
    acquisitionFee,
    grossAmount,
    tradeEquity,
    totalDown,
    amountFinanced,
  };
}

// ============================================================================
// APR CALCULATION
// ============================================================================

/**
 * Calculate dynamic APR based on FICO, LTV, and lender pricing
 */
export function calculateDynamicAPR(
  ficoTier: FicoTier,
  fico: number,
  ltv: number,
  downPercent: number,
  stateConfig: StateConfig
): APRCalculation {
  const calculationSteps: string[] = [];

  // Start with base tier rate
  const baseTierRate = ficoTier.baseAPR;
  calculationSteps.push(`Base tier rate (${ficoTier.name}): ${baseTierRate.toFixed(2)}%`);

  // FICO adjustment within tier (interpolate)
  const ficoMidpoint = (ficoTier.minFico + ficoTier.maxFico) / 2;
  const ficoAdjustment = (ficoMidpoint - fico) * 0.02; // 0.02% per point from midpoint
  calculationSteps.push(`FICO adjustment (score ${fico}): ${ficoAdjustment.toFixed(2)}%`);

  // LTV adjustment
  let ltvAdjustment = 0;
  if (ltv > 120) {
    ltvAdjustment = (ltv - 120) * 0.05; // 0.05% per point over 120%
    calculationSteps.push(`LTV adjustment (${ltv.toFixed(0)}% > 120%): +${ltvAdjustment.toFixed(2)}%`);
  } else if (ltv < 80) {
    ltvAdjustment = -(80 - ltv) * 0.02; // Discount for low LTV
    calculationSteps.push(`LTV adjustment (${ltv.toFixed(0)}% < 80%): ${ltvAdjustment.toFixed(2)}%`);
  } else {
    calculationSteps.push(`LTV adjustment (${ltv.toFixed(0)}%): 0.00%`);
  }

  // Down payment adjustment
  let downPaymentAdjustment = 0;
  if (downPercent >= 20) {
    downPaymentAdjustment = -0.5; // Discount for 20%+ down
    calculationSteps.push(`Down payment adjustment (${downPercent.toFixed(0)}% >= 20%): -0.50%`);
  } else if (downPercent < 10) {
    downPaymentAdjustment = 0.25; // Premium for low down
    calculationSteps.push(`Down payment adjustment (${downPercent.toFixed(0)}% < 10%): +0.25%`);
  } else {
    calculationSteps.push(`Down payment adjustment (${downPercent.toFixed(0)}%): 0.00%`);
  }

  // Lender adjustment (placeholder for lender-specific markups)
  const lenderAdjustment = 0;

  // Risk adjustment (aggregate of adjustments)
  const riskAdjustment = ficoAdjustment + ltvAdjustment + downPaymentAdjustment;

  // Calculate raw APR
  const rawAPR = baseTierRate + riskAdjustment + lenderAdjustment;
  calculationSteps.push(`Raw APR: ${rawAPR.toFixed(2)}%`);

  // Apply state cap
  const stateCapAPR = stateConfig.aprCap;
  const finalAPR = Math.min(rawAPR, stateCapAPR);
  calculationSteps.push(`State cap (${stateConfig.code}): ${stateCapAPR.toFixed(2)}%`);
  calculationSteps.push(`Final APR: ${finalAPR.toFixed(2)}%`);

  return {
    baseTierRate,
    ficoAdjustment,
    ltvAdjustment,
    downPaymentAdjustment,
    lenderAdjustment,
    riskAdjustment,
    rawAPR,
    stateCapAPR,
    finalAPR: Math.max(0, finalAPR),
    calculationSteps,
  };
}

// ============================================================================
// PAYMENT CALCULATION
// ============================================================================

/**
 * Calculate monthly payment using standard amortization formula
 * Formula: P = [r * A] / [1 - (1 + r)^-n]
 * Where: P = payment, r = monthly rate, A = amount, n = months
 */
export function calculatePayment(
  amountFinanced: number,
  apr: number,
  termMonths: number
): PaymentCalculation {
  const monthlyRate = apr / 100 / 12;

  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = amountFinanced / termMonths;
  } else {
    monthlyPayment =
      (monthlyRate * amountFinanced) /
      (1 - Math.pow(1 + monthlyRate, -termMonths));
  }

  monthlyPayment = Math.round(monthlyPayment * 100) / 100;

  const totalOfPayments = monthlyPayment * termMonths;
  const totalInterest = totalOfPayments - amountFinanced;

  return {
    amountFinanced,
    apr,
    termMonths,
    monthlyPayment,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalOfPayments: Math.round(totalOfPayments * 100) / 100,
  };
}

// ============================================================================
// DEALER PROFIT CALCULATION
// ============================================================================

/**
 * Calculate dealer profit breakdown
 */
export function calculateDealerProfit(
  deal: DealInput,
  amountFinancedBreakdown: AmountFinancedBreakdown,
  netAdvance: number,
  apr: number,
  ficoTierAPR: number
): DealerProfitBreakdown {
  // Front gross = selling price - cost
  const frontGross = deal.vehicle.retailPrice - deal.vehicle.dealerCost;

  // Back end gross = product profit (retail - cost)
  let backEndGross = 0;
  if (deal.products.gap) {
    const tier = deal.products.gapTier || 'standard';
    const pricing = GAP_PRICING[tier];
    if (pricing) {
      backEndGross += pricing.commission;
    }
  }
  if (deal.products.vsc) {
    const tier = deal.products.vscTier || 'standard';
    const pricing = VSC_PRICING[tier];
    if (pricing) {
      backEndGross += pricing.commission;
    }
  }

  // Reserve income (rate markup)
  // Simplified: assume dealer can keep portion of rate spread
  const rateSpread = Math.max(0, apr - ficoTierAPR);
  const reserveIncome = Math.round(
    (rateSpread / 100) * amountFinancedBreakdown.amountFinanced * 0.5
  );

  const totalGross = frontGross + backEndGross + reserveIncome;

  // Pack deduction (typical dealer pack)
  const packDeduction = 500;

  const netProfit = totalGross - packDeduction;

  return {
    frontGross,
    backEndGross,
    reserveIncome,
    totalGross,
    packDeduction,
    netProfit,
  };
}

// ============================================================================
// NET ADVANCE CALCULATION
// ============================================================================

/**
 * Calculate net advance (net check to dealer) from lender
 */
export function calculateNetAdvance(
  program: LenderProgram,
  ficoTier: FicoTier,
  amountFinanced: number,
  vehicleCost: number,
  vehicleValue: number,
  preferenceFactor: number
): {
  grossAdvance: number;
  lenderFees: number;
  netAdvance: number;
  advancePercent: number;
} {
  // Apply preference factor to advance percentages
  const adjustedBaseAdvance = ficoTier.baseAdvancePercent * preferenceFactor;
  const adjustedMaxAdvance = ficoTier.maxAdvancePercent * preferenceFactor;

  // Calculate advance based on vehicle cost
  const advanceByCost = (adjustedMaxAdvance / 100) * vehicleCost;

  // Cap by LTV on vehicle value
  const advanceByLTV = (ficoTier.maxLTV / 100) * vehicleValue;

  // Gross advance is the minimum of these caps and amount financed
  const grossAdvance = Math.min(amountFinanced, advanceByCost, advanceByLTV);

  // Calculate lender fees
  const lenderFeePercent = program.lenderFeePercent / 100;
  const lenderFees = Math.round(grossAdvance * lenderFeePercent) + program.acquisitionFee;

  // Net advance
  const netAdvance = Math.max(0, grossAdvance - lenderFees);

  // Effective advance percent
  const advancePercent = vehicleCost > 0 ? (netAdvance / vehicleCost) * 100 : 0;

  return {
    grossAdvance: Math.round(grossAdvance),
    lenderFees: Math.round(lenderFees),
    netAdvance: Math.round(netAdvance),
    advancePercent: Math.round(advancePercent * 100) / 100,
  };
}

// ============================================================================
// COMPUTE LENDER DEAL - Full evaluation for one lender
// ============================================================================

/**
 * Compute a complete lender evaluation with all calculations
 */
export function computeLenderDeal(
  deal: DealInput,
  programId: string,
  termMonths: number
): LenderEvaluation | null {
  const { checkEligibility, getPreferenceMultiplier } = require('./rules-engine');
  const { ALL_LENDER_PROGRAMS, getFicoTier, getStateConfig } = require('./lender-programs');

  const program = ALL_LENDER_PROGRAMS.find((p: LenderProgram) => p.id === programId);
  if (!program) return null;

  // Get state config
  const stateConfig = getStateConfig(deal.state);

  // Check eligibility
  const eligibility = checkEligibility(
    programId,
    deal.vehicle,
    deal.customer
  );

  if (!eligibility.eligible) {
    return {
      lenderId: program.lenderId,
      lenderName: program.name,
      program: programId,
      eligible: false,
      ruleHits: eligibility.ruleHits,
      rejectionReasons: eligibility.rejectionReasons,
    };
  }

  const ficoTier = eligibility.ficoTier;
  if (!ficoTier) {
    return {
      lenderId: program.lenderId,
      lenderName: program.name,
      program: programId,
      eligible: false,
      ruleHits: [],
      rejectionReasons: ['No FICO tier found'],
    };
  }

  // Get preference multiplier
  const preference = getPreferenceMultiplier(programId, deal.vehicle);

  // Calculate book value
  const bookValueResult = calculateBookValue(deal.vehicle);

  // Calculate amount financed
  const amountFinancedBreakdown = calculateAmountFinanced(deal, stateConfig);
  const amountFinanced = amountFinancedBreakdown.amountFinanced;

  // Calculate LTV
  const bookValue = bookValueResult.finalBookValue;
  const ltv = bookValue > 0 ? (amountFinanced / bookValue) * 100 : 999;

  // Calculate down payment percentage
  const downPercent = deal.vehicle.retailPrice > 0
    ? (deal.downPayment / deal.vehicle.retailPrice) * 100
    : 0;

  // Calculate dynamic APR
  const aprCalc = calculateDynamicAPR(
    ficoTier,
    deal.customer.fico,
    ltv,
    downPercent,
    stateConfig
  );

  // Calculate payment
  const paymentCalc = calculatePayment(amountFinanced, aprCalc.finalAPR, termMonths);

  // Calculate PTI
  const pti = deal.customer.monthlyGrossIncome > 0
    ? (paymentCalc.monthlyPayment / deal.customer.monthlyGrossIncome) * 100
    : 0;

  // Calculate DTI
  const monthlyDebt = deal.customer.monthlyDebtPayments || 0;
  const dti = deal.customer.monthlyGrossIncome > 0
    ? ((monthlyDebt + paymentCalc.monthlyPayment) / deal.customer.monthlyGrossIncome) * 100
    : 0;

  // Calculate net advance
  const advanceCalc = calculateNetAdvance(
    program,
    ficoTier,
    amountFinanced,
    deal.vehicle.dealerCost,
    bookValue,
    preference.factor
  );

  // Calculate dealer profit
  const profitCalc = calculateDealerProfit(
    deal,
    amountFinancedBreakdown,
    advanceCalc.netAdvance,
    aprCalc.finalAPR,
    ficoTier.baseAPR
  );

  // Validate deal structure
  const backendTotal = amountFinancedBreakdown.gapCost +
                       amountFinancedBreakdown.vscCost +
                       amountFinancedBreakdown.otherProducts;

  const validation = validateDealStructure(
    programId,
    amountFinanced,
    bookValue,
    paymentCalc.monthlyPayment,
    deal.customer.monthlyGrossIncome,
    deal.customer.monthlyDebtPayments || 0,
    backendTotal,
    termMonths
  );

  // Combine all rule hits
  const allRuleHits: RuleHit[] = [
    ...eligibility.ruleHits,
    ...preference.ruleHits,
    ...validation.ruleHits,
  ];

  return {
    lenderId: program.lenderId,
    lenderName: program.name,
    program: programId,
    eligible: validation.isValid,
    ruleHits: allRuleHits,

    // Calculated values
    bookValue,
    ltv: Math.round(ltv * 100) / 100,
    pti: Math.round(pti * 100) / 100,
    dti: Math.round(dti * 100) / 100,

    // Advance calculation
    baseAdvancePercent: ficoTier.baseAdvancePercent,
    adjustedAdvancePercent: advanceCalc.advancePercent,
    grossAdvance: advanceCalc.grossAdvance,
    lenderFees: advanceCalc.lenderFees,
    netAdvance: advanceCalc.netAdvance,

    // Final deal metrics
    apr: aprCalc.finalAPR,
    termMonths,
    payment: paymentCalc.monthlyPayment,
    netCheckToDealer: advanceCalc.netAdvance + amountFinancedBreakdown.totalDown - deal.vehicle.dealerCost,
    dealerProfit: profitCalc.netProfit,

    // Rejection reasons (if any)
    rejectionReasons: validation.warnings.length > 0 ? validation.warnings : undefined,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round to nearest dollar
 */
export function roundDollar(value: number): number {
  return Math.round(value);
}

/**
 * Round to nearest cent
 */
export function roundCent(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate trade equity
 */
export function calculateTradeEquity(
  allowance: number,
  payoff: number
): { equity: number; isNegative: boolean } {
  const equity = allowance - payoff;
  return {
    equity,
    isNegative: equity < 0,
  };
}

/**
 * Calculate effective rate (includes fees as APR equivalent)
 */
export function calculateEffectiveRate(
  amountFinanced: number,
  fees: number,
  apr: number,
  termMonths: number
): number {
  const totalAmount = amountFinanced + fees;
  const monthlyRate = apr / 100 / 12;

  // Calculate what APR would produce the same payment on total amount
  const payment = (monthlyRate * amountFinanced) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  const effectivePayment = payment;

  // Iteratively find effective rate (Newton-Raphson)
  let effRate = apr;
  for (let i = 0; i < 20; i++) {
    const r = effRate / 100 / 12;
    const calcPayment = (r * totalAmount) / (1 - Math.pow(1 + r, -termMonths));
    const diff = calcPayment - effectivePayment;
    if (Math.abs(diff) < 0.01) break;
    effRate -= diff * 0.1;
  }

  return Math.round(effRate * 100) / 100;
}
