// shared/calibration.ts
// Calibration system for tuning calculations to real-world results
// Implements residual analysis and config adjustments

import type {
  CalibrationConfig,
  LenderCalibration,
  StateCalibration,
  VehicleCalibration,
  CalibrationResidual,
  CalibrationAnalysis,
  ValidationTolerances,
  DEFAULT_TOLERANCES,
  DealInput,
  CandidateDeal,
} from './rehash-types';

// ============================================================================
// DEFAULT CALIBRATION CONFIG
// ============================================================================

export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  version: '1.0.0',
  lastUpdated: Date.now(),

  lenderAdjustments: {
    westlake: {
      lenderId: 'westlake',
      advanceMultiplier: 1.0,
      feeAdjustment: 0,
      aprAdjustment: 0,
      source: 'default',
    },
    western_funding: {
      lenderId: 'western_funding',
      advanceMultiplier: 1.0,
      feeAdjustment: 0,
      aprAdjustment: 0,
      source: 'default',
    },
    uac: {
      lenderId: 'uac',
      advanceMultiplier: 1.0,
      feeAdjustment: 0,
      aprAdjustment: 0,
      source: 'default',
    },
  },

  stateOverrides: {},

  vehicleOverrides: [],
};

// ============================================================================
// TOLERANCE CONFIGURATION
// ============================================================================

export const VALIDATION_TOLERANCES: ValidationTolerances = {
  bookValuePercent: 0.02,        // ±2%
  amountFinancedDollars: 100,    // $100
  paymentDollars: 5,             // ±$5/month
  aprPercent: 0.005,             // ±0.5%
  netCheckPercent: 0.02,         // ±2%
};

// ============================================================================
// RESIDUAL CALCULATION
// ============================================================================

/**
 * Calculate residual between expected and actual values
 */
export function calculateResidual(
  field: string,
  expected: number,
  actual: number
): CalibrationResidual {
  const residual = actual - expected;
  const percentError = expected !== 0 ? (residual / expected) * 100 : 0;

  // Suggest adjustment to close the gap
  let suggestedAdjustment: number | undefined;
  if (Math.abs(percentError) > 1) {
    suggestedAdjustment = -residual; // Adjustment to close gap
  }

  return {
    field,
    expected,
    actual,
    residual,
    percentError: Math.round(percentError * 100) / 100,
    suggestedAdjustment,
  };
}

/**
 * Analyze a deal's calculation results against actual values
 */
export function analyzeDealCalibration(
  dealId: string,
  calculated: {
    bookValue?: number;
    amountFinanced?: number;
    payment?: number;
    apr?: number;
    netCheck?: number;
  },
  actual: {
    bookValue?: number;
    amountFinanced?: number;
    payment?: number;
    apr?: number;
    netCheck?: number;
  }
): CalibrationAnalysis {
  const residuals: CalibrationResidual[] = [];
  let withinTolerances = true;

  // Book Value comparison
  if (calculated.bookValue !== undefined && actual.bookValue !== undefined) {
    const residual = calculateResidual('bookValue', calculated.bookValue, actual.bookValue);
    residuals.push(residual);
    if (Math.abs(residual.percentError) > VALIDATION_TOLERANCES.bookValuePercent * 100) {
      withinTolerances = false;
    }
  }

  // Amount Financed comparison
  if (calculated.amountFinanced !== undefined && actual.amountFinanced !== undefined) {
    const residual = calculateResidual('amountFinanced', calculated.amountFinanced, actual.amountFinanced);
    residuals.push(residual);
    if (Math.abs(residual.residual) > VALIDATION_TOLERANCES.amountFinancedDollars) {
      withinTolerances = false;
    }
  }

  // Payment comparison
  if (calculated.payment !== undefined && actual.payment !== undefined) {
    const residual = calculateResidual('payment', calculated.payment, actual.payment);
    residuals.push(residual);
    if (Math.abs(residual.residual) > VALIDATION_TOLERANCES.paymentDollars) {
      withinTolerances = false;
    }
  }

  // APR comparison
  if (calculated.apr !== undefined && actual.apr !== undefined) {
    const residual = calculateResidual('apr', calculated.apr, actual.apr);
    residuals.push(residual);
    if (Math.abs(residual.residual) > VALIDATION_TOLERANCES.aprPercent * 100) {
      withinTolerances = false;
    }
  }

  // Net Check comparison
  if (calculated.netCheck !== undefined && actual.netCheck !== undefined) {
    const residual = calculateResidual('netCheck', calculated.netCheck, actual.netCheck);
    residuals.push(residual);
    if (Math.abs(residual.percentError) > VALIDATION_TOLERANCES.netCheckPercent * 100) {
      withinTolerances = false;
    }
  }

  // Calculate overall accuracy (inverse of average percent error)
  const avgPercentError = residuals.length > 0
    ? residuals.reduce((sum, r) => sum + Math.abs(r.percentError), 0) / residuals.length
    : 0;
  const overallAccuracy = Math.max(0, 100 - avgPercentError);

  // Generate suggested calibration updates
  const suggestedCalibrationUpdates: Partial<CalibrationConfig> = {};

  return {
    dealId,
    residuals,
    overallAccuracy: Math.round(overallAccuracy * 100) / 100,
    suggestedCalibrationUpdates,
    withinTolerances,
  };
}

// ============================================================================
// CALIBRATION APPLICATION
// ============================================================================

/**
 * Apply calibration adjustments to a lender's calculations
 */
export function applyLenderCalibration(
  lenderId: string,
  baseAdvance: number,
  baseFee: number,
  baseAPR: number,
  config: CalibrationConfig
): {
  adjustedAdvance: number;
  adjustedFee: number;
  adjustedAPR: number;
} {
  const calibration = config.lenderAdjustments[lenderId];

  if (!calibration) {
    return {
      adjustedAdvance: baseAdvance,
      adjustedFee: baseFee,
      adjustedAPR: baseAPR,
    };
  }

  return {
    adjustedAdvance: baseAdvance * calibration.advanceMultiplier,
    adjustedFee: baseFee + calibration.feeAdjustment,
    adjustedAPR: baseAPR + calibration.aprAdjustment,
  };
}

/**
 * Apply state calibration overrides
 */
export function applyStateCalibration(
  stateCode: string,
  baseTaxRate: number,
  baseDocFee: number,
  baseRegFee: number,
  baseAPRCap: number,
  config: CalibrationConfig
): {
  taxRate: number;
  docFee: number;
  regFee: number;
  aprCap: number;
} {
  const override = config.stateOverrides[stateCode];

  return {
    taxRate: override?.taxRateOverride ?? baseTaxRate,
    docFee: override?.docFeeOverride ?? baseDocFee,
    regFee: override?.regFeeOverride ?? baseRegFee,
    aprCap: override?.aprCapOverride ?? baseAPRCap,
  };
}

/**
 * Apply vehicle-specific calibration
 */
export function applyVehicleCalibration(
  make: string,
  model: string,
  year: number,
  mileage: number,
  baseMultiplier: number,
  config: CalibrationConfig
): number {
  // Find matching vehicle override
  const override = config.vehicleOverrides.find(v => {
    if (v.make.toLowerCase() !== make.toLowerCase()) return false;
    if (v.model && !model.toLowerCase().includes(v.model.toLowerCase())) return false;
    if (v.yearMin && year < v.yearMin) return false;
    if (v.yearMax && year > v.yearMax) return false;
    if (v.mileageMin && mileage < v.mileageMin) return false;
    if (v.mileageMax && mileage > v.mileageMax) return false;
    return true;
  });

  if (override) {
    return baseMultiplier * override.multiplierOverride;
  }

  return baseMultiplier;
}

// ============================================================================
// CALIBRATION LEARNING
// ============================================================================

/**
 * Learn calibration adjustments from a batch of actual results
 */
export function learnCalibration(
  results: Array<{
    dealId: string;
    lenderId: string;
    state: string;
    make: string;
    model: string;
    year: number;
    calculated: {
      advance?: number;
      apr?: number;
      payment?: number;
    };
    actual: {
      advance?: number;
      apr?: number;
      payment?: number;
    };
  }>,
  currentConfig: CalibrationConfig
): CalibrationConfig {
  const newConfig: CalibrationConfig = {
    ...currentConfig,
    lastUpdated: Date.now(),
    lenderAdjustments: { ...currentConfig.lenderAdjustments },
    stateOverrides: { ...currentConfig.stateOverrides },
    vehicleOverrides: [...currentConfig.vehicleOverrides],
  };

  // Group by lender
  const lenderResults = new Map<string, typeof results>();
  for (const result of results) {
    if (!lenderResults.has(result.lenderId)) {
      lenderResults.set(result.lenderId, []);
    }
    lenderResults.get(result.lenderId)!.push(result);
  }

  // Calculate lender adjustments
  for (const [lenderId, lenderData] of lenderResults) {
    const advanceResiduals: number[] = [];
    const aprResiduals: number[] = [];

    for (const r of lenderData) {
      if (r.calculated.advance && r.actual.advance) {
        advanceResiduals.push((r.actual.advance / r.calculated.advance) - 1);
      }
      if (r.calculated.apr && r.actual.apr) {
        aprResiduals.push(r.actual.apr - r.calculated.apr);
      }
    }

    // Average residuals
    const avgAdvanceResidual = advanceResiduals.length > 0
      ? advanceResiduals.reduce((a, b) => a + b, 0) / advanceResiduals.length
      : 0;
    const avgAPRResidual = aprResiduals.length > 0
      ? aprResiduals.reduce((a, b) => a + b, 0) / aprResiduals.length
      : 0;

    // Apply dampening (don't overcorrect)
    const dampening = 0.5;

    newConfig.lenderAdjustments[lenderId] = {
      lenderId,
      advanceMultiplier: 1 + (avgAdvanceResidual * dampening),
      feeAdjustment: 0,
      aprAdjustment: avgAPRResidual * dampening,
      source: 'learned',
      notes: `Learned from ${lenderData.length} deals`,
    };
  }

  return newConfig;
}

// ============================================================================
// VALIDATION SUITE
// ============================================================================

export interface ValidationResult {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  details: Array<{
    field: string;
    expected: number;
    actual: number;
    tolerance: number;
    passed: boolean;
  }>;
}

/**
 * Validate a calculated deal against expected values
 */
export function validateDeal(
  calculated: CandidateDeal,
  expected: {
    bookValue?: number;
    amountFinanced?: number;
    payment?: number;
    apr?: number;
    netCheck?: number;
    profit?: number;
  }
): ValidationResult {
  const details: ValidationResult['details'] = [];

  // Book value check
  if (expected.bookValue !== undefined && calculated.lender.bookValue !== undefined) {
    const tolerance = expected.bookValue * VALIDATION_TOLERANCES.bookValuePercent;
    const passed = Math.abs(calculated.lender.bookValue - expected.bookValue) <= tolerance;
    details.push({
      field: 'bookValue',
      expected: expected.bookValue,
      actual: calculated.lender.bookValue,
      tolerance,
      passed,
    });
  }

  // Amount financed check
  if (expected.amountFinanced !== undefined) {
    const tolerance = VALIDATION_TOLERANCES.amountFinancedDollars;
    const passed = Math.abs(calculated.amountFinanced.amountFinanced - expected.amountFinanced) <= tolerance;
    details.push({
      field: 'amountFinanced',
      expected: expected.amountFinanced,
      actual: calculated.amountFinanced.amountFinanced,
      tolerance,
      passed,
    });
  }

  // Payment check
  if (expected.payment !== undefined) {
    const tolerance = VALIDATION_TOLERANCES.paymentDollars;
    const passed = Math.abs(calculated.payment.monthlyPayment - expected.payment) <= tolerance;
    details.push({
      field: 'payment',
      expected: expected.payment,
      actual: calculated.payment.monthlyPayment,
      tolerance,
      passed,
    });
  }

  // APR check
  if (expected.apr !== undefined && calculated.lender.apr !== undefined) {
    const tolerance = VALIDATION_TOLERANCES.aprPercent * 100;
    const passed = Math.abs(calculated.lender.apr - expected.apr) <= tolerance;
    details.push({
      field: 'apr',
      expected: expected.apr,
      actual: calculated.lender.apr,
      tolerance,
      passed,
    });
  }

  // Net check to dealer
  if (expected.netCheck !== undefined && calculated.lender.netCheckToDealer !== undefined) {
    const tolerance = expected.netCheck * VALIDATION_TOLERANCES.netCheckPercent;
    const passed = Math.abs(calculated.lender.netCheckToDealer - expected.netCheck) <= tolerance;
    details.push({
      field: 'netCheck',
      expected: expected.netCheck,
      actual: calculated.lender.netCheckToDealer,
      tolerance,
      passed,
    });
  }

  // Profit check
  if (expected.profit !== undefined && calculated.lender.dealerProfit !== undefined) {
    const tolerance = 200; // $200 tolerance on profit
    const passed = Math.abs(calculated.lender.dealerProfit - expected.profit) <= tolerance;
    details.push({
      field: 'profit',
      expected: expected.profit,
      actual: calculated.lender.dealerProfit,
      tolerance,
      passed,
    });
  }

  const passedChecks = details.filter(d => d.passed).length;
  const failedChecks = details.filter(d => !d.passed).length;

  return {
    passed: failedChecks === 0,
    totalChecks: details.length,
    passedChecks,
    failedChecks,
    details,
  };
}

// ============================================================================
// EXPORT CALIBRATION
// ============================================================================

/**
 * Export calibration config to JSON
 */
export function exportCalibration(config: CalibrationConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import calibration config from JSON
 */
export function importCalibration(json: string): CalibrationConfig {
  const parsed = JSON.parse(json);

  // Validate structure
  if (!parsed.version || !parsed.lenderAdjustments) {
    throw new Error('Invalid calibration config structure');
  }

  return parsed as CalibrationConfig;
}

/**
 * Merge two calibration configs (newer takes precedence)
 */
export function mergeCalibrations(
  base: CalibrationConfig,
  override: Partial<CalibrationConfig>
): CalibrationConfig {
  return {
    version: override.version || base.version,
    lastUpdated: Date.now(),
    lenderAdjustments: {
      ...base.lenderAdjustments,
      ...(override.lenderAdjustments || {}),
    },
    stateOverrides: {
      ...base.stateOverrides,
      ...(override.stateOverrides || {}),
    },
    vehicleOverrides: override.vehicleOverrides || base.vehicleOverrides,
  };
}
