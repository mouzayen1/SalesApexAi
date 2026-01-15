// shared/rules-engine.ts
// Comprehensive lender rules engine with typed RuleHit outputs
// All adjustments and rejections are auditable via RuleHit records

import type {
  RuleHitCode,
  RuleHit,
  RulesResult,
  VehicleInput,
  CustomerInput,
  DealInput,
} from './rehash-types';

import {
  ALL_LENDER_PROGRAMS,
  LenderProgram,
  FicoTier,
  getFicoTier,
  getVehicleRiskMultiplier,
  getVehicleBonusMultiplier,
  VEHICLE_RISK_DATABASE,
  VEHICLE_BONUS_DATABASE,
} from './lender-programs';

// ============================================================================
// ELIGIBILITY CHECK - Returns whether a lender will consider this deal
// ============================================================================

export interface EligibilityResult {
  eligible: boolean;
  program: LenderProgram | null;
  ficoTier: FicoTier | null;
  ruleHits: RuleHit[];
  rejectionReasons: string[];
}

/**
 * Check if a vehicle/customer combination is eligible for a lender program
 */
export function checkEligibility(
  programId: string,
  vehicle: VehicleInput,
  customer: CustomerInput,
  amountFinanced?: number
): EligibilityResult {
  const program = ALL_LENDER_PROGRAMS.find(p => p.id === programId);

  if (!program) {
    return {
      eligible: false,
      program: null,
      ficoTier: null,
      ruleHits: [],
      rejectionReasons: [`Program ${programId} not found`],
    };
  }

  const ruleHits: RuleHit[] = [];
  const rejectionReasons: string[] = [];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;

  // Check FICO eligibility
  if (customer.fico < program.minFico) {
    ruleHits.push({
      code: 'FICO_BELOW_MIN',
      lender: program.lenderId,
      program: program.name,
      label: `FICO ${customer.fico} below minimum ${program.minFico}`,
      source: 'config',
    });
    rejectionReasons.push(`FICO ${customer.fico} below minimum ${program.minFico}`);
  }

  // Get FICO tier
  const ficoTier = getFicoTier(program, customer.fico);
  if (!ficoTier && customer.fico >= program.minFico) {
    rejectionReasons.push(`No FICO tier found for score ${customer.fico}`);
  }

  // Check vehicle age
  if (vehicleAge > program.maxVehicleAge) {
    ruleHits.push({
      code: 'AGE_RISK',
      lender: program.lenderId,
      program: program.name,
      label: `Vehicle age ${vehicleAge} years exceeds max ${program.maxVehicleAge}`,
      source: 'config',
    });
    rejectionReasons.push(`Vehicle too old: ${vehicleAge} years (max ${program.maxVehicleAge})`);
  }

  // Check mileage
  if (vehicle.mileage > program.maxMileage) {
    ruleHits.push({
      code: 'MILEAGE_RISK',
      lender: program.lenderId,
      program: program.name,
      label: `Mileage ${vehicle.mileage.toLocaleString()} exceeds max ${program.maxMileage.toLocaleString()}`,
      source: 'config',
    });
    rejectionReasons.push(`Mileage too high: ${vehicle.mileage.toLocaleString()} (max ${program.maxMileage.toLocaleString()})`);
  }

  // Check excluded makes
  const makeNormalized = vehicle.make.toLowerCase();
  const isExcluded = program.excludedMakes.some(
    m => m.toLowerCase() === makeNormalized
  );
  if (isExcluded) {
    ruleHits.push({
      code: 'EXCLUDED_MAKE',
      lender: program.lenderId,
      program: program.name,
      label: `${vehicle.make} is excluded by ${program.name}`,
      source: 'config',
    });
    rejectionReasons.push(`Make ${vehicle.make} is excluded`);
  }

  // Check amount financed limits
  if (amountFinanced !== undefined) {
    if (amountFinanced < program.minAmountFinanced) {
      ruleHits.push({
        code: 'AMOUNT_BELOW_MIN',
        lender: program.lenderId,
        program: program.name,
        label: `Amount $${amountFinanced.toLocaleString()} below minimum $${program.minAmountFinanced.toLocaleString()}`,
        source: 'config',
      });
      rejectionReasons.push(`Amount financed too low: $${amountFinanced.toLocaleString()}`);
    }
    if (amountFinanced > program.maxAmountFinanced) {
      ruleHits.push({
        code: 'AMOUNT_ABOVE_MAX',
        lender: program.lenderId,
        program: program.name,
        label: `Amount $${amountFinanced.toLocaleString()} exceeds max $${program.maxAmountFinanced.toLocaleString()}`,
        source: 'config',
      });
      rejectionReasons.push(`Amount financed too high: $${amountFinanced.toLocaleString()}`);
    }
  }

  // Check income requirement (basic PTI check)
  if (ficoTier && customer.monthlyGrossIncome > 0) {
    const minIncome = 1500; // Minimum $1500/month for most lenders
    if (customer.monthlyGrossIncome < minIncome) {
      ruleHits.push({
        code: 'INCOME_INSUFFICIENT',
        lender: program.lenderId,
        program: program.name,
        label: `Monthly income $${customer.monthlyGrossIncome.toLocaleString()} below minimum`,
        source: 'config',
      });
      rejectionReasons.push(`Income too low: $${customer.monthlyGrossIncome.toLocaleString()}/month`);
    }
  }

  const eligible = rejectionReasons.length === 0;

  return {
    eligible,
    program,
    ficoTier,
    ruleHits,
    rejectionReasons,
  };
}

// ============================================================================
// PREFERENCE MULTIPLIERS - Bonuses and penalties affecting advance/approval
// ============================================================================

export interface PreferenceResult {
  factor: number;
  ruleHits: RuleHit[];
  explanations: string[];
}

/**
 * Calculate the preference multiplier for a vehicle at a specific lender
 * Returns a factor (0.80-1.15) that affects advance percentages
 */
export function getPreferenceMultiplier(
  programId: string,
  vehicle: VehicleInput
): PreferenceResult {
  const program = ALL_LENDER_PROGRAMS.find(p => p.id === programId);

  if (!program) {
    return { factor: 1.0, ruleHits: [], explanations: [] };
  }

  const ruleHits: RuleHit[] = [];
  const explanations: string[] = [];
  let factor = 1.0;
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;

  // Check vehicle risk database
  const riskResult = getVehicleRiskMultiplier(
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    program.lenderId
  );

  if (riskResult.entries.length > 0) {
    factor *= riskResult.multiplier;

    for (const entry of riskResult.entries) {
      const code: RuleHitCode = entry.riskType === 'theft' ? 'HIGH_THEFT_RISK' : 'MODEL_RISK';
      ruleHits.push({
        code,
        lender: program.lenderId,
        program: program.name,
        label: entry.notes || `${entry.riskType} risk for ${vehicle.make} ${vehicle.model}`,
        factor: entry.multiplier,
        source: 'config',
      });
      explanations.push(`${entry.riskType} risk: ${entry.notes || 'Model-specific penalty'}`);
    }
  }

  // Check vehicle bonus database
  const bonusResult = getVehicleBonusMultiplier(
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.mileage,
    program.lenderId
  );

  if (bonusResult.entries.length > 0) {
    factor *= bonusResult.multiplier;

    for (const entry of bonusResult.entries) {
      const code: RuleHitCode = entry.bonusType === 'reliability' ? 'BONUS_RELIABILITY' :
                                entry.bonusType === 'low_miles' ? 'BONUS_LOW_MILES' :
                                'BONUS_RECENT_MODEL';
      ruleHits.push({
        code,
        lender: program.lenderId,
        program: program.name,
        label: entry.notes || `${entry.bonusType} bonus for ${vehicle.make}`,
        factor: entry.multiplier,
        source: 'config',
      });
      explanations.push(`${entry.bonusType} bonus: ${entry.notes || 'Model-specific bonus'}`);
    }
  }

  // Age-based adjustments (general rule)
  if (vehicleAge <= 3) {
    const ageBonus = 1.02;
    factor *= ageBonus;
    ruleHits.push({
      code: 'BONUS_RECENT_MODEL',
      lender: program.lenderId,
      program: program.name,
      label: `Recent model year bonus (${vehicle.year})`,
      factor: ageBonus,
      source: 'calculated',
    });
    explanations.push(`Recent model year (${vehicleAge} years old) - bonus applied`);
  } else if (vehicleAge > 10) {
    const agePenalty = Math.max(0.90, 1.0 - (vehicleAge - 10) * 0.02);
    factor *= agePenalty;
    ruleHits.push({
      code: 'AGE_RISK',
      lender: program.lenderId,
      program: program.name,
      label: `Aged vehicle penalty (${vehicleAge} years)`,
      factor: agePenalty,
      source: 'calculated',
    });
    explanations.push(`Older vehicle (${vehicleAge} years old) - penalty applied`);
  }

  // Mileage-based adjustments (general rule)
  if (vehicle.mileage < 30000) {
    const mileageBonus = 1.03;
    factor *= mileageBonus;
    ruleHits.push({
      code: 'BONUS_LOW_MILES',
      lender: program.lenderId,
      program: program.name,
      label: `Low mileage bonus (${vehicle.mileage.toLocaleString()} miles)`,
      factor: mileageBonus,
      source: 'calculated',
    });
    explanations.push(`Low mileage (${vehicle.mileage.toLocaleString()} miles) - bonus applied`);
  } else if (vehicle.mileage > 100000) {
    const mileagePenalty = Math.max(0.85, 1.0 - (vehicle.mileage - 100000) / 200000);
    factor *= mileagePenalty;
    ruleHits.push({
      code: 'MILEAGE_RISK',
      lender: program.lenderId,
      program: program.name,
      label: `High mileage penalty (${vehicle.mileage.toLocaleString()} miles)`,
      factor: mileagePenalty,
      source: 'calculated',
    });
    explanations.push(`High mileage (${vehicle.mileage.toLocaleString()} miles) - penalty applied`);
  }

  // Cap factor at reasonable bounds
  factor = Math.max(0.75, Math.min(1.20, factor));

  return { factor, ruleHits, explanations };
}

// ============================================================================
// DEAL VALIDATION - Check deal structure against lender guidelines
// ============================================================================

export interface DealValidationResult {
  isValid: boolean;
  ruleHits: RuleHit[];
  warnings: string[];
}

/**
 * Validate deal structure against lender guidelines (LTV, PTI, DTI, backend caps)
 */
export function validateDealStructure(
  programId: string,
  amountFinanced: number,
  vehicleValue: number,
  payment: number,
  monthlyIncome: number,
  monthlyDebt: number,
  backendTotal: number,
  termMonths: number
): DealValidationResult {
  const program = ALL_LENDER_PROGRAMS.find(p => p.id === programId);

  if (!program) {
    return { isValid: false, ruleHits: [], warnings: [`Program ${programId} not found`] };
  }

  const ficoTier = program.ficoTiers[0]; // Use most restrictive tier for initial check
  if (!ficoTier) {
    return { isValid: false, ruleHits: [], warnings: ['No FICO tier available'] };
  }

  const ruleHits: RuleHit[] = [];
  const warnings: string[] = [];
  let isValid = true;

  // LTV check
  const ltv = vehicleValue > 0 ? (amountFinanced / vehicleValue) * 100 : 999;
  if (ltv > ficoTier.maxLTV) {
    isValid = false;
    ruleHits.push({
      code: 'LTV_EXCEEDED',
      lender: program.lenderId,
      program: program.name,
      label: `LTV ${ltv.toFixed(0)}% exceeds max ${ficoTier.maxLTV}%`,
      details: `Amount financed: $${amountFinanced.toLocaleString()}, Vehicle value: $${vehicleValue.toLocaleString()}`,
      source: 'calculated',
    });
    warnings.push(`LTV ${ltv.toFixed(0)}% exceeds ${ficoTier.maxLTV}% limit`);
  }

  // PTI check
  if (monthlyIncome > 0) {
    const pti = (payment / monthlyIncome) * 100;
    if (pti > ficoTier.maxPTI) {
      isValid = false;
      ruleHits.push({
        code: 'PTI_EXCEEDED',
        lender: program.lenderId,
        program: program.name,
        label: `PTI ${pti.toFixed(0)}% exceeds max ${ficoTier.maxPTI}%`,
        details: `Payment: $${payment.toFixed(0)}, Income: $${monthlyIncome.toLocaleString()}`,
        source: 'calculated',
      });
      warnings.push(`PTI ${pti.toFixed(0)}% exceeds ${ficoTier.maxPTI}% limit`);
    }
  }

  // DTI check
  if (monthlyIncome > 0 && monthlyDebt > 0) {
    const dti = ((monthlyDebt + payment) / monthlyIncome) * 100;
    if (dti > ficoTier.maxDTI) {
      isValid = false;
      ruleHits.push({
        code: 'DTI_EXCEEDED',
        lender: program.lenderId,
        program: program.name,
        label: `DTI ${dti.toFixed(0)}% exceeds max ${ficoTier.maxDTI}%`,
        details: `Total debt: $${(monthlyDebt + payment).toFixed(0)}, Income: $${monthlyIncome.toLocaleString()}`,
        source: 'calculated',
      });
      warnings.push(`DTI ${dti.toFixed(0)}% exceeds ${ficoTier.maxDTI}% limit`);
    }
  }

  // Backend total check
  if (backendTotal > program.maxBackendTotal) {
    ruleHits.push({
      code: 'BACKEND_CAPPED',
      lender: program.lenderId,
      program: program.name,
      label: `Backend $${backendTotal.toLocaleString()} exceeds cap $${program.maxBackendTotal.toLocaleString()}`,
      source: 'config',
    });
    warnings.push(`Backend products capped at $${program.maxBackendTotal.toLocaleString()}`);
  }

  // Backend percentage check
  if (amountFinanced > 0) {
    const backendPct = (backendTotal / amountFinanced) * 100;
    if (backendPct > program.maxBackendPercent) {
      ruleHits.push({
        code: 'BACKEND_CAPPED',
        lender: program.lenderId,
        program: program.name,
        label: `Backend ${backendPct.toFixed(0)}% exceeds ${program.maxBackendPercent}% limit`,
        source: 'config',
      });
      warnings.push(`Backend percentage ${backendPct.toFixed(0)}% exceeds ${program.maxBackendPercent}% limit`);
    }
  }

  // Term check
  if (!program.allowedTerms.includes(termMonths)) {
    ruleHits.push({
      code: 'TERM_NOT_ALLOWED',
      lender: program.lenderId,
      program: program.name,
      label: `Term ${termMonths} months not allowed (available: ${program.allowedTerms.join(', ')})`,
      source: 'config',
    });
    warnings.push(`Term ${termMonths} not available`);
  }

  return { isValid, ruleHits, warnings };
}

// ============================================================================
// COMPREHENSIVE RULES EVALUATION
// ============================================================================

/**
 * Run all rules for a deal and return comprehensive results
 */
export function evaluateRules(
  programId: string,
  deal: DealInput,
  amountFinanced: number,
  payment: number
): RulesResult {
  const program = ALL_LENDER_PROGRAMS.find(p => p.id === programId);

  if (!program) {
    return {
      eligible: false,
      ruleHits: [],
      advanceMultiplierDelta: 0,
      approvalProbabilityDelta: -1.0,
      reasons: [`Program ${programId} not found`],
    };
  }

  const allRuleHits: RuleHit[] = [];
  const reasons: string[] = [];
  let advanceMultiplierDelta = 0;
  let approvalProbabilityDelta = 0;

  // 1. Check eligibility
  const eligibility = checkEligibility(
    programId,
    deal.vehicle,
    deal.customer,
    amountFinanced
  );
  allRuleHits.push(...eligibility.ruleHits);
  reasons.push(...eligibility.rejectionReasons);

  if (!eligibility.eligible) {
    return {
      eligible: false,
      ruleHits: allRuleHits,
      advanceMultiplierDelta: -0.2,
      approvalProbabilityDelta: -1.0,
      reasons,
    };
  }

  // 2. Get preference multiplier
  const preference = getPreferenceMultiplier(programId, deal.vehicle);
  allRuleHits.push(...preference.ruleHits);
  reasons.push(...preference.explanations);
  advanceMultiplierDelta = preference.factor - 1.0;

  // 3. Validate deal structure
  const backendTotal = (deal.products.gap ? 900 : 0) +
                       (deal.products.vsc ? 1800 : 0) +
                       (deal.products.otherProductsTotal || 0);

  const validation = validateDealStructure(
    programId,
    amountFinanced,
    deal.vehicle.retailPrice,
    payment,
    deal.customer.monthlyGrossIncome,
    deal.customer.monthlyDebtPayments || 0,
    backendTotal,
    deal.preferredTerm || 60
  );
  allRuleHits.push(...validation.ruleHits);
  reasons.push(...validation.warnings);

  // Calculate approval probability delta based on rule hits
  const criticalHits = allRuleHits.filter(h =>
    h.code === 'LTV_EXCEEDED' ||
    h.code === 'PTI_EXCEEDED' ||
    h.code === 'DTI_EXCEEDED'
  );
  const warningHits = allRuleHits.filter(h =>
    h.code === 'HIGH_THEFT_RISK' ||
    h.code === 'MODEL_RISK' ||
    h.code === 'AGE_RISK' ||
    h.code === 'MILEAGE_RISK'
  );
  const bonusHits = allRuleHits.filter(h =>
    h.code === 'BONUS_RELIABILITY' ||
    h.code === 'BONUS_LOW_MILES' ||
    h.code === 'BONUS_RECENT_MODEL'
  );

  approvalProbabilityDelta = -criticalHits.length * 0.3 - warningHits.length * 0.1 + bonusHits.length * 0.05;
  approvalProbabilityDelta = Math.max(-1.0, Math.min(0.2, approvalProbabilityDelta));

  return {
    eligible: validation.isValid,
    ruleHits: allRuleHits,
    advanceMultiplierDelta,
    approvalProbabilityDelta,
    reasons,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all applicable programs for a vehicle/customer
 */
export function getApplicablePrograms(
  vehicle: VehicleInput,
  customer: CustomerInput
): LenderProgram[] {
  return ALL_LENDER_PROGRAMS.filter(program => {
    const result = checkEligibility(program.id, vehicle, customer);
    return result.eligible;
  });
}

/**
 * Get programs by lender ID
 */
export function getProgramsByLender(lenderId: string): LenderProgram[] {
  return ALL_LENDER_PROGRAMS.filter(p => p.lenderId === lenderId && p.active);
}

/**
 * Get a single program by ID
 */
export function getProgramById(programId: string): LenderProgram | undefined {
  return ALL_LENDER_PROGRAMS.find(p => p.id === programId);
}

/**
 * Check if a specific make/model has theft risk at any lender
 */
export function hasTheftRisk(
  make: string,
  model: string,
  year: number
): boolean {
  const risk = getVehicleRiskMultiplier(make, model, year, 50000);
  return risk.entries.some(e => e.riskType === 'theft');
}
