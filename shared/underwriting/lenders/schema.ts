/**
 * Lender Configuration Schema
 *
 * This module provides the schema definition and validation for lender configurations.
 * Lender rules are stored as JSON files and loaded at runtime.
 *
 * Schema Design Goals:
 * 1. Support complex tier-based pricing and eligibility rules
 * 2. Allow vehicle-specific risk adjustments
 * 3. Enable version tracking for audit trails
 * 4. Support both manual entry and Groq-assisted extraction
 */

import type {
  LenderSchema,
  LenderTierConfig,
  VehicleRestrictions,
  VehicleRiskAdjustment,
  LenderCustomRule,
  CreditTier,
} from '../types';

/**
 * Validation result for a lender configuration
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a credit tier configuration
 */
function validateTierConfig(tier: LenderTierConfig, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Tier[${index}] (${tier.creditTier})`;

  // Validate APR range
  if (tier.minApr < 0 || tier.minApr > 50) {
    errors.push(`${prefix}: minApr ${tier.minApr} out of reasonable range (0-50%)`);
  }
  if (tier.maxApr < tier.minApr) {
    errors.push(`${prefix}: maxApr ${tier.maxApr} is less than minApr ${tier.minApr}`);
  }
  if (tier.maxApr > 50) {
    errors.push(`${prefix}: maxApr ${tier.maxApr} exceeds reasonable limit (50%)`);
  }

  // Validate advance percentages
  if (tier.baseAdvancePercent < 50 || tier.baseAdvancePercent > 200) {
    errors.push(`${prefix}: baseAdvancePercent ${tier.baseAdvancePercent} out of range (50-200%)`);
  }
  if (tier.maxAdvancePercent < tier.baseAdvancePercent) {
    errors.push(`${prefix}: maxAdvancePercent less than baseAdvancePercent`);
  }

  // Validate LTV cap
  if (tier.maxLtvPercent < 80 || tier.maxLtvPercent > 200) {
    errors.push(`${prefix}: maxLtvPercent ${tier.maxLtvPercent} out of range (80-200%)`);
  }

  // Validate down payment requirement
  if (tier.minDownPercent < 0 || tier.minDownPercent > 50) {
    errors.push(`${prefix}: minDownPercent ${tier.minDownPercent} out of range (0-50%)`);
  }

  return errors;
}

/**
 * Validate vehicle restrictions
 */
function validateVehicleRestrictions(restrictions: VehicleRestrictions): string[] {
  const errors: string[] = [];

  if (restrictions.maxAgeYears < 1 || restrictions.maxAgeYears > 30) {
    errors.push(`Vehicle maxAgeYears ${restrictions.maxAgeYears} out of range (1-30)`);
  }
  if (restrictions.maxMileage < 10000 || restrictions.maxMileage > 300000) {
    errors.push(`Vehicle maxMileage ${restrictions.maxMileage} out of range (10k-300k)`);
  }

  return errors;
}

/**
 * Validate vehicle risk adjustment
 */
function validateRiskAdjustment(adj: VehicleRiskAdjustment, index: number): string[] {
  const errors: string[] = [];
  const prefix = `RiskAdjustment[${index}]`;

  if (!adj.make || adj.make.trim() === '') {
    errors.push(`${prefix}: make is required`);
  }
  if (adj.multiplier < 0.5 || adj.multiplier > 1.5) {
    errors.push(`${prefix}: multiplier ${adj.multiplier} out of range (0.5-1.5)`);
  }
  if (adj.yearRange) {
    if (adj.yearRange.start > adj.yearRange.end) {
      errors.push(`${prefix}: yearRange start > end`);
    }
    if (adj.yearRange.start < 1990 || adj.yearRange.end > 2030) {
      errors.push(`${prefix}: yearRange out of reasonable bounds`);
    }
  }

  return errors;
}

/**
 * Validate a complete lender schema
 */
export function validateLenderSchema(schema: LenderSchema): SchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!schema.id || schema.id.trim() === '') {
    errors.push('Lender id is required');
  }
  if (!schema.name || schema.name.trim() === '') {
    errors.push('Lender name is required');
  }
  if (!schema.version) {
    warnings.push('Lender version not specified');
  }

  // Validate loan parameters
  if (schema.minAmountFinanced < 0) {
    errors.push('minAmountFinanced cannot be negative');
  }
  if (schema.maxAmountFinanced < schema.minAmountFinanced) {
    errors.push('maxAmountFinanced must be >= minAmountFinanced');
  }
  if (schema.maxAmountFinanced > 200000) {
    warnings.push('maxAmountFinanced exceeds typical auto loan limit');
  }

  // Validate terms
  if (!schema.allowedTerms || schema.allowedTerms.length === 0) {
    errors.push('At least one allowed term is required');
  } else {
    for (const term of schema.allowedTerms) {
      if (term < 12 || term > 96) {
        errors.push(`Term ${term} out of range (12-96 months)`);
      }
    }
  }

  // Validate fees
  if (schema.lenderFeePercent < 0 || schema.lenderFeePercent > 10) {
    errors.push(`lenderFeePercent ${schema.lenderFeePercent} out of range (0-10%)`);
  }

  // Validate tiers
  if (!schema.tiers || schema.tiers.length === 0) {
    errors.push('At least one credit tier configuration is required');
  } else {
    const seenTiers = new Set<CreditTier>();
    schema.tiers.forEach((tier, index) => {
      if (seenTiers.has(tier.creditTier)) {
        errors.push(`Duplicate tier configuration for ${tier.creditTier}`);
      }
      seenTiers.add(tier.creditTier);
      errors.push(...validateTierConfig(tier, index));
    });
  }

  // Validate vehicle restrictions
  if (schema.vehicleRestrictions) {
    errors.push(...validateVehicleRestrictions(schema.vehicleRestrictions));
  }

  // Validate risk adjustments
  if (schema.vehicleRiskAdjustments) {
    schema.vehicleRiskAdjustments.forEach((adj, index) => {
      errors.push(...validateRiskAdjustment(adj, index));
    });
  }

  // Check for review flag
  if (schema.needsReview) {
    warnings.push('Configuration is flagged as needing review');
  }
  if (!schema.approved) {
    warnings.push('Configuration has not been approved for production use');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a default/template lender schema
 */
export function createDefaultLenderSchema(id: string, name: string): LenderSchema {
  return {
    id,
    name,
    version: '1.0.0',
    lastUpdated: new Date().toISOString().split('T')[0],
    active: true,
    approved: false,
    needsReview: true,

    allowedTerms: [36, 48, 60, 72],
    minAmountFinanced: 5000,
    maxAmountFinanced: 50000,
    maxBackendTotal: 3500,
    maxBackendPercent: 25,

    lenderFeePercent: 2.5,

    tiers: [
      {
        creditTier: 'deep_subprime',
        minApr: 22,
        maxApr: 28,
        minDownPercent: 10,
        baseAdvancePercent: 110,
        maxAdvancePercent: 140,
        maxLtvPercent: 140,
      },
      {
        creditTier: 'subprime',
        minApr: 18,
        maxApr: 24,
        minDownPercent: 8,
        baseAdvancePercent: 112,
        maxAdvancePercent: 142,
        maxLtvPercent: 140,
      },
      {
        creditTier: 'near_prime',
        minApr: 12,
        maxApr: 18,
        minDownPercent: 5,
        baseAdvancePercent: 108,
        maxAdvancePercent: 130,
        maxLtvPercent: 130,
      },
      {
        creditTier: 'prime',
        minApr: 8,
        maxApr: 12,
        minDownPercent: 0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 120,
        maxLtvPercent: 120,
      },
    ],

    vehicleRestrictions: {
      maxAgeYears: 15,
      maxMileage: 150000,
      excludedMakes: [],
    },

    vehicleRiskAdjustments: [],
  };
}

/**
 * Merge partial updates into an existing schema
 */
export function mergeLenderSchema(
  base: LenderSchema,
  updates: Partial<LenderSchema>
): LenderSchema {
  return {
    ...base,
    ...updates,
    // Preserve metadata and update timestamp
    lastUpdated: new Date().toISOString().split('T')[0],
    version: incrementVersion(base.version),
    // Deep merge arrays if both exist
    tiers: updates.tiers || base.tiers,
    vehicleRiskAdjustments: updates.vehicleRiskAdjustments || base.vehicleRiskAdjustments,
  };
}

/**
 * Increment a semver-style version string
 */
function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return '1.0.1';
  }
  parts[2]++; // Increment patch version
  return parts.join('.');
}

/**
 * Convert from the legacy LenderConfig format to the new LenderSchema
 */
export function fromLegacyConfig(legacy: {
  id: string;
  name: string;
  active: boolean;
  allowedTerms: number[];
  minAmountFinanced: number;
  maxAmountFinanced: number;
  maxBackendTotal: number;
  maxBackendPercentOfAmount: number;
  maxVehicleAgeYears: number;
  maxMiles: number;
  lenderFeePercent: number;
  pricingGrid: Array<{
    creditTier: CreditTier;
    minApr: number;
    maxApr: number;
    minDownPct: number;
    baseAdvancePercent: number;
    maxAdvancePercent: number;
    maxLtvPercent: number;
  }>;
  vehicleRestrictions: {
    maxAge: number;
    maxMileage: number;
    excludedMakes: string[];
  };
  vehiclePreferences: Array<{
    make: string;
    multiplier: number;
    reason?: string;
    yearRange?: { start: number; end: number };
  }>;
}): LenderSchema {
  return {
    id: legacy.id,
    name: legacy.name,
    version: '1.0.0',
    lastUpdated: new Date().toISOString().split('T')[0],
    active: legacy.active,
    approved: true, // Assume legacy configs are approved

    allowedTerms: legacy.allowedTerms,
    minAmountFinanced: legacy.minAmountFinanced,
    maxAmountFinanced: legacy.maxAmountFinanced,
    maxBackendTotal: legacy.maxBackendTotal,
    maxBackendPercent: legacy.maxBackendPercentOfAmount,

    lenderFeePercent: legacy.lenderFeePercent,

    tiers: legacy.pricingGrid.map(tier => ({
      creditTier: tier.creditTier,
      minApr: tier.minApr,
      maxApr: tier.maxApr,
      minDownPercent: tier.minDownPct * 100, // Convert decimal to percent
      baseAdvancePercent: tier.baseAdvancePercent,
      maxAdvancePercent: tier.maxAdvancePercent,
      maxLtvPercent: tier.maxLtvPercent,
    })),

    vehicleRestrictions: {
      maxAgeYears: legacy.vehicleRestrictions.maxAge,
      maxMileage: legacy.vehicleRestrictions.maxMileage,
      excludedMakes: legacy.vehicleRestrictions.excludedMakes,
    },

    vehicleRiskAdjustments: legacy.vehiclePreferences.map(pref => ({
      make: pref.make,
      multiplier: pref.multiplier,
      reason: pref.reason || 'Risk adjustment',
      yearRange: pref.yearRange,
    })),
  };
}

/**
 * Export types for external use
 */
export type { LenderSchema, LenderTierConfig, VehicleRestrictions, VehicleRiskAdjustment, LenderCustomRule };
