// shared/lender-programs.ts
// Comprehensive 2026 lender program data, state fees, product pricing
// Config-driven - values can be calibrated with real data

// ============================================================================
// STATE CONFIGURATION (Tax rates, fees, APR caps)
// ============================================================================

export interface StateConfig {
  code: string;
  name: string;
  salesTaxRate: number;
  docFeeCap: number;
  registrationFee: number;
  deliveryFee: number;
  aprCap: number;  // Max APR allowed by state law
  notes?: string;
}

export const STATE_CONFIGS: Record<string, StateConfig> = {
  TX: {
    code: 'TX',
    name: 'Texas',
    salesTaxRate: 0.0625,
    docFeeCap: 150,
    registrationFee: 75,
    deliveryFee: 0,
    aprCap: 30.0,
  },
  CA: {
    code: 'CA',
    name: 'California',
    salesTaxRate: 0.0725,
    docFeeCap: 85,
    registrationFee: 200,
    deliveryFee: 0,
    aprCap: 25.0,
  },
  FL: {
    code: 'FL',
    name: 'Florida',
    salesTaxRate: 0.06,
    docFeeCap: 799,
    registrationFee: 225,
    deliveryFee: 0,
    aprCap: 30.0,
  },
  NY: {
    code: 'NY',
    name: 'New York',
    salesTaxRate: 0.08,
    docFeeCap: 75,
    registrationFee: 50,
    deliveryFee: 0,
    aprCap: 25.0,
  },
  AZ: {
    code: 'AZ',
    name: 'Arizona',
    salesTaxRate: 0.056,
    docFeeCap: 499,
    registrationFee: 150,
    deliveryFee: 0,
    aprCap: 36.0,
  },
  GA: {
    code: 'GA',
    name: 'Georgia',
    salesTaxRate: 0.04,
    docFeeCap: 699,
    registrationFee: 20,
    deliveryFee: 0,
    aprCap: 30.0,
  },
  NV: {
    code: 'NV',
    name: 'Nevada',
    salesTaxRate: 0.0685,
    docFeeCap: 699,
    registrationFee: 33,
    deliveryFee: 0,
    aprCap: 30.0,
  },
  CO: {
    code: 'CO',
    name: 'Colorado',
    salesTaxRate: 0.029,
    docFeeCap: 699,
    registrationFee: 50,
    deliveryFee: 0,
    aprCap: 21.0,
  },
};

// Default state for unknown states
export const DEFAULT_STATE_CONFIG: StateConfig = {
  code: 'DEFAULT',
  name: 'Default',
  salesTaxRate: 0.07,
  docFeeCap: 500,
  registrationFee: 100,
  deliveryFee: 0,
  aprCap: 30.0,
};

// ============================================================================
// VEHICLE AGE FACTORS (Book value depreciation by age)
// ============================================================================

export interface AgeFactor {
  ageYears: number;
  factor: number;
}

// Depreciation curve - multiply retail by this factor
export const AGE_FACTORS: AgeFactor[] = [
  { ageYears: 0, factor: 1.00 },
  { ageYears: 1, factor: 0.95 },
  { ageYears: 2, factor: 0.90 },
  { ageYears: 3, factor: 0.85 },
  { ageYears: 4, factor: 0.80 },
  { ageYears: 5, factor: 0.75 },
  { ageYears: 6, factor: 0.70 },
  { ageYears: 7, factor: 0.65 },
  { ageYears: 8, factor: 0.60 },
  { ageYears: 9, factor: 0.55 },
  { ageYears: 10, factor: 0.50 },
  { ageYears: 11, factor: 0.45 },
  { ageYears: 12, factor: 0.40 },
  { ageYears: 13, factor: 0.35 },
  { ageYears: 14, factor: 0.30 },
  { ageYears: 15, factor: 0.25 },
];

export function getAgeFactor(vehicleYear: number): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - vehicleYear;
  const entry = AGE_FACTORS.find(f => f.ageYears === age);
  if (entry) return entry.factor;
  // Extrapolate for older vehicles
  if (age > 15) return Math.max(0.15, 0.25 - (age - 15) * 0.02);
  return 1.0;
}

// ============================================================================
// MILEAGE UTILIZATION FACTORS
// ============================================================================

export interface MileageUtilization {
  mileageMin: number;
  mileageMax: number;
  factor: number;
}

export const MILEAGE_UTILIZATION: MileageUtilization[] = [
  { mileageMin: 0, mileageMax: 15000, factor: 1.05 },      // Low mileage bonus
  { mileageMin: 15001, mileageMax: 30000, factor: 1.02 },
  { mileageMin: 30001, mileageMax: 50000, factor: 1.00 },  // Standard
  { mileageMin: 50001, mileageMax: 75000, factor: 0.97 },
  { mileageMin: 75001, mileageMax: 100000, factor: 0.93 },
  { mileageMin: 100001, mileageMax: 125000, factor: 0.88 },
  { mileageMin: 125001, mileageMax: 150000, factor: 0.82 },
  { mileageMin: 150001, mileageMax: 180000, factor: 0.75 },
  { mileageMin: 180001, mileageMax: Infinity, factor: 0.65 },
];

export function getMileageUtilization(mileage: number): number {
  const entry = MILEAGE_UTILIZATION.find(
    m => mileage >= m.mileageMin && mileage <= m.mileageMax
  );
  return entry?.factor || 0.65;
}

// ============================================================================
// MAKE MULTIPLIERS (Base reliability/desirability factors)
// ============================================================================

export interface MakeMultiplier {
  make: string;
  multiplier: number;
  category: 'premium' | 'mainstream' | 'economy' | 'luxury' | 'high_risk';
}

export const MAKE_MULTIPLIERS: MakeMultiplier[] = [
  // Premium reliable brands
  { make: 'Toyota', multiplier: 1.08, category: 'premium' },
  { make: 'Honda', multiplier: 1.07, category: 'premium' },
  { make: 'Lexus', multiplier: 1.10, category: 'luxury' },
  { make: 'Acura', multiplier: 1.05, category: 'premium' },
  { make: 'Subaru', multiplier: 1.06, category: 'premium' },
  { make: 'Mazda', multiplier: 1.04, category: 'premium' },

  // Mainstream brands
  { make: 'Ford', multiplier: 1.00, category: 'mainstream' },
  { make: 'Chevrolet', multiplier: 0.98, category: 'mainstream' },
  { make: 'GMC', multiplier: 0.99, category: 'mainstream' },
  { make: 'Ram', multiplier: 0.98, category: 'mainstream' },
  { make: 'Buick', multiplier: 0.97, category: 'mainstream' },
  { make: 'Volkswagen', multiplier: 0.96, category: 'mainstream' },

  // Economy brands (higher risk)
  { make: 'Nissan', multiplier: 0.94, category: 'economy' },
  { make: 'Hyundai', multiplier: 0.92, category: 'economy' },
  { make: 'Kia', multiplier: 0.92, category: 'economy' },
  { make: 'Mitsubishi', multiplier: 0.88, category: 'economy' },

  // Luxury brands
  { make: 'BMW', multiplier: 0.95, category: 'luxury' },
  { make: 'Mercedes-Benz', multiplier: 0.94, category: 'luxury' },
  { make: 'Audi', multiplier: 0.95, category: 'luxury' },
  { make: 'Infiniti', multiplier: 0.93, category: 'luxury' },
  { make: 'Cadillac', multiplier: 0.92, category: 'luxury' },
  { make: 'Lincoln', multiplier: 0.93, category: 'luxury' },
  { make: 'Volvo', multiplier: 0.94, category: 'luxury' },

  // High maintenance/risk luxury
  { make: 'Land Rover', multiplier: 0.80, category: 'high_risk' },
  { make: 'Jaguar', multiplier: 0.82, category: 'high_risk' },
  { make: 'Maserati', multiplier: 0.75, category: 'high_risk' },
  { make: 'Alfa Romeo', multiplier: 0.78, category: 'high_risk' },

  // Domestic
  { make: 'Dodge', multiplier: 0.93, category: 'mainstream' },
  { make: 'Chrysler', multiplier: 0.91, category: 'mainstream' },
  { make: 'Jeep', multiplier: 0.94, category: 'mainstream' },

  // Asian mainstream
  { make: 'Kia', multiplier: 0.92, category: 'economy' },
];

export function getMakeMultiplier(make: string): number {
  const normalized = make.trim().toLowerCase();
  const entry = MAKE_MULTIPLIERS.find(
    m => m.make.toLowerCase() === normalized
  );
  return entry?.multiplier || 0.95; // Default for unknown makes
}

// ============================================================================
// SEASONAL MULTIPLIERS
// ============================================================================

export function getSeasonalMultiplier(): number {
  const month = new Date().getMonth(); // 0-11
  // Summer months (May-Aug) typically see higher values
  if (month >= 4 && month <= 7) return 1.02;
  // Tax refund season (Feb-Apr) also strong
  if (month >= 1 && month <= 3) return 1.01;
  // Year-end typically slower
  if (month >= 10) return 0.98;
  return 1.00;
}

// ============================================================================
// PRODUCT PRICING (GAP & VSC)
// ============================================================================

export interface ProductPricing {
  product: 'gap' | 'vsc';
  tier: string;
  dealerCost: number;
  retailPrice: number;
  commission: number;
}

export const GAP_PRICING: Record<string, ProductPricing> = {
  standard: {
    product: 'gap',
    tier: 'standard',
    dealerCost: 250,
    retailPrice: 900,
    commission: 650,
  },
  premium: {
    product: 'gap',
    tier: 'premium',
    dealerCost: 350,
    retailPrice: 1200,
    commission: 850,
  },
};

export const VSC_PRICING: Record<string, ProductPricing> = {
  basic: {
    product: 'vsc',
    tier: 'basic',
    dealerCost: 400,
    retailPrice: 1200,
    commission: 800,
  },
  standard: {
    product: 'vsc',
    tier: 'standard',
    dealerCost: 600,
    retailPrice: 1800,
    commission: 1200,
  },
  premium: {
    product: 'vsc',
    tier: 'premium',
    dealerCost: 900,
    retailPrice: 2500,
    commission: 1600,
  },
};

// ============================================================================
// LENDER PROGRAM DEFINITIONS (2026)
// ============================================================================

export interface FicoTier {
  name: string;
  minFico: number;
  maxFico: number;
  baseAPR: number;
  maxLTV: number;
  maxPTI: number;
  maxDTI: number;
  minDownPercent: number;
  baseAdvancePercent: number;
  maxAdvancePercent: number;
}

export interface LenderProgram {
  id: string;
  lenderId: string;
  name: string;
  active: boolean;

  // Eligibility
  minFico: number;
  maxFico: number;
  maxVehicleAge: number;
  maxMileage: number;
  minAmountFinanced: number;
  maxAmountFinanced: number;

  // Make exclusions
  excludedMakes: string[];

  // Terms
  allowedTerms: number[];
  maxTerm: number;

  // Backend limits
  maxBackendTotal: number;
  maxBackendPercent: number;
  maxGAP: number;
  maxVSC: number;

  // Fees
  acquisitionFee: number;
  lenderFeePercent: number;

  // FICO-based tiers
  ficoTiers: FicoTier[];

  // Special conditions
  requiresStipulations?: string[];
  notes?: string;
}

// Westlake Financial Programs
export const WESTLAKE_PROGRAMS: LenderProgram[] = [
  {
    id: 'westlake_standard',
    lenderId: 'westlake',
    name: 'Westlake Standard',
    active: true,
    minFico: 500,
    maxFico: 850,
    maxVehicleAge: 20,
    maxMileage: 180000,
    minAmountFinanced: 5000,
    maxAmountFinanced: 45000,
    excludedMakes: ['Daewoo', 'Ferrari', 'Lamborghini', 'Bentley', 'Rolls-Royce'],
    allowedTerms: [36, 48, 60, 72],
    maxTerm: 72,
    maxBackendTotal: 3500,
    maxBackendPercent: 25,
    maxGAP: 1200,
    maxVSC: 2500,
    acquisitionFee: 595,
    lenderFeePercent: 3.0,
    ficoTiers: [
      {
        name: 'Deep Subprime',
        minFico: 500,
        maxFico: 549,
        baseAPR: 24.99,
        maxLTV: 145,
        maxPTI: 20,
        maxDTI: 50,
        minDownPercent: 15,
        baseAdvancePercent: 115,
        maxAdvancePercent: 140,
      },
      {
        name: 'Subprime',
        minFico: 550,
        maxFico: 649,
        baseAPR: 21.99,
        maxLTV: 140,
        maxPTI: 18,
        maxDTI: 50,
        minDownPercent: 10,
        baseAdvancePercent: 115,
        maxAdvancePercent: 140,
      },
      {
        name: 'Near Prime',
        minFico: 650,
        maxFico: 699,
        baseAPR: 15.99,
        maxLTV: 130,
        maxPTI: 15,
        maxDTI: 45,
        minDownPercent: 5,
        baseAdvancePercent: 110,
        maxAdvancePercent: 130,
      },
      {
        name: 'Prime',
        minFico: 700,
        maxFico: 850,
        baseAPR: 9.99,
        maxLTV: 120,
        maxPTI: 12,
        maxDTI: 40,
        minDownPercent: 0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 120,
      },
    ],
  },
];

// Western Funding Programs
export const WESTERN_FUNDING_PROGRAMS: LenderProgram[] = [
  {
    id: 'western_standard',
    lenderId: 'western_funding',
    name: 'Western Funding Standard',
    active: true,
    minFico: 450,
    maxFico: 850,
    maxVehicleAge: 15,
    maxMileage: 180000,
    minAmountFinanced: 4000,
    maxAmountFinanced: 40000,
    excludedMakes: ['Land Rover', 'Jaguar', 'Saab', 'Suzuki', 'Smart', 'Fisker'],
    allowedTerms: [48, 60, 72, 84],
    maxTerm: 84,
    maxBackendTotal: 4000,
    maxBackendPercent: 30,
    maxGAP: 1200,
    maxVSC: 3000,
    acquisitionFee: 495,
    lenderFeePercent: 2.5,
    ficoTiers: [
      {
        name: 'Deep Subprime',
        minFico: 450,
        maxFico: 549,
        baseAPR: 26.99,
        maxLTV: 150,
        maxPTI: 22,
        maxDTI: 55,
        minDownPercent: 12,
        baseAdvancePercent: 120,
        maxAdvancePercent: 150,
      },
      {
        name: 'Subprime',
        minFico: 550,
        maxFico: 649,
        baseAPR: 22.99,
        maxLTV: 145,
        maxPTI: 20,
        maxDTI: 50,
        minDownPercent: 8,
        baseAdvancePercent: 115,
        maxAdvancePercent: 145,
      },
      {
        name: 'Near Prime',
        minFico: 650,
        maxFico: 699,
        baseAPR: 16.99,
        maxLTV: 135,
        maxPTI: 18,
        maxDTI: 45,
        minDownPercent: 5,
        baseAdvancePercent: 110,
        maxAdvancePercent: 135,
      },
      {
        name: 'Prime',
        minFico: 700,
        maxFico: 850,
        baseAPR: 11.99,
        maxLTV: 125,
        maxPTI: 15,
        maxDTI: 40,
        minDownPercent: 0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 125,
      },
    ],
  },
];

// UAC (United Auto Credit) Programs
export const UAC_PROGRAMS: LenderProgram[] = [
  {
    id: 'uac_standard',
    lenderId: 'uac',
    name: 'UAC Standard',
    active: true,
    minFico: 480,
    maxFico: 850,
    maxVehicleAge: 15,
    maxMileage: 150000,
    minAmountFinanced: 5000,
    maxAmountFinanced: 50000,
    excludedMakes: ['Land Rover', 'Jaguar', 'Maserati', 'Alfa Romeo'],
    allowedTerms: [36, 48, 60, 72],
    maxTerm: 72,
    maxBackendTotal: 3000,
    maxBackendPercent: 20,
    maxGAP: 1000,
    maxVSC: 2200,
    acquisitionFee: 495,
    lenderFeePercent: 2.0,
    ficoTiers: [
      {
        name: 'Deep Subprime',
        minFico: 480,
        maxFico: 549,
        baseAPR: 25.99,
        maxLTV: 140,
        maxPTI: 20,
        maxDTI: 50,
        minDownPercent: 12,
        baseAdvancePercent: 115,
        maxAdvancePercent: 140,
      },
      {
        name: 'Subprime',
        minFico: 550,
        maxFico: 649,
        baseAPR: 21.99,
        maxLTV: 135,
        maxPTI: 18,
        maxDTI: 48,
        minDownPercent: 10,
        baseAdvancePercent: 112,
        maxAdvancePercent: 135,
      },
      {
        name: 'Near Prime',
        minFico: 650,
        maxFico: 699,
        baseAPR: 16.99,
        maxLTV: 125,
        maxPTI: 16,
        maxDTI: 45,
        minDownPercent: 5,
        baseAdvancePercent: 108,
        maxAdvancePercent: 125,
      },
      {
        name: 'Prime',
        minFico: 700,
        maxFico: 850,
        baseAPR: 11.99,
        maxLTV: 120,
        maxPTI: 14,
        maxDTI: 40,
        minDownPercent: 0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 120,
      },
    ],
  },
];

// All lender programs
export const ALL_LENDER_PROGRAMS: LenderProgram[] = [
  ...WESTLAKE_PROGRAMS,
  ...WESTERN_FUNDING_PROGRAMS,
  ...UAC_PROGRAMS,
];

// ============================================================================
// VEHICLE RISK DATABASE (for specific make/model/year penalties)
// ============================================================================

export interface VehicleRiskEntry {
  make: string;
  model?: string;  // If undefined, applies to all models of make
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  riskType: 'theft' | 'reliability' | 'depreciation' | 'parts';
  multiplier: number;
  lenders?: string[];  // If undefined, applies to all lenders
  notes?: string;
}

export const VEHICLE_RISK_DATABASE: VehicleRiskEntry[] = [
  // Hyundai/Kia theft risk (2011-2022 models without immobilizers)
  {
    make: 'Hyundai',
    yearMin: 2011,
    yearMax: 2022,
    riskType: 'theft',
    multiplier: 0.88,
    notes: 'Missing immobilizer - high theft risk (Kia Boys)',
  },
  {
    make: 'Kia',
    yearMin: 2011,
    yearMax: 2022,
    riskType: 'theft',
    multiplier: 0.88,
    notes: 'Missing immobilizer - high theft risk (Kia Boys)',
  },

  // Nissan Rogue CVT issues
  {
    make: 'Nissan',
    model: 'Rogue',
    yearMin: 2014,
    yearMax: 2020,
    riskType: 'reliability',
    multiplier: 0.94,
    notes: 'CVT transmission reliability concerns',
  },

  // Chevy Cruze
  {
    make: 'Chevrolet',
    model: 'Cruze',
    riskType: 'reliability',
    multiplier: 0.92,
    notes: 'Turbo and cooling system issues',
  },

  // Ford F-150 EcoBoost
  {
    make: 'Ford',
    model: 'F-150',
    yearMin: 2006,
    riskType: 'depreciation',
    multiplier: 0.95,
    lenders: ['westlake'],
    notes: 'High volume model - depreciation adjustment',
  },

  // Dodge Charger theft risk
  {
    make: 'Dodge',
    model: 'Charger',
    yearMin: 2011,
    yearMax: 2021,
    riskType: 'theft',
    multiplier: 0.90,
    lenders: ['westlake'],
    notes: 'High theft target',
  },

  // Jeep Grand Cherokee
  {
    make: 'Jeep',
    model: 'Grand Cherokee',
    riskType: 'reliability',
    multiplier: 0.92,
    lenders: ['western_funding'],
    notes: 'Electrical and transmission concerns',
  },

  // High-mileage truck penalty
  {
    make: 'Chevrolet',
    model: 'Silverado',
    mileageMin: 100000,
    riskType: 'depreciation',
    multiplier: 0.92,
    lenders: ['western_funding'],
    notes: 'High-mileage truck depreciation',
  },

  // Honda Accord/Civic old model penalty
  {
    make: 'Honda',
    model: 'Accord',
    yearMin: 1996,
    yearMax: 2006,
    riskType: 'theft',
    multiplier: 0.95,
    notes: 'Older Honda high theft risk',
  },
  {
    make: 'Honda',
    model: 'Civic',
    yearMin: 1996,
    yearMax: 2006,
    riskType: 'theft',
    multiplier: 0.95,
    notes: 'Older Honda high theft risk',
  },
];

// ============================================================================
// VEHICLE BONUS DATABASE (reliability/desirability bonuses)
// ============================================================================

export interface VehicleBonusEntry {
  make: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  bonusType: 'reliability' | 'low_miles' | 'demand' | 'resale';
  multiplier: number;
  lenders?: string[];
  notes?: string;
}

export const VEHICLE_BONUS_DATABASE: VehicleBonusEntry[] = [
  // Toyota/Honda general bonus
  {
    make: 'Toyota',
    bonusType: 'reliability',
    multiplier: 1.05,
    lenders: ['uac', 'western_funding'],
    notes: 'High reliability track record',
  },
  {
    make: 'Honda',
    bonusType: 'reliability',
    multiplier: 1.05,
    lenders: ['uac'],
    notes: 'High reliability track record',
  },

  // Westlake Honda bonus
  {
    make: 'Honda',
    bonusType: 'reliability',
    multiplier: 1.08,
    lenders: ['westlake'],
    notes: 'Westlake preferred make',
  },

  // Toyota Camry/Corolla specific
  {
    make: 'Toyota',
    model: 'Camry',
    bonusType: 'demand',
    multiplier: 1.05,
    lenders: ['westlake'],
    notes: 'High resale value',
  },
  {
    make: 'Toyota',
    model: 'Corolla',
    bonusType: 'demand',
    multiplier: 1.05,
    lenders: ['westlake'],
    notes: 'High resale value',
  },

  // Subaru bonus
  {
    make: 'Subaru',
    bonusType: 'reliability',
    multiplier: 1.08,
    lenders: ['uac'],
    notes: 'Strong reliability and resale',
  },

  // Lexus low-mileage bonus
  {
    make: 'Lexus',
    mileageMax: 50000,
    bonusType: 'low_miles',
    multiplier: 1.10,
    lenders: ['western_funding'],
    notes: 'Low-mileage luxury bonus',
  },

  // Acura bonus
  {
    make: 'Acura',
    bonusType: 'reliability',
    multiplier: 1.05,
    notes: 'Honda luxury reliability',
  },

  // Recent Honda bonus
  {
    make: 'Honda',
    yearMin: new Date().getFullYear() - 5,
    bonusType: 'reliability',
    multiplier: 1.03,
    notes: 'Recent model year bonus',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getStateConfig(stateCode: string): StateConfig {
  return STATE_CONFIGS[stateCode.toUpperCase()] || DEFAULT_STATE_CONFIG;
}

export function getLenderPrograms(lenderId: string): LenderProgram[] {
  return ALL_LENDER_PROGRAMS.filter(p => p.lenderId === lenderId && p.active);
}

export function getFicoTier(program: LenderProgram, fico: number): FicoTier | null {
  return program.ficoTiers.find(t => fico >= t.minFico && fico <= t.maxFico) || null;
}

export function getVehicleRiskMultiplier(
  make: string,
  model: string,
  year: number,
  mileage: number,
  lenderId?: string
): { multiplier: number; entries: VehicleRiskEntry[] } {
  const matchingEntries = VEHICLE_RISK_DATABASE.filter(entry => {
    // Make match
    if (entry.make.toLowerCase() !== make.toLowerCase()) return false;

    // Model match (if specified)
    if (entry.model && !model.toLowerCase().includes(entry.model.toLowerCase())) return false;

    // Year range match
    if (entry.yearMin && year < entry.yearMin) return false;
    if (entry.yearMax && year > entry.yearMax) return false;

    // Mileage range match
    if (entry.mileageMin && mileage < entry.mileageMin) return false;
    if (entry.mileageMax && mileage > entry.mileageMax) return false;

    // Lender match (if specified)
    if (entry.lenders && lenderId && !entry.lenders.includes(lenderId)) return false;

    return true;
  });

  // Multiply all matching risk factors
  const combinedMultiplier = matchingEntries.reduce(
    (mult, entry) => mult * entry.multiplier,
    1.0
  );

  return { multiplier: combinedMultiplier, entries: matchingEntries };
}

export function getVehicleBonusMultiplier(
  make: string,
  model: string,
  year: number,
  mileage: number,
  lenderId?: string
): { multiplier: number; entries: VehicleBonusEntry[] } {
  const currentYear = new Date().getFullYear();

  const matchingEntries = VEHICLE_BONUS_DATABASE.filter(entry => {
    // Make match
    if (entry.make.toLowerCase() !== make.toLowerCase()) return false;

    // Model match (if specified)
    if (entry.model && !model.toLowerCase().includes(entry.model.toLowerCase())) return false;

    // Year range match
    if (entry.yearMin && year < entry.yearMin) return false;
    if (entry.yearMax && year > entry.yearMax) return false;

    // Mileage match
    if (entry.mileageMax && mileage > entry.mileageMax) return false;

    // Lender match (if specified)
    if (entry.lenders && lenderId && !entry.lenders.includes(lenderId)) return false;

    return true;
  });

  // Use best bonus (don't stack all bonuses)
  const bestMultiplier = matchingEntries.reduce(
    (best, entry) => Math.max(best, entry.multiplier),
    1.0
  );

  return { multiplier: bestMultiplier, entries: matchingEntries };
}
