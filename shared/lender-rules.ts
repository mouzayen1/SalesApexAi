// shared/lender-rules.ts
// Lender Rules Engine - Eligibility restrictions and preference multipliers

// ============================================================================
// TYPES
// ============================================================================

export type RuleCode =
  | 'THEFT_RISK'
  | 'MODEL_RISK'
  | 'AGE_RISK'
  | 'MILEAGE_RISK'
  | 'EXCLUDED_MAKE'
  | 'EXCLUDED_MODEL'
  | 'BONUS_MAKE'
  | 'BONUS_MODEL'
  | 'BONUS_AGE'
  | 'BONUS_MILEAGE'
  | 'DEFAULT';

export interface RuleHit {
  lender: string;
  code: RuleCode;
  label: string;
  factor?: number;
  details?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: RuleHit[];
}

export interface MultiplierResult {
  factor: number;
  hits: RuleHit[];
}

export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  mileage: number;
}

// ============================================================================
// CONSTANTS / THRESHOLDS
// ============================================================================

const CURRENT_YEAR = new Date().getFullYear();

// Mileage thresholds
export const HIGH_MILEAGE_THRESHOLD = 100000; // For Silverado high-mile rule
export const LOW_MILEAGE_THRESHOLD = 50000;   // For Lexus low-mile bonus

// Age thresholds
export const RECENT_VEHICLE_MAX_AGE = 5; // "Recent" = 5 years old or less

// ============================================================================
// LENDER RESTRICTIONS CONFIGURATION
// ============================================================================

interface LenderRestrictions {
  maxAgeYears: number;
  maxMiles: number;
  excludedMakes: string[];
}

const LENDER_RESTRICTIONS: Record<string, LenderRestrictions> = {
  westlake: {
    maxAgeYears: 20,
    maxMiles: 180000,
    excludedMakes: ['Daewoo', 'Ferrari'],
  },
  western_funding: {
    maxAgeYears: 15,
    maxMiles: 180000,
    excludedMakes: ['Land Rover', 'Jaguar', 'Saab', 'Suzuki'],
  },
  uac: {
    maxAgeYears: 15,
    maxMiles: 150000,
    excludedMakes: ['Land Rover'],
  },
};

// ============================================================================
// PREFERENCE RULES CONFIGURATION
// ============================================================================

interface PreferenceRule {
  code: RuleCode;
  label: string;
  factor: number;
  match: (vehicle: VehicleInfo) => boolean;
}

// Helper to normalize make/model for comparison
function normalize(str: string): string {
  return str.toLowerCase().trim();
}

function makeIs(vehicle: VehicleInfo, make: string): boolean {
  return normalize(vehicle.make) === normalize(make);
}

function makeIsAny(vehicle: VehicleInfo, makes: string[]): boolean {
  return makes.some(m => normalize(vehicle.make) === normalize(m));
}

function modelIncludes(vehicle: VehicleInfo, model: string): boolean {
  return normalize(vehicle.model).includes(normalize(model));
}

function modelIsAny(vehicle: VehicleInfo, models: string[]): boolean {
  return models.some(m => normalize(vehicle.model).includes(normalize(m)));
}

function yearBetween(vehicle: VehicleInfo, minYear: number, maxYear: number): boolean {
  return vehicle.year >= minYear && vehicle.year <= maxYear;
}

function yearAtLeast(vehicle: VehicleInfo, minYear: number): boolean {
  return vehicle.year >= minYear;
}

function getVehicleAge(vehicle: VehicleInfo): number {
  return CURRENT_YEAR - vehicle.year;
}

function isHighMileage(vehicle: VehicleInfo): boolean {
  return vehicle.mileage >= HIGH_MILEAGE_THRESHOLD;
}

function isLowMileage(vehicle: VehicleInfo): boolean {
  return vehicle.mileage < LOW_MILEAGE_THRESHOLD;
}

function isRecentVehicle(vehicle: VehicleInfo): boolean {
  return getVehicleAge(vehicle) <= RECENT_VEHICLE_MAX_AGE;
}

// UAC Preference Rules
const UAC_PREFERENCE_RULES: PreferenceRule[] = [
  // Penalties
  {
    code: 'THEFT_RISK',
    label: 'Hyundai/Kia 2011-2022 Theft Risk',
    factor: 0.85,
    match: (v) => makeIsAny(v, ['Hyundai', 'Kia']) && yearBetween(v, 2011, 2022),
  },
  {
    code: 'MODEL_RISK',
    label: 'Nissan Rogue 2014-2020 Risk',
    factor: 0.95,
    match: (v) => makeIs(v, 'Nissan') && modelIncludes(v, 'Rogue') && yearBetween(v, 2014, 2020),
  },
  {
    code: 'MODEL_RISK',
    label: 'Chevy Cruze Model Risk',
    factor: 0.92,
    match: (v) => makeIsAny(v, ['Chevrolet', 'Chevy']) && modelIncludes(v, 'Cruze'),
  },
  // Bonuses
  {
    code: 'BONUS_MAKE',
    label: 'Honda/Toyota Bonus',
    factor: 1.05,
    match: (v) => makeIsAny(v, ['Honda', 'Toyota']),
  },
  {
    code: 'BONUS_MAKE',
    label: 'Subaru Bonus',
    factor: 1.08,
    match: (v) => makeIs(v, 'Subaru'),
  },
];

// Westlake Preference Rules
const WESTLAKE_PREFERENCE_RULES: PreferenceRule[] = [
  // Penalties
  {
    code: 'THEFT_RISK',
    label: 'Hyundai/Kia 2011-2022 Theft Risk',
    factor: 0.90,
    match: (v) => makeIsAny(v, ['Hyundai', 'Kia']) && yearBetween(v, 2011, 2022),
  },
  {
    code: 'MODEL_RISK',
    label: 'Ford F-150 2006+ Model Risk',
    factor: 0.92,
    match: (v) => makeIs(v, 'Ford') && modelIncludes(v, 'F-150') && yearAtLeast(v, 2006),
  },
  {
    code: 'MODEL_RISK',
    label: 'Dodge Charger 2011-2021 Risk',
    factor: 0.90,
    match: (v) => makeIs(v, 'Dodge') && modelIncludes(v, 'Charger') && yearBetween(v, 2011, 2021),
  },
  // Bonuses
  {
    code: 'BONUS_MAKE',
    label: 'Honda Bonus',
    factor: 1.08,
    match: (v) => makeIs(v, 'Honda'),
  },
  {
    code: 'BONUS_MODEL',
    label: 'Toyota Camry/Corolla Bonus',
    factor: 1.05,
    match: (v) => makeIs(v, 'Toyota') && modelIsAny(v, ['Camry', 'Corolla']),
  },
];

// Western Funding Preference Rules
const WESTERN_FUNDING_PREFERENCE_RULES: PreferenceRule[] = [
  // Penalties
  {
    code: 'THEFT_RISK',
    label: 'Hyundai 2011-2022 Theft Risk',
    factor: 0.88,
    match: (v) => makeIs(v, 'Hyundai') && yearBetween(v, 2011, 2022),
  },
  {
    code: 'MODEL_RISK',
    label: 'Jeep Grand Cherokee Model Risk',
    factor: 0.90,
    match: (v) => makeIs(v, 'Jeep') && modelIncludes(v, 'Grand Cherokee'),
  },
  {
    code: 'MILEAGE_RISK',
    label: 'Chevy Silverado High-Mileage Risk',
    factor: 0.92,
    match: (v) => makeIsAny(v, ['Chevrolet', 'Chevy']) && modelIncludes(v, 'Silverado') && isHighMileage(v),
  },
  // Bonuses
  {
    code: 'BONUS_MAKE',
    label: 'Toyota Bonus',
    factor: 1.06,
    match: (v) => makeIs(v, 'Toyota'),
  },
  {
    code: 'BONUS_MILEAGE',
    label: 'Lexus Low-Mileage Bonus',
    factor: 1.10,
    match: (v) => makeIs(v, 'Lexus') && isLowMileage(v),
  },
];

// United Auto Credit Preference Rules (separate from UAC above for clarity if needed)
const UNITED_AUTO_CREDIT_PREFERENCE_RULES: PreferenceRule[] = [
  // Penalties
  {
    code: 'THEFT_RISK',
    label: 'Kia 2011-2022 Theft Risk',
    factor: 0.90,
    match: (v) => makeIs(v, 'Kia') && yearBetween(v, 2011, 2022),
  },
  {
    code: 'AGE_RISK',
    label: 'Honda Accord/Civic 1996-2006 Age Risk',
    factor: 0.95,
    match: (v) => makeIs(v, 'Honda') && modelIsAny(v, ['Accord', 'Civic']) && yearBetween(v, 1996, 2006),
  },
  // Bonuses
  {
    code: 'BONUS_MAKE',
    label: 'Acura Bonus',
    factor: 1.05,
    match: (v) => makeIs(v, 'Acura'),
  },
  {
    code: 'BONUS_AGE',
    label: 'Recent Honda Bonus',
    factor: 1.03,
    match: (v) => makeIs(v, 'Honda') && isRecentVehicle(v),
  },
];

// Map lender IDs to their preference rules
const LENDER_PREFERENCE_RULES: Record<string, PreferenceRule[]> = {
  westlake: WESTLAKE_PREFERENCE_RULES,
  western_funding: WESTERN_FUNDING_PREFERENCE_RULES,
  uac: UAC_PREFERENCE_RULES,
  // Note: "uac" and "united_auto_credit" might be same lender
  // Using UAC rules for 'uac' ID as that's what's in lenders.ts
};

// ============================================================================
// ELIGIBILITY CHECK
// ============================================================================

/**
 * Check if a vehicle is eligible for a specific lender.
 * Returns eligibility status and any disqualifying rule hits.
 */
export function isEligible(lenderId: string, vehicle: VehicleInfo): EligibilityResult {
  const reasons: RuleHit[] = [];
  const restrictions = LENDER_RESTRICTIONS[lenderId];

  if (!restrictions) {
    // Lender not in our restrictions config - assume eligible by default
    return { eligible: true, reasons: [] };
  }

  const vehicleAge = getVehicleAge(vehicle);

  // Check max age
  if (vehicleAge > restrictions.maxAgeYears) {
    reasons.push({
      lender: lenderId,
      code: 'AGE_RISK',
      label: 'Vehicle Too Old',
      details: `Vehicle is ${vehicleAge} years old, max allowed is ${restrictions.maxAgeYears} years`,
    });
  }

  // Check max mileage
  if (vehicle.mileage > restrictions.maxMiles) {
    reasons.push({
      lender: lenderId,
      code: 'MILEAGE_RISK',
      label: 'Mileage Too High',
      details: `Vehicle has ${vehicle.mileage.toLocaleString()} miles, max allowed is ${restrictions.maxMiles.toLocaleString()} miles`,
    });
  }

  // Check excluded makes
  const normalizedMake = normalize(vehicle.make);
  const isExcludedMake = restrictions.excludedMakes.some(m => normalize(m) === normalizedMake);
  if (isExcludedMake) {
    reasons.push({
      lender: lenderId,
      code: 'EXCLUDED_MAKE',
      label: `${vehicle.make} Not Accepted`,
      details: `${vehicle.make} is on the excluded makes list for this lender`,
    });
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

// ============================================================================
// PREFERENCE MULTIPLIER CALCULATION
// ============================================================================

/**
 * Get the preference multiplier for a vehicle with a specific lender.
 * Returns the combined factor and all matching rule hits.
 *
 * Strategy: We apply ALL matching rules and multiply their factors together.
 * This means a vehicle could get both penalties and bonuses applied.
 * If conflicting (e.g., Honda penalty and Honda bonus), both apply.
 */
export function getPreferenceMultiplier(lenderId: string, vehicle: VehicleInfo): MultiplierResult {
  const rules = LENDER_PREFERENCE_RULES[lenderId];

  if (!rules || rules.length === 0) {
    return {
      factor: 1.0,
      hits: [{
        lender: lenderId,
        code: 'DEFAULT',
        label: 'Standard Rate',
        factor: 1.0,
      }],
    };
  }

  const hits: RuleHit[] = [];
  let combinedFactor = 1.0;

  for (const rule of rules) {
    if (rule.match(vehicle)) {
      hits.push({
        lender: lenderId,
        code: rule.code,
        label: rule.label,
        factor: rule.factor,
        details: `Factor: ${rule.factor}`,
      });
      combinedFactor *= rule.factor;
    }
  }

  // If no rules matched, return default
  if (hits.length === 0) {
    return {
      factor: 1.0,
      hits: [{
        lender: lenderId,
        code: 'DEFAULT',
        label: 'Standard Rate',
        factor: 1.0,
      }],
    };
  }

  return {
    factor: combinedFactor,
    hits,
  };
}

// ============================================================================
// COMBINED EVALUATION
// ============================================================================

export interface LenderEvaluation {
  lenderId: string;
  eligible: boolean;
  eligibilityReasons: RuleHit[];
  preferenceFactor: number;
  preferenceHits: RuleHit[];
  allHits: RuleHit[];
}

/**
 * Perform complete evaluation of a vehicle against a lender.
 * Returns eligibility, preference multiplier, and all rule hits.
 */
export function evaluateVehicleForLender(lenderId: string, vehicle: VehicleInfo): LenderEvaluation {
  const eligibility = isEligible(lenderId, vehicle);
  const preference = getPreferenceMultiplier(lenderId, vehicle);

  return {
    lenderId,
    eligible: eligibility.eligible,
    eligibilityReasons: eligibility.reasons,
    preferenceFactor: preference.factor,
    preferenceHits: preference.hits,
    allHits: [...eligibility.reasons, ...preference.hits],
  };
}

/**
 * Evaluate a vehicle against all known lenders.
 */
export function evaluateVehicleForAllLenders(vehicle: VehicleInfo): LenderEvaluation[] {
  const lenderIds = Object.keys(LENDER_RESTRICTIONS);
  return lenderIds.map(id => evaluateVehicleForLender(id, vehicle));
}

// ============================================================================
// BADGE DERIVATION HELPERS
// ============================================================================

/**
 * Check if any rule hits indicate theft risk.
 */
export function hasTheftRisk(hits: RuleHit[]): boolean {
  return hits.some(h => h.code === 'THEFT_RISK');
}

/**
 * Check if any rule hits indicate model-specific risk (non-theft).
 */
export function hasModelRisk(hits: RuleHit[]): boolean {
  return hits.some(h => h.code === 'MODEL_RISK');
}

/**
 * Check if any rule hits indicate mileage risk.
 */
export function hasMileageRisk(hits: RuleHit[]): boolean {
  return hits.some(h => h.code === 'MILEAGE_RISK');
}

/**
 * Check if any rule hits indicate age risk.
 */
export function hasAgeRisk(hits: RuleHit[]): boolean {
  return hits.some(h => h.code === 'AGE_RISK');
}

/**
 * Get all theft risk hits for display.
 */
export function getTheftRiskHits(hits: RuleHit[]): RuleHit[] {
  return hits.filter(h => h.code === 'THEFT_RISK');
}

/**
 * Get the worst (lowest) penalty factor from hits.
 */
export function getWorstPenaltyFactor(hits: RuleHit[]): number {
  const penalties = hits.filter(h => h.factor !== undefined && h.factor < 1.0);
  if (penalties.length === 0) return 1.0;
  return Math.min(...penalties.map(p => p.factor!));
}

/**
 * Get the best (highest) bonus factor from hits.
 */
export function getBestBonusFactor(hits: RuleHit[]): number {
  const bonuses = hits.filter(h => h.factor !== undefined && h.factor > 1.0);
  if (bonuses.length === 0) return 1.0;
  return Math.max(...bonuses.map(b => b.factor!));
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const _testHelpers = {
  normalize,
  makeIs,
  makeIsAny,
  modelIncludes,
  modelIsAny,
  yearBetween,
  yearAtLeast,
  getVehicleAge,
  isHighMileage,
  isLowMileage,
  isRecentVehicle,
  CURRENT_YEAR,
};
