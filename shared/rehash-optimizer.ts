// shared/rehash-optimizer.ts
// Beam search optimizer for auto-restructuring deals to maximize approval/profit

import type {
  DealInput,
  CandidateDeal,
  RehashResult,
  RehashAction,
  RehashActionType,
  RuleHit,
  LenderEvaluation,
  AmountFinancedBreakdown,
  PaymentCalculation,
  DealerProfitBreakdown,
} from './rehash-types';

import {
  ALL_LENDER_PROGRAMS,
  LenderProgram,
  getFicoTier,
  getStateConfig,
  GAP_PRICING,
  VSC_PRICING,
} from './lender-programs';

import {
  checkEligibility,
  getPreferenceMultiplier,
  validateDealStructure,
  getApplicablePrograms,
} from './rules-engine';

import {
  calculateBookValue,
  calculateAmountFinanced,
  calculateDynamicAPR,
  calculatePayment,
  calculateDealerProfit,
  calculateNetAdvance,
} from './rehash-engine';

// ============================================================================
// OPTIMIZER CONFIGURATION
// ============================================================================

export interface OptimizerConfig {
  // Beam search parameters
  beamWidth: number;           // Number of candidates to keep per iteration (default: 10)
  maxIterations: number;       // Maximum restructuring iterations (default: 100)

  // Scoring weights
  profitWeight: number;        // Weight for dealer profit (default: 0.4)
  paymentWeight: number;       // Weight for payment proximity to target (default: 0.3)
  approvalWeight: number;      // Weight for approval probability (default: 0.3)

  // Search constraints
  maxDownIncrease: number;     // Max down payment increase to try (default: 5000)
  downIncrements: number;      // Down payment increment steps (default: 500)
  allowPriceReduction: boolean; // Allow reducing vehicle price (default: false)
  maxPriceReduction: number;   // Max price reduction (default: 2000)
}

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  beamWidth: 10,
  maxIterations: 100,
  profitWeight: 0.4,
  paymentWeight: 0.3,
  approvalWeight: 0.3,
  maxDownIncrease: 5000,
  downIncrements: 500,
  allowPriceReduction: false,
  maxPriceReduction: 2000,
};

// ============================================================================
// CANDIDATE DEAL BUILDER
// ============================================================================

interface DealVariant {
  deal: DealInput;
  actions: RehashAction[];
}

/**
 * Build a candidate deal from a deal variant and lender evaluation
 */
function buildCandidateDeal(
  variant: DealVariant,
  lenderEval: LenderEvaluation,
  amountFinanced: AmountFinancedBreakdown,
  paymentCalc: PaymentCalculation,
  profitCalc: DealerProfitBreakdown,
  targetPayment: number,
  paymentTolerance: number
): CandidateDeal | null {
  if (!lenderEval.eligible) return null;

  // Calculate approval probability (0.0 - 1.0)
  let approvalProbability = 0.7; // Base probability

  // Adjust based on LTV
  if (lenderEval.ltv && lenderEval.ltv > 140) {
    approvalProbability -= 0.3;
  } else if (lenderEval.ltv && lenderEval.ltv > 120) {
    approvalProbability -= 0.15;
  } else if (lenderEval.ltv && lenderEval.ltv < 100) {
    approvalProbability += 0.1;
  }

  // Adjust based on PTI
  if (lenderEval.pti && lenderEval.pti > 20) {
    approvalProbability -= 0.2;
  } else if (lenderEval.pti && lenderEval.pti < 15) {
    approvalProbability += 0.05;
  }

  // Adjust based on rule hits
  const negativeHits = lenderEval.ruleHits.filter(h =>
    h.code === 'HIGH_THEFT_RISK' ||
    h.code === 'MODEL_RISK' ||
    h.code === 'AGE_RISK' ||
    h.code === 'MILEAGE_RISK'
  ).length;
  approvalProbability -= negativeHits * 0.05;

  const bonusHits = lenderEval.ruleHits.filter(h =>
    h.code === 'BONUS_RELIABILITY' ||
    h.code === 'BONUS_LOW_MILES' ||
    h.code === 'BONUS_RECENT_MODEL'
  ).length;
  approvalProbability += bonusHits * 0.03;

  approvalProbability = Math.max(0.1, Math.min(0.95, approvalProbability));

  // Calculate score
  const paymentGap = Math.abs(paymentCalc.monthlyPayment - targetPayment);
  const paymentScore = Math.max(0, 1 - paymentGap / paymentTolerance);

  const profitScore = Math.min(1, Math.max(0, profitCalc.netProfit / 5000));

  const score = paymentScore * 0.3 + profitScore * 0.4 + approvalProbability * 0.3;

  // Determine confidence level
  const approvalConfidence: 'high' | 'medium' | 'low' =
    approvalProbability >= 0.7 ? 'high' :
    approvalProbability >= 0.5 ? 'medium' : 'low';

  return {
    lender: lenderEval,
    amountFinanced,
    payment: paymentCalc,
    profit: profitCalc,
    score,
    actionsFromOriginal: variant.actions,
    ruleHits: lenderEval.ruleHits,
    approvalProbability,
    approvalConfidence,
  };
}

// ============================================================================
// DEAL VARIANT GENERATOR
// ============================================================================

/**
 * Generate deal variants by adjusting down payment
 */
function generateDownPaymentVariants(
  baseDeal: DealInput,
  config: OptimizerConfig
): DealVariant[] {
  const variants: DealVariant[] = [];
  const originalDown = baseDeal.downPayment;

  // Original deal
  variants.push({
    deal: baseDeal,
    actions: [],
  });

  // Increase down payment variants
  for (let increase = config.downIncrements; increase <= config.maxDownIncrease; increase += config.downIncrements) {
    const newDown = originalDown + increase;
    const variant: DealInput = {
      ...baseDeal,
      downPayment: newDown,
    };
    variants.push({
      deal: variant,
      actions: [{
        type: 'INCREASE_DOWN',
        field: 'downPayment',
        fromValue: originalDown,
        toValue: newDown,
        impact: { paymentDelta: -increase * 0.02, ltvDelta: -2 },
        reason: `Increase down payment by $${increase}`,
      }],
    });
  }

  return variants;
}

/**
 * Generate deal variants by adjusting products
 */
function generateProductVariants(
  baseDeal: DealInput
): DealVariant[] {
  const variants: DealVariant[] = [];
  const originalGap = baseDeal.products.gap;
  const originalVsc = baseDeal.products.vsc;

  // No backend products
  if (originalGap || originalVsc) {
    const noBackend: DealInput = {
      ...baseDeal,
      products: {
        ...baseDeal.products,
        gap: false,
        vsc: false,
      },
    };

    const actions: RehashAction[] = [];
    if (originalGap) {
      actions.push({
        type: 'REMOVE_GAP',
        field: 'products.gap',
        fromValue: true,
        toValue: false,
        impact: { paymentDelta: -30, profitDelta: -650 },
        reason: 'Remove GAP to reduce amount financed',
      });
    }
    if (originalVsc) {
      actions.push({
        type: 'REMOVE_VSC',
        field: 'products.vsc',
        fromValue: true,
        toValue: false,
        impact: { paymentDelta: -50, profitDelta: -1200 },
        reason: 'Remove VSC to reduce amount financed',
      });
    }

    variants.push({ deal: noBackend, actions });
  }

  // GAP only (if VSC was included)
  if (originalVsc && originalGap) {
    const gapOnly: DealInput = {
      ...baseDeal,
      products: {
        ...baseDeal.products,
        vsc: false,
      },
    };
    variants.push({
      deal: gapOnly,
      actions: [{
        type: 'REMOVE_VSC',
        field: 'products.vsc',
        fromValue: true,
        toValue: false,
        impact: { paymentDelta: -50, profitDelta: -1200 },
        reason: 'Remove VSC to reduce payment',
      }],
    });
  }

  // VSC only (if GAP was included)
  if (originalGap && originalVsc) {
    const vscOnly: DealInput = {
      ...baseDeal,
      products: {
        ...baseDeal.products,
        gap: false,
      },
    };
    variants.push({
      deal: vscOnly,
      actions: [{
        type: 'REMOVE_GAP',
        field: 'products.gap',
        fromValue: true,
        toValue: false,
        impact: { paymentDelta: -30, profitDelta: -650 },
        reason: 'Remove GAP to reduce payment',
      }],
    });
  }

  // Add products if not present
  if (!originalGap) {
    const addGap: DealInput = {
      ...baseDeal,
      products: {
        ...baseDeal.products,
        gap: true,
      },
    };
    variants.push({
      deal: addGap,
      actions: [{
        type: 'ADD_GAP',
        field: 'products.gap',
        fromValue: false,
        toValue: true,
        impact: { paymentDelta: 30, profitDelta: 650 },
        reason: 'Add GAP for LTV protection',
      }],
    });
  }

  if (!originalVsc) {
    const addVsc: DealInput = {
      ...baseDeal,
      products: {
        ...baseDeal.products,
        vsc: true,
      },
    };
    variants.push({
      deal: addVsc,
      actions: [{
        type: 'ADD_VSC',
        field: 'products.vsc',
        fromValue: false,
        toValue: true,
        impact: { paymentDelta: 50, profitDelta: 1200 },
        reason: 'Add VSC for vehicle protection',
      }],
    });
  }

  return variants;
}

/**
 * Generate deal variants by adjusting term
 */
function generateTermVariants(
  baseDeal: DealInput,
  allowedTerms: number[]
): DealVariant[] {
  const variants: DealVariant[] = [];
  const originalTerm = baseDeal.preferredTerm || 60;

  for (const term of allowedTerms) {
    if (term === originalTerm) continue;

    const variant: DealInput = {
      ...baseDeal,
      preferredTerm: term,
    };

    const actionType: RehashActionType = term > originalTerm ? 'EXTEND_TERM' : 'SHORTEN_TERM';

    variants.push({
      deal: variant,
      actions: [{
        type: actionType,
        field: 'preferredTerm',
        fromValue: originalTerm,
        toValue: term,
        impact: {
          paymentDelta: term > originalTerm ? -50 : 50,
        },
        reason: `${term > originalTerm ? 'Extend' : 'Shorten'} term to ${term} months`,
      }],
    });
  }

  return variants;
}

// ============================================================================
// BEAM SEARCH OPTIMIZER
// ============================================================================

/**
 * Evaluate a single deal variant against all lenders
 */
function evaluateVariant(
  variant: DealVariant,
  programs: LenderProgram[],
  targetPayment: number,
  paymentTolerance: number
): CandidateDeal[] {
  const candidates: CandidateDeal[] = [];
  const stateConfig = getStateConfig(variant.deal.state);
  const termMonths = variant.deal.preferredTerm || 60;

  for (const program of programs) {
    // Check eligibility
    const eligibility = checkEligibility(
      program.id,
      variant.deal.vehicle,
      variant.deal.customer
    );

    if (!eligibility.eligible || !eligibility.ficoTier) continue;

    // Calculate amount financed
    const amountFinanced = calculateAmountFinanced(variant.deal, stateConfig);

    // Check amount limits
    if (amountFinanced.amountFinanced < program.minAmountFinanced) continue;
    if (amountFinanced.amountFinanced > program.maxAmountFinanced) continue;

    // Check term
    if (!program.allowedTerms.includes(termMonths)) continue;

    // Get preference multiplier
    const preference = getPreferenceMultiplier(program.id, variant.deal.vehicle);

    // Calculate book value
    const bookValue = calculateBookValue(variant.deal.vehicle);

    // Calculate LTV
    const ltv = bookValue.finalBookValue > 0
      ? (amountFinanced.amountFinanced / bookValue.finalBookValue) * 100
      : 999;

    // Check LTV limit
    if (ltv > eligibility.ficoTier.maxLTV) continue;

    // Calculate down payment percentage
    const downPercent = variant.deal.vehicle.retailPrice > 0
      ? (variant.deal.downPayment / variant.deal.vehicle.retailPrice) * 100
      : 0;

    // Calculate APR
    const aprCalc = calculateDynamicAPR(
      eligibility.ficoTier,
      variant.deal.customer.fico,
      ltv,
      downPercent,
      stateConfig
    );

    // Calculate payment
    const paymentCalc = calculatePayment(
      amountFinanced.amountFinanced,
      aprCalc.finalAPR,
      termMonths
    );

    // Calculate net advance
    const advanceCalc = calculateNetAdvance(
      program,
      eligibility.ficoTier,
      amountFinanced.amountFinanced,
      variant.deal.vehicle.dealerCost,
      bookValue.finalBookValue,
      preference.factor
    );

    // Calculate profit
    const profitCalc = calculateDealerProfit(
      variant.deal,
      amountFinanced,
      advanceCalc.netAdvance,
      aprCalc.finalAPR,
      eligibility.ficoTier.baseAPR
    );

    // Check PTI
    if (variant.deal.customer.monthlyGrossIncome > 0) {
      const pti = (paymentCalc.monthlyPayment / variant.deal.customer.monthlyGrossIncome) * 100;
      if (pti > eligibility.ficoTier.maxPTI) continue;
    }

    // Build lender evaluation
    const lenderEval: LenderEvaluation = {
      lenderId: program.lenderId,
      lenderName: program.name,
      program: program.id,
      eligible: true,
      ruleHits: [...eligibility.ruleHits, ...preference.ruleHits],
      bookValue: bookValue.finalBookValue,
      ltv,
      pti: variant.deal.customer.monthlyGrossIncome > 0
        ? (paymentCalc.monthlyPayment / variant.deal.customer.monthlyGrossIncome) * 100
        : undefined,
      baseAdvancePercent: eligibility.ficoTier.baseAdvancePercent,
      adjustedAdvancePercent: advanceCalc.advancePercent,
      grossAdvance: advanceCalc.grossAdvance,
      lenderFees: advanceCalc.lenderFees,
      netAdvance: advanceCalc.netAdvance,
      apr: aprCalc.finalAPR,
      termMonths,
      payment: paymentCalc.monthlyPayment,
      netCheckToDealer: advanceCalc.netAdvance + amountFinanced.totalDown - variant.deal.vehicle.dealerCost,
      dealerProfit: profitCalc.netProfit,
    };

    // Build candidate
    const candidate = buildCandidateDeal(
      variant,
      lenderEval,
      amountFinanced,
      paymentCalc,
      profitCalc,
      targetPayment,
      paymentTolerance
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Main beam search optimizer
 */
export function optimizeRehash(
  deal: DealInput,
  config: OptimizerConfig = DEFAULT_OPTIMIZER_CONFIG
): RehashResult {
  const startTime = Date.now();
  const allRuleHits: RuleHit[] = [];
  const rejectedDeals: LenderEvaluation[] = [];

  // Get target payment and tolerance
  const targetPayment = deal.maxPayment || 500;
  const paymentTolerance = 50;

  // Get all active programs
  const activePrograms = ALL_LENDER_PROGRAMS.filter(p => p.active);

  // Generate all variants
  const downVariants = generateDownPaymentVariants(deal, config);
  const productVariants = generateProductVariants(deal);

  // Get unique allowed terms from all programs
  const allTerms = [...new Set(activePrograms.flatMap(p => p.allowedTerms))].sort((a, b) => a - b);
  const termVariants = generateTermVariants(deal, allTerms);

  // Combine variants (cross product of down and products, with terms)
  const allVariants: DealVariant[] = [];

  for (const downVar of downVariants) {
    // Original products with this down payment
    allVariants.push(downVar);

    // Combined with product variants
    for (const prodVar of productVariants) {
      if (prodVar.actions.length === 0) continue;

      const combinedDeal: DealInput = {
        ...downVar.deal,
        products: prodVar.deal.products,
      };

      allVariants.push({
        deal: combinedDeal,
        actions: [...downVar.actions, ...prodVar.actions],
      });
    }
  }

  // Add term variants to each base variant
  const finalVariants: DealVariant[] = [];
  for (const variant of allVariants) {
    // Original term
    finalVariants.push(variant);

    // With term adjustments
    for (const termVar of termVariants) {
      const combinedDeal: DealInput = {
        ...variant.deal,
        preferredTerm: termVar.deal.preferredTerm,
      };

      finalVariants.push({
        deal: combinedDeal,
        actions: [...variant.actions, ...termVar.actions],
      });
    }
  }

  // Evaluate all variants
  let allCandidates: CandidateDeal[] = [];

  for (const variant of finalVariants) {
    const candidates = evaluateVariant(
      variant,
      activePrograms,
      targetPayment,
      paymentTolerance
    );
    allCandidates.push(...candidates);

    // Collect rule hits
    for (const candidate of candidates) {
      allRuleHits.push(...candidate.ruleHits);
    }
  }

  // Sort by score (descending)
  allCandidates.sort((a, b) => b.score - a.score);

  // Apply beam width
  allCandidates = allCandidates.slice(0, config.beamWidth * 5);

  // Get unique best per lender
  const lenderBest = new Map<string, CandidateDeal>();
  for (const candidate of allCandidates) {
    const key = candidate.lender.lenderId;
    if (!lenderBest.has(key) || lenderBest.get(key)!.score < candidate.score) {
      lenderBest.set(key, candidate);
    }
  }

  // Final sorted candidates
  const finalCandidates = Array.from(lenderBest.values())
    .sort((a, b) => b.score - a.score);

  // Select best and alternatives
  const bestDeal = finalCandidates.length > 0 ? finalCandidates[0] : null;
  const alternatives = finalCandidates.slice(1, 4);

  // Determine required actions
  const requiredActions = bestDeal?.actionsFromOriginal || [];

  // Compile warnings
  const warnings: string[] = [];
  if (!bestDeal) {
    warnings.push('No eligible lenders found for this deal structure.');
  } else if (bestDeal.approvalConfidence === 'low') {
    warnings.push('Best deal has low approval confidence. Consider increasing down payment.');
  }

  // Missing inputs check
  const missingInputs: string[] = [];
  if (!deal.customer.monthlyGrossIncome) {
    missingInputs.push('monthlyGrossIncome');
  }
  if (!deal.vehicle.make) {
    missingInputs.push('vehicleMake');
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    originalInput: deal,
    bestDeal,
    alternatives,
    rejectedDeals,
    requiredActions,
    allRuleHits: [...new Set(allRuleHits.map(h => JSON.stringify(h)))].map(s => JSON.parse(s)),
    warnings,
    missingInputs,
    processingTimeMs,
    candidatesEvaluated: allCandidates.length,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick check if a deal has any chance of approval
 */
export function quickEligibilityCheck(
  deal: DealInput
): { hasEligibleLenders: boolean; eligibleCount: number } {
  const programs = getApplicablePrograms(deal.vehicle, deal.customer);
  return {
    hasEligibleLenders: programs.length > 0,
    eligibleCount: programs.length,
  };
}

/**
 * Get suggested down payment increase to reach target LTV
 */
export function suggestDownPaymentForLTV(
  currentDown: number,
  amountFinanced: number,
  vehicleValue: number,
  targetLTV: number
): number {
  const currentLTV = (amountFinanced / vehicleValue) * 100;
  if (currentLTV <= targetLTV) return 0;

  const targetAmount = (targetLTV / 100) * vehicleValue;
  const reduction = amountFinanced - targetAmount;

  return Math.ceil(reduction / 100) * 100; // Round up to nearest $100
}

/**
 * Get suggested down payment increase to reach target payment
 */
export function suggestDownPaymentForPayment(
  currentDown: number,
  currentPayment: number,
  targetPayment: number,
  termMonths: number
): number {
  if (currentPayment <= targetPayment) return 0;

  const paymentGap = currentPayment - targetPayment;
  // Rough estimate: $1000 down = ~$25-30/month payment reduction at 60mo
  const estimatedIncrease = Math.ceil((paymentGap * termMonths) / 1.1);

  return Math.ceil(estimatedIncrease / 500) * 500; // Round up to nearest $500
}
