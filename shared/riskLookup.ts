// shared/riskLookup.ts
// Per-lender risk multipliers for vehicle advance calculations

import lenderRiskRules from '../data/lenderRiskRules.json';

type LenderRules = Record<string, number>;
type AllLenderRules = Record<string, LenderRules>;

const rules = lenderRiskRules as AllLenderRules;

/**
 * Get the risk multiplier for a specific lender/vehicle combination
 *
 * @param lenderKey - Lender identifier (e.g., 'uac', 'westlake', 'westernfunding')
 * @param make - Vehicle make (e.g., 'Honda', 'Toyota', 'Hyundai')
 * @param model - Vehicle model (e.g., 'Accord', 'Camry', 'Rogue')
 * @param year - Vehicle year
 * @param mileage - Vehicle mileage (optional, for low-mileage bonuses)
 * @returns Multiplier to apply to base advance (e.g., 0.85 = 15% reduction, 1.08 = 8% bonus)
 */
export function getRiskMultiplier(
  lenderKey: string,
  make: string,
  model: string = '',
  year: number,
  mileage: number = 0
): number {
  const lenderRules = rules[lenderKey.toLowerCase()];
  if (!lenderRules) {
    return 1.0; // Unknown lender, no adjustment
  }

  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase();
  const isLowMile = mileage > 0 && mileage < 50000;

  // Try specific make-model-year combinations first
  let key: string | null = null;

  // Hyundai/Kia 2011-2022 (engine issues)
  if ((makeLower === 'hyundai' || makeLower === 'kia') && year >= 2011 && year <= 2022) {
    key = `${makeLower}-2011-2022`;
  }
  // Nissan Rogue 2014-2020 (CVT issues)
  else if (makeLower === 'nissan' && modelLower.includes('rogue') && year >= 2014 && year <= 2020) {
    key = 'nissan-rogue-2014-2020';
  }
  // Nissan Altima 2013-2018 (CVT issues)
  else if (makeLower === 'nissan' && modelLower.includes('altima') && year >= 2013 && year <= 2018) {
    key = 'nissan-altima-2013-2018';
  }
  // Nissan Sentra (general CVT concerns)
  else if (makeLower === 'nissan' && modelLower.includes('sentra')) {
    key = 'nissan-sentra';
  }
  // Chevy Cruze
  else if (makeLower === 'chevrolet' || makeLower === 'chevy') {
    if (modelLower.includes('cruze')) {
      key = 'chevy-cruze';
    } else if (modelLower.includes('silverado')) {
      key = 'chevy-silverado';
    } else if (modelLower.includes('equinox') && year >= 2010 && year <= 2017) {
      key = 'chevy-equinox-2010-2017';
    }
  }
  // Honda older models
  else if (makeLower === 'honda') {
    if ((modelLower.includes('accord') || modelLower.includes('civic')) && year >= 1996 && year <= 2006) {
      key = `honda-${modelLower.includes('accord') ? 'accord' : 'civic'}-1996-2006`;
    } else {
      key = 'honda-any';
    }
  }
  // Ford models
  else if (makeLower === 'ford') {
    if (modelLower.includes('f-150') || modelLower.includes('f150')) {
      key = year >= 2006 ? 'ford-f150-2006+' : 'ford-f150';
    } else if (modelLower.includes('focus') && year >= 2012 && year <= 2018) {
      key = 'ford-focus-2012-2018';
    } else if (modelLower.includes('fiesta') && year >= 2011 && year <= 2019) {
      key = 'ford-fiesta-2011-2019';
    } else if (modelLower.includes('explorer')) {
      key = 'ford-explorer';
    }
  }
  // Jeep models
  else if (makeLower === 'jeep') {
    if (modelLower.includes('grand cherokee')) {
      key = 'jeep-grand-cherokee';
    } else if (modelLower.includes('compass') && year >= 2007 && year <= 2017) {
      key = 'jeep-compass-2007-2017';
    } else if (modelLower.includes('patriot')) {
      key = 'jeep-patriot';
    }
  }
  // Dodge models
  else if (makeLower === 'dodge') {
    if (modelLower.includes('charger') && year >= 2011 && year <= 2021) {
      key = 'dodge-charger-2011-2021';
    } else if (modelLower.includes('journey')) {
      key = 'dodge-journey';
    } else if (modelLower.includes('dart')) {
      key = 'dodge-dart';
    }
  }
  // Chrysler models
  else if (makeLower === 'chrysler') {
    if (modelLower.includes('200')) {
      key = 'chrysler-200';
    } else if (modelLower.includes('300') && year >= 2011) {
      key = 'chrysler-300-2011+';
    }
  }
  // Toyota - check for specific models first
  else if (makeLower === 'toyota') {
    if (modelLower.includes('camry')) {
      key = 'toyota-camry';
    } else if (modelLower.includes('corolla')) {
      key = 'toyota-corolla';
    } else {
      key = 'toyota-any';
    }
  }
  // Luxury makes with low mileage bonus
  else if (makeLower === 'lexus') {
    key = isLowMile ? 'lexus-lowmile' : 'lexus-any';
  }
  else if (makeLower === 'acura') {
    key = isLowMile ? 'acura-lowmile' : 'acura-any';
  }
  // Other makes with general rules
  else if (makeLower === 'subaru') {
    key = 'subaru-any';
  }
  else if (makeLower === 'mazda') {
    key = 'mazda-any';
  }
  else if (makeLower === 'bmw') {
    key = 'bmw-any';
  }
  else if (makeLower === 'mercedes' || makeLower === 'mercedes-benz') {
    key = 'mercedes-any';
  }
  else if (makeLower === 'audi') {
    key = 'audi-any';
  }
  else if (makeLower === 'volkswagen' || makeLower === 'vw') {
    key = 'vw-any';
  }
  else if (makeLower === 'mitsubishi') {
    key = 'mitsubishi-any';
  }

  // Look up the multiplier
  if (key && lenderRules[key] !== undefined) {
    return lenderRules[key];
  }

  // Fall back to default
  return lenderRules.default || 1.0;
}

/**
 * Get a human-readable explanation of the risk adjustment
 */
export function getRiskExplanation(
  lenderKey: string,
  make: string,
  model: string,
  year: number,
  multiplier: number
): string | null {
  if (multiplier === 1.0) return null;

  const adjustment = Math.round((1 - multiplier) * 100);
  const isReduction = multiplier < 1.0;

  // Generate explanation based on known issues
  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase();

  if ((makeLower === 'hyundai' || makeLower === 'kia') && year >= 2011 && year <= 2022) {
    return `${adjustment}% reduction: Theta II engine recall risk`;
  }
  if (makeLower === 'nissan' && (modelLower.includes('rogue') || modelLower.includes('altima') || modelLower.includes('sentra'))) {
    return `${adjustment}% reduction: CVT transmission concerns`;
  }
  if (makeLower === 'ford' && (modelLower.includes('focus') || modelLower.includes('fiesta'))) {
    return `${adjustment}% reduction: PowerShift transmission issues`;
  }
  if (makeLower === 'dodge' && modelLower.includes('dart')) {
    return `${adjustment}% reduction: Discontinued model, parts concerns`;
  }
  if (makeLower === 'jeep' && modelLower.includes('patriot')) {
    return `${adjustment}% reduction: Discontinued, reliability concerns`;
  }

  // Bonuses for reliable makes
  if (!isReduction) {
    const bonus = Math.round((multiplier - 1) * 100);
    if (makeLower === 'toyota' || makeLower === 'honda') {
      return `+${bonus}% bonus: High reliability, strong resale`;
    }
    if (makeLower === 'subaru') {
      return `+${bonus}% bonus: Strong resale, loyal customer base`;
    }
    if (makeLower === 'lexus' || makeLower === 'acura') {
      return `+${bonus}% bonus: Luxury reliability, low depreciation`;
    }
  }

  return isReduction
    ? `${adjustment}% reduction applied by ${lenderKey}`
    : `+${Math.round((multiplier - 1) * 100)}% bonus applied by ${lenderKey}`;
}

/**
 * Get all lender IDs that have risk rules defined
 */
export function getAvailableLenders(): string[] {
  return Object.keys(rules);
}

/**
 * Check if a lender has specific rules for a make
 */
export function hasLenderRulesFor(lenderKey: string, make: string): boolean {
  const lenderRules = rules[lenderKey.toLowerCase()];
  if (!lenderRules) return false;

  const makeLower = make.toLowerCase();
  return Object.keys(lenderRules).some(key => key.includes(makeLower));
}
