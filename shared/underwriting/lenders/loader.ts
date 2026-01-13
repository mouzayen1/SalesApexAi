/**
 * Lender Configuration Loader
 *
 * Loads lender configurations from JSON files with validation.
 * Supports both approved and unreviewed configs (behind feature flag).
 */

import type { LenderSchema, CreditTier } from '../types';
import { validateLenderSchema } from './schema';

// Import JSON configs statically for bundling
import westlakeConfig from './config/westlake.json';
import westernFundingConfig from './config/westernFunding.json';
import uacConfig from './config/uac.json';

/**
 * Environment flag to allow unreviewed configs
 * Default: false (only approved configs loaded)
 */
const ALLOW_UNREVIEWED = process.env.ALLOW_UNREVIEWED_LENDER_CONFIGS === 'true';

/**
 * All available lender configurations
 */
const ALL_CONFIGS: LenderSchema[] = [
  westlakeConfig as unknown as LenderSchema,
  westernFundingConfig as unknown as LenderSchema,
  uacConfig as unknown as LenderSchema,
];

/**
 * Cache for validated configs
 */
let cachedConfigs: LenderSchema[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Load all lender configurations with validation.
 *
 * @param options - Loading options
 * @returns Array of validated lender configurations
 */
export interface LoaderOptions {
  includeInactive?: boolean;     // Include inactive lenders
  includeUnreviewed?: boolean;   // Include unreviewed configs (requires env flag)
  validateOnly?: boolean;        // Don't cache, just validate
}

export function loadLenderConfigs(options: LoaderOptions = {}): LenderSchema[] {
  const { includeInactive = false, includeUnreviewed = false, validateOnly = false } = options;

  // Check cache
  const now = Date.now();
  if (!validateOnly && cachedConfigs && (now - cacheTimestamp) < CACHE_TTL) {
    return filterConfigs(cachedConfigs, includeInactive, includeUnreviewed);
  }

  // Load and validate all configs
  const validConfigs: LenderSchema[] = [];

  for (const config of ALL_CONFIGS) {
    const validation = validateLenderSchema(config);

    if (!validation.isValid) {
      console.error(`Invalid lender config for ${config.id}:`, validation.errors);
      continue;
    }

    if (validation.warnings.length > 0) {
      console.warn(`Lender config warnings for ${config.id}:`, validation.warnings);
    }

    validConfigs.push(config);
  }

  // Cache if not validate-only
  if (!validateOnly) {
    cachedConfigs = validConfigs;
    cacheTimestamp = now;
  }

  return filterConfigs(validConfigs, includeInactive, includeUnreviewed);
}

/**
 * Filter configs based on options
 */
function filterConfigs(
  configs: LenderSchema[],
  includeInactive: boolean,
  includeUnreviewed: boolean
): LenderSchema[] {
  return configs.filter(config => {
    // Filter inactive
    if (!includeInactive && !config.active) {
      return false;
    }

    // Filter unreviewed/unapproved
    if (!includeUnreviewed && !ALLOW_UNREVIEWED) {
      if (config.needsReview || !config.approved) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get a specific lender config by ID
 */
export function getLenderConfigById(id: string): LenderSchema | undefined {
  const configs = loadLenderConfigs({ includeInactive: true, includeUnreviewed: true });
  return configs.find(c => c.id === id);
}

/**
 * Get tier configuration for a specific credit tier
 */
export function getLenderTierConfig(
  lender: LenderSchema,
  creditTier: CreditTier
) {
  return lender.tiers.find(t => t.creditTier === creditTier);
}

/**
 * Get all lender IDs
 */
export function getAvailableLenderIds(): string[] {
  return loadLenderConfigs().map(c => c.id);
}

/**
 * Check if a lender supports a specific credit tier
 */
export function lenderSupportsTier(lender: LenderSchema, creditTier: CreditTier): boolean {
  return lender.tiers.some(t => t.creditTier === creditTier);
}

/**
 * Get vehicle risk adjustment multiplier for a specific vehicle/lender combo
 */
export function getVehicleRiskMultiplier(
  lender: LenderSchema,
  make: string,
  model: string,
  year: number
): { multiplier: number; reason?: string } {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();

  for (const adj of lender.vehicleRiskAdjustments) {
    const makeMatches = adj.make.toLowerCase() === normalizedMake;
    if (!makeMatches) continue;

    // If model is specified, check model match
    if (adj.model) {
      const modelMatches = normalizedModel.includes(adj.model.toLowerCase());
      if (!modelMatches) continue;
    }

    // Check year range if specified
    if (adj.yearRange) {
      if (year < adj.yearRange.start || year > adj.yearRange.end) {
        continue;
      }
    }

    return { multiplier: adj.multiplier, reason: adj.reason };
  }

  // No specific adjustment found
  return { multiplier: 1.0 };
}

/**
 * Check if a vehicle is eligible for a lender
 */
export interface VehicleEligibilityResult {
  eligible: boolean;
  reasons: string[];
  riskMultiplier: number;
  riskReason?: string;
}

export function checkVehicleEligibility(
  lender: LenderSchema,
  make: string,
  model: string,
  year: number,
  mileage: number
): VehicleEligibilityResult {
  const reasons: string[] = [];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - year;

  // Check age restriction
  if (vehicleAge > lender.vehicleRestrictions.maxAgeYears) {
    reasons.push(`Vehicle too old: ${vehicleAge} years (max ${lender.vehicleRestrictions.maxAgeYears})`);
  }

  // Check mileage restriction
  if (mileage > lender.vehicleRestrictions.maxMileage) {
    reasons.push(`Mileage too high: ${mileage.toLocaleString()} (max ${lender.vehicleRestrictions.maxMileage.toLocaleString()})`);
  }

  // Check excluded makes
  const normalizedMake = make.toLowerCase().trim();
  const isExcluded = lender.vehicleRestrictions.excludedMakes.some(
    excluded => excluded.toLowerCase() === normalizedMake
  );
  if (isExcluded) {
    reasons.push(`${make} not eligible with ${lender.name}`);
  }

  // Get risk multiplier
  const { multiplier, reason } = getVehicleRiskMultiplier(lender, make, model, year);

  return {
    eligible: reasons.length === 0,
    reasons,
    riskMultiplier: multiplier,
    riskReason: reason,
  };
}

/**
 * Clear the config cache (useful for testing or dynamic reloading)
 */
export function clearConfigCache(): void {
  cachedConfigs = null;
  cacheTimestamp = 0;
}

/**
 * Get config validation summary for all lenders
 */
export function validateAllConfigs(): Map<string, { isValid: boolean; errors: string[]; warnings: string[] }> {
  const results = new Map();

  for (const config of ALL_CONFIGS) {
    const validation = validateLenderSchema(config);
    results.set(config.id, validation);
  }

  return results;
}
