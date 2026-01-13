/**
 * Adapter Module
 *
 * Bridges the new underwriting engine to the existing API contracts.
 * This ensures backward compatibility with existing code that uses
 * the functions from shared/rehash.ts
 */

import type { DealInput, DealCandidate, RiskAssessment } from '../deals';
import type { LenderConfig } from '../lenders';
import {
  runEngine,
  assessRisk as assessRiskNew,
} from './engine';
import type {
  UnderwritingInput,
  DealResult,
  EngineConfig,
} from './types';

/**
 * Convert legacy DealInput to UnderwritingInput
 */
export function convertDealInput(deal: DealInput): UnderwritingInput {
  return {
    vehicle: {
      year: deal.vehicleYear,
      make: deal.vehicleMake || '',
      model: '',
      mileage: deal.vehicleMileage,
      retailPrice: deal.vehiclePrice,
      dealerCost: deal.vehicleCost,
    },
    dealStructure: {
      downPayment: deal.downPayment,
      tradeAllowance: deal.tradeAllowance,
      tradePayoff: deal.tradePayoff,
      taxRate: deal.taxRate,
      fees: deal.fees,
      backendProducts: {
        gap: deal.backendProducts.gap,
        gapPrice: 900, // Use standard pricing
        vsc: deal.backendProducts.vsc,
        vscPrice: 1800,
        otherTotal: deal.backendProducts.otherProductsTotal,
      },
    },
    customer: {
      creditTier: deal.customerCreditTier,
      monthlyIncome: deal.monthlyIncome,
    },
    targetPayment: deal.targetPayment,
    paymentTolerance: deal.paymentTolerance,
    preferredTerm: deal.preferredTermMonths,
  };
}

/**
 * Convert DealResult back to DealCandidate for backward compatibility
 */
export function convertDealResult(result: DealResult, riskAssessment: RiskAssessment): DealCandidate {
  return {
    lenderId: result.lenderId,
    lenderName: result.lenderName,
    termMonths: result.termMonths,
    apr: result.apr,
    amountFinanced: result.amountFinanced,
    payment: result.payment,
    netCheckToDealer: result.netCheckToDealer,
    dealerFrontGross: result.dealerFrontGross,
    dealerBackEndGross: result.dealerBackEndGross,
    dealerProfit: result.dealerProfit,
    totalDown: result.totalDown,
    backendTotal: result.backendTotal,
    ltv: result.ltv,
    withinGuidelines: result.withinGuidelines,
    reasons: result.reasons,
    adjustments: result.adjustments,
    hasGap: result.hasGap,
    hasVsc: result.hasVsc,
    smartNote: result.smartNote,
    riskAssessment,
    optimizationLevel: result.optimizationLevel,
    vehicleWarnings: result.vehicleWarnings,
    advanceMultiplier: result.advanceMultiplier,
    ptiPercent: result.ptiPercent,
    ptiWarning: result.ptiWarning,
    ptiExceedsLimit: result.ptiExceedsLimit,
    requiredIncome: result.requiredIncome,
  };
}

/**
 * Run the new engine with legacy inputs
 *
 * This function provides the same signature as the original runRehash
 * but uses the new calculation engine internally.
 */
export function runRehashV2(
  deal: DealInput,
  _lenders?: LenderConfig[], // Ignored - uses new config system
  config?: EngineConfig
): {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
  riskAssessment: RiskAssessment;
} {
  // Convert input
  const input = convertDealInput(deal);

  // Run new engine
  const result = runEngine(input, config);

  // Convert results back to legacy format
  const allCandidates = result.allCandidates.map(c =>
    convertDealResult(c, result.riskAssessment)
  );

  const bestDeal = result.bestDeal
    ? convertDealResult(result.bestDeal, result.riskAssessment)
    : null;

  return {
    bestDeal,
    allCandidates,
    riskAssessment: result.riskAssessment,
  };
}

/**
 * Feature flag to control which engine is used
 * Set USE_ENGINE_V2=true to use the new engine
 */
export function useEngineV2(): boolean {
  return process.env.USE_ENGINE_V2 === 'true';
}
