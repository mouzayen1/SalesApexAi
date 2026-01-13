/**
 * Book Value Estimation Module
 *
 * This module provides book value estimates for LTV calculations.
 *
 * IMPORTANT: LTV (Loan-to-Value) should be calculated against book/wholesale value,
 * NOT against retail selling price. This is because:
 * 1. Book value represents actual market value if vehicle is repossessed
 * 2. Lenders use book value to assess their collateral risk
 * 3. Retail price includes dealer markup which doesn't reflect liquidation value
 *
 * Phase 1 (Current): Deterministic estimation based on vehicle attributes
 * Phase 2 (Future): Accept injected values from Black Book, Finance Source, etc.
 */

import { roundCents, clamp } from './money';
import type { BookValueInput, VehicleInfo } from './types';

/**
 * Vehicle class affects depreciation and value estimation
 */
export type VehicleClass =
  | 'economy'       // Small cars, compacts
  | 'midsize'       // Mid-size sedans
  | 'fullsize'      // Full-size sedans, large SUVs
  | 'luxury'        // Premium brands
  | 'truck'         // Pickup trucks
  | 'suv'           // SUVs (non-luxury)
  | 'sports'        // Sports cars
  | 'van'           // Minivans, cargo vans
  | 'other';

/**
 * Make classification for depreciation adjustments
 */
interface MakeProfile {
  class: VehicleClass;
  depreciationModifier: number;  // 1.0 = average, >1 = depreciates faster
  residualStrength: number;      // 1.0 = average resale value retention
}

// Make profiles based on typical depreciation patterns
const MAKE_PROFILES: Record<string, MakeProfile> = {
  // Strong residual (Japanese brands)
  toyota: { class: 'midsize', depreciationModifier: 0.85, residualStrength: 1.15 },
  honda: { class: 'midsize', depreciationModifier: 0.85, residualStrength: 1.12 },
  lexus: { class: 'luxury', depreciationModifier: 0.90, residualStrength: 1.10 },
  acura: { class: 'luxury', depreciationModifier: 0.90, residualStrength: 1.05 },
  subaru: { class: 'suv', depreciationModifier: 0.88, residualStrength: 1.08 },
  mazda: { class: 'midsize', depreciationModifier: 0.92, residualStrength: 1.02 },

  // Average residual (American trucks strong, cars weaker)
  ford: { class: 'truck', depreciationModifier: 0.95, residualStrength: 1.00 },
  chevrolet: { class: 'truck', depreciationModifier: 0.98, residualStrength: 0.98 },
  gmc: { class: 'truck', depreciationModifier: 0.95, residualStrength: 1.00 },
  ram: { class: 'truck', depreciationModifier: 0.95, residualStrength: 1.02 },
  dodge: { class: 'midsize', depreciationModifier: 1.05, residualStrength: 0.92 },
  jeep: { class: 'suv', depreciationModifier: 0.95, residualStrength: 1.02 },

  // Weaker residual (higher depreciation)
  hyundai: { class: 'economy', depreciationModifier: 1.05, residualStrength: 0.92 },
  kia: { class: 'economy', depreciationModifier: 1.05, residualStrength: 0.92 },
  nissan: { class: 'midsize', depreciationModifier: 1.08, residualStrength: 0.90 },
  chrysler: { class: 'midsize', depreciationModifier: 1.15, residualStrength: 0.85 },
  mitsubishi: { class: 'economy', depreciationModifier: 1.12, residualStrength: 0.88 },

  // European luxury (high initial depreciation)
  bmw: { class: 'luxury', depreciationModifier: 1.15, residualStrength: 0.88 },
  mercedes: { class: 'luxury', depreciationModifier: 1.12, residualStrength: 0.90 },
  'mercedes-benz': { class: 'luxury', depreciationModifier: 1.12, residualStrength: 0.90 },
  audi: { class: 'luxury', depreciationModifier: 1.15, residualStrength: 0.88 },
  volkswagen: { class: 'midsize', depreciationModifier: 1.10, residualStrength: 0.90 },
  volvo: { class: 'luxury', depreciationModifier: 1.08, residualStrength: 0.92 },

  // Korean brands (improving but still moderate)
  genesis: { class: 'luxury', depreciationModifier: 1.02, residualStrength: 0.95 },
};

/**
 * Default profile for unknown makes
 */
const DEFAULT_PROFILE: MakeProfile = {
  class: 'midsize',
  depreciationModifier: 1.0,
  residualStrength: 1.0,
};

/**
 * Get make profile (case-insensitive lookup)
 */
function getMakeProfile(make: string): MakeProfile {
  const normalized = make.toLowerCase().trim();
  return MAKE_PROFILES[normalized] || DEFAULT_PROFILE;
}

/**
 * Standard depreciation curve parameters
 * Based on typical vehicle depreciation patterns
 */
const DEPRECIATION_PARAMS = {
  // Annual depreciation rates by year
  year1: 0.20,  // 20% first year
  year2: 0.15,  // 15% second year
  year3: 0.12,  // 12% third year
  years4to5: 0.10, // 10% per year
  years6to10: 0.08, // 8% per year
  years11plus: 0.05, // 5% per year

  // Mileage depreciation (per 1000 miles over/under standard)
  mileageDepreciationPer1k: 0.002, // 0.2% per 1000 miles deviation
  standardMilesPerYear: 12000,

  // Floor value (minimum book value as % of original MSRP)
  floorPercent: 0.15, // Book value won't go below 15% of original
};

/**
 * Estimate original MSRP based on current retail price and vehicle age.
 * This is used when we don't have historical MSRP data.
 */
function estimateOriginalMsrp(retailPrice: number, vehicleAge: number, profile: MakeProfile): number {
  // Work backwards from current retail to estimate original value
  let estimatedOriginal = retailPrice;

  // Reverse the depreciation (approximate)
  for (let year = vehicleAge; year > 0; year--) {
    let rate: number;
    if (year === 1) rate = DEPRECIATION_PARAMS.year1;
    else if (year === 2) rate = DEPRECIATION_PARAMS.year2;
    else if (year === 3) rate = DEPRECIATION_PARAMS.year3;
    else if (year <= 5) rate = DEPRECIATION_PARAMS.years4to5;
    else if (year <= 10) rate = DEPRECIATION_PARAMS.years6to10;
    else rate = DEPRECIATION_PARAMS.years11plus;

    rate *= profile.depreciationModifier;
    estimatedOriginal = estimatedOriginal / (1 - rate);
  }

  return roundCents(estimatedOriginal);
}

/**
 * Calculate standard depreciation factor based on vehicle age and mileage.
 *
 * @param vehicleAge - Age in years
 * @param mileage - Current odometer reading
 * @param profile - Make-specific depreciation profile
 * @returns Depreciation factor (0 to 1, where 1 = no depreciation)
 */
function calculateDepreciationFactor(
  vehicleAge: number,
  mileage: number,
  profile: MakeProfile
): number {
  let factor = 1.0;

  // Apply year-based depreciation
  for (let year = 1; year <= vehicleAge; year++) {
    let rate: number;
    if (year === 1) rate = DEPRECIATION_PARAMS.year1;
    else if (year === 2) rate = DEPRECIATION_PARAMS.year2;
    else if (year === 3) rate = DEPRECIATION_PARAMS.year3;
    else if (year <= 5) rate = DEPRECIATION_PARAMS.years4to5;
    else if (year <= 10) rate = DEPRECIATION_PARAMS.years6to10;
    else rate = DEPRECIATION_PARAMS.years11plus;

    // Apply make-specific modifier
    rate *= profile.depreciationModifier;

    factor *= (1 - rate);
  }

  // Apply mileage adjustment
  const expectedMiles = vehicleAge * DEPRECIATION_PARAMS.standardMilesPerYear;
  const mileageDiff = mileage - expectedMiles;
  const mileageAdjustment = (mileageDiff / 1000) * DEPRECIATION_PARAMS.mileageDepreciationPer1k;

  // Mileage can add or subtract from value
  factor -= mileageAdjustment;

  // Apply residual strength modifier
  factor *= profile.residualStrength;

  // Ensure minimum floor
  return clamp(factor, DEPRECIATION_PARAMS.floorPercent, 1.0);
}

/**
 * Estimate book (wholesale) value for a vehicle.
 *
 * The book value is typically 80-90% of retail value for recent vehicles,
 * with the gap widening for older/higher-mileage vehicles.
 *
 * @param vehicle - Vehicle information
 * @returns Estimated book value data
 */
export function estimateBookValue(vehicle: VehicleInfo): BookValueInput {
  const currentYear = new Date().getFullYear();
  const vehicleAge = Math.max(0, currentYear - vehicle.year);
  const profile = getMakeProfile(vehicle.make);

  // Estimate original MSRP
  const estimatedOriginalMsrp = estimateOriginalMsrp(vehicle.retailPrice, vehicleAge, profile);

  // Calculate depreciation factor
  const depreciationFactor = calculateDepreciationFactor(vehicleAge, vehicle.mileage, profile);

  // Retail guide value (what a buyer might pay at a dealer)
  const retailValue = roundCents(estimatedOriginalMsrp * depreciationFactor);

  // Wholesale/book value (what dealer pays at auction, typically 80-90% of retail)
  // This percentage decreases with age/mileage
  const wholesalePercent = vehicleAge <= 3
    ? 0.88  // Newer vehicles: 88% of retail
    : vehicleAge <= 6
    ? 0.85  // 4-6 years: 85%
    : vehicleAge <= 10
    ? 0.82  // 7-10 years: 82%
    : 0.78; // Older: 78%

  // Cap retail value to actual retail price (book estimates shouldn't exceed actual retail)
  const cappedRetailValue = Math.min(retailValue, vehicle.retailPrice);
  const wholesaleValue = roundCents(cappedRetailValue * wholesalePercent);

  // Adjusted value accounts for condition (we assume "average" for estimates)
  const adjustedValue = wholesaleValue;

  return {
    source: 'estimated',
    wholesaleValue,
    retailValue: cappedRetailValue,
    adjustedValue,
    asOfDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Calculate the wholesale-to-retail ratio for a vehicle.
 * Useful for understanding the spread between book and retail.
 */
export function getWholesaleToRetailRatio(vehicle: VehicleInfo): number {
  const bookValue = estimateBookValue(vehicle);
  if (vehicle.retailPrice <= 0) return 0;
  return roundCents(bookValue.wholesaleValue / vehicle.retailPrice * 100) / 100;
}

/**
 * Estimate minimum book value based on vehicle attributes.
 * Used as a floor when actual book values seem unreasonably low.
 */
export function getMinimumBookValue(vehicle: VehicleInfo): number {
  const profile = getMakeProfile(vehicle.make);
  const estimatedOriginal = estimateOriginalMsrp(vehicle.retailPrice, 0, profile);
  return roundCents(estimatedOriginal * DEPRECIATION_PARAMS.floorPercent);
}

/**
 * Validate an externally provided book value for reasonableness.
 */
export interface BookValueValidation {
  isReasonable: boolean;
  warnings: string[];
  suggestedRange: { min: number; max: number };
}

export function validateExternalBookValue(
  providedValue: number,
  vehicle: VehicleInfo
): BookValueValidation {
  const estimate = estimateBookValue(vehicle);
  const warnings: string[] = [];

  // Calculate reasonable range (20% deviation from estimate)
  const minReasonable = roundCents(estimate.wholesaleValue * 0.80);
  const maxReasonable = roundCents(estimate.wholesaleValue * 1.20);

  let isReasonable = true;

  if (providedValue < minReasonable) {
    warnings.push(`Book value $${providedValue} is ${Math.round((1 - providedValue / estimate.wholesaleValue) * 100)}% below estimated value`);
    isReasonable = false;
  }

  if (providedValue > maxReasonable) {
    warnings.push(`Book value $${providedValue} is ${Math.round((providedValue / estimate.wholesaleValue - 1) * 100)}% above estimated value`);
    isReasonable = false;
  }

  // Book value should never exceed retail
  if (providedValue > vehicle.retailPrice) {
    warnings.push('Book value exceeds retail price');
    isReasonable = false;
  }

  return {
    isReasonable,
    warnings,
    suggestedRange: { min: minReasonable, max: maxReasonable },
  };
}

/**
 * Get the appropriate book value to use for LTV calculations.
 * Prefers provided book value if reasonable, falls back to estimate.
 *
 * @param vehicle - Vehicle information
 * @param provided - Externally provided book value (optional)
 */
export function getBookValueForLtv(
  vehicle: VehicleInfo,
  provided?: BookValueInput
): BookValueInput {
  // If no external value provided, use estimate
  if (!provided) {
    return estimateBookValue(vehicle);
  }

  // Validate the provided value
  const validation = validateExternalBookValue(provided.wholesaleValue, vehicle);

  // If provided value is unreasonable, log warning but still use it
  // (External sources may have data we don't have)
  if (!validation.isReasonable) {
    console.warn(`Book value validation warnings for ${vehicle.make} ${vehicle.year}:`, validation.warnings);
  }

  return provided;
}
