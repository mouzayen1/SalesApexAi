/**
 * Underwriting Engine Types
 *
 * Core type definitions for the deterministic calculation engine.
 * These types define the contract for inputs/outputs across the system.
 */

// Credit tier definitions - must match existing system
export type CreditTier = 'deep_subprime' | 'subprime' | 'near_prime' | 'prime';

// Credit tier FICO ranges (for reference and validation)
export const CREDIT_TIER_RANGES: Record<CreditTier, { min: number; max: number }> = {
  deep_subprime: { min: 300, max: 549 },
  subprime: { min: 550, max: 619 },
  near_prime: { min: 620, max: 679 },
  prime: { min: 680, max: 850 },
};

/**
 * Vehicle information for underwriting
 */
export interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  mileage: number;
  retailPrice: number;  // Selling price (what customer pays before tax/fees)
  dealerCost: number;   // What dealer paid for the vehicle
  vin?: string;
}

/**
 * Book value input - can be injected from guide services or estimated
 */
export interface BookValueInput {
  source: 'estimated' | 'black_book' | 'finance_source' | 'manual';
  wholesaleValue: number;  // Base book value for LTV calculations
  retailValue: number;     // Retail guide value (if available)
  adjustedValue?: number;  // After mileage/condition adjustments
  asOfDate?: string;       // ISO date string
}

/**
 * Deal structure inputs
 */
export interface DealStructure {
  downPayment: number;
  tradeAllowance: number;
  tradePayoff: number;
  taxRate: number;         // As decimal (0.09 = 9%)
  fees: number;            // Doc + DMV + misc fees
  backendProducts: {
    gap: boolean;
    gapPrice: number;
    vsc: boolean;
    vscPrice: number;
    otherTotal: number;
  };
}

/**
 * Customer profile for underwriting
 */
export interface CustomerProfile {
  creditTier: CreditTier;
  ficoScore?: number;
  monthlyIncome?: number;
  timeOnJob?: number;      // Months
  timeAtResidence?: number; // Months
}

/**
 * Complete underwriting input
 */
export interface UnderwritingInput {
  vehicle: VehicleInfo;
  bookValue?: BookValueInput;
  dealStructure: DealStructure;
  customer: CustomerProfile;
  targetPayment?: number;
  paymentTolerance?: number;
  preferredTerm?: number;
}

/**
 * Lender tier pricing configuration
 */
export interface LenderTierConfig {
  creditTier: CreditTier;
  minApr: number;
  maxApr: number;
  buyRate?: number;        // Dealer buy rate (for reserve calculations)
  minDownPercent: number;  // Minimum down payment as percentage of price
  baseAdvancePercent: number;
  maxAdvancePercent: number;
  maxLtvPercent: number;   // Max LTV based on book value
}

/**
 * Vehicle restriction rules for a lender
 */
export interface VehicleRestrictions {
  maxAgeYears: number;
  maxMileage: number;
  minYear?: number;
  excludedMakes: string[];
  excludedModels?: string[];
}

/**
 * Vehicle risk adjustment (multiplier applied to advance)
 */
export interface VehicleRiskAdjustment {
  make: string;
  model?: string;          // Optional - if not specified, applies to all models
  yearRange?: { start: number; end: number };
  multiplier: number;      // 1.0 = no change, 0.85 = 15% reduction
  reason: string;
}

/**
 * Complete lender configuration schema
 */
export interface LenderSchema {
  id: string;
  name: string;
  version: string;         // Schema version for tracking changes
  lastUpdated: string;     // ISO date
  active: boolean;
  approved: boolean;       // Set to true after human review

  // Loan parameters
  allowedTerms: number[];
  minAmountFinanced: number;
  maxAmountFinanced: number;
  maxBackendTotal: number;
  maxBackendPercent: number;

  // Fee structure
  lenderFeePercent: number;
  docFee?: number;
  acquisitionFee?: number;

  // Credit tier configurations
  tiers: LenderTierConfig[];

  // Vehicle eligibility
  vehicleRestrictions: VehicleRestrictions;
  vehicleRiskAdjustments: VehicleRiskAdjustment[];

  // Additional validation rules (expressed as constraints)
  customRules?: LenderCustomRule[];

  // Metadata
  notes?: string[];
  source?: string;         // Where the matrix data came from
  needsReview?: boolean;   // Flagged by Groq extractor
}

/**
 * Custom validation rule (for complex lender-specific requirements)
 */
export interface LenderCustomRule {
  id: string;
  description: string;
  condition: 'min_down_amount' | 'max_payment' | 'dti_ratio' | 'pti_ratio' | 'custom';
  value: number;
  creditTiers?: CreditTier[]; // If specified, rule only applies to these tiers
}

/**
 * Calculation trace for debugging/auditing
 */
export interface CalculationTrace {
  timestamp: string;
  lenderId: string;

  // Input values captured
  retailPrice: number;
  bookValueUsed: number;
  bookValueSource: string;

  // Intermediate calculations
  taxableAmount: number;
  taxAmount: number;
  grossCapCost: number;
  netCapCost: number;
  amountFinanced: number;

  // LTV calculation
  computedLtv: number;
  lenderLtvCap: number;
  ltvPassed: boolean;

  // Advance calculation
  baseAdvance: number;
  maxAdvanceByCost: number;
  maxAdvanceByLtv: number;
  grossAdvance: number;
  lenderFee: number;
  netAdvance: number;

  // Risk adjustments
  vehicleMultiplier: number;
  vehicleMultiplierReason?: string;

  // Final results
  payment: number;
  netCheckToDealer: number;
}

/**
 * Deal candidate result (matches existing DealCandidate interface)
 */
export interface DealResult {
  lenderId: string;
  lenderName: string;
  termMonths: number;
  apr: number;
  amountFinanced: number;
  payment: number;
  netCheckToDealer: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  dealerProfit: number;
  totalDown: number;
  backendTotal: number;
  ltv: number;
  withinGuidelines: boolean;
  reasons: string[];
  adjustments: string[];

  // Product info
  hasGap: boolean;
  hasVsc: boolean;
  smartNote: string;
  optimizationLevel: 'optimal' | 'vsc_stripped' | 'all_stripped';

  // Vehicle eligibility
  vehicleWarnings: string[];
  advanceMultiplier: number;

  // PTI validation
  ptiPercent: number | null;
  ptiWarning: string | null;
  ptiExceedsLimit: boolean;
  requiredIncome: number | null;

  // Debug trace (optional, behind flag)
  trace?: CalculationTrace;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  isUpsideDown: boolean;
  ltvPercent: number;
  isOutOfWarranty: boolean;
  outOfWarrantyReason: 'age' | 'mileage' | 'both' | null;
  vehicleAgeYears: number;
  vehicleMileage: number;
  recommendGap: boolean;
  recommendVsc: boolean;
}

/**
 * Engine configuration flags
 */
export interface EngineConfig {
  enableTracing?: boolean;       // Include calculation trace in results
  allowUnreviewedConfigs?: boolean; // Allow lender configs not yet approved
  scoringVersion?: 'v1' | 'v2';  // v1 = netCheck only, v2 = weighted scoring
}

/**
 * Complete engine result
 */
export interface EngineResult {
  bestDeal: DealResult | null;
  allCandidates: DealResult[];
  riskAssessment: RiskAssessment;
  engineVersion: string;
  calculatedAt: string;
}
