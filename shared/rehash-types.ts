// shared/rehash-types.ts
// Comprehensive type definitions for the dealer-grade rehash engine

// ============================================================================
// RULE HIT TYPES - Auditable outputs for every adjustment/rejection
// ============================================================================

export type RuleHitCode =
  | 'AGE_RISK'
  | 'MILEAGE_RISK'
  | 'EXCLUDED_MAKE'
  | 'EXCLUDED_MODEL'
  | 'MODEL_RISK'
  | 'HIGH_THEFT_RISK'
  | 'BONUS_RELIABILITY'
  | 'BONUS_LOW_MILES'
  | 'BONUS_RECENT_MODEL'
  | 'LTV_EXCEEDED'
  | 'PTI_EXCEEDED'
  | 'DTI_EXCEEDED'
  | 'AMOUNT_BELOW_MIN'
  | 'AMOUNT_ABOVE_MAX'
  | 'TERM_NOT_ALLOWED'
  | 'FICO_BELOW_MIN'
  | 'INCOME_INSUFFICIENT'
  | 'STATE_APR_CAPPED'
  | 'BACKEND_CAPPED'
  | 'ADVANCE_ADJUSTED'
  | 'DEFAULT';

export interface RuleHit {
  code: RuleHitCode;
  lender: string;
  program?: string;
  label: string;
  factor?: number;
  delta?: number;  // For additive adjustments
  details?: string;
  source?: 'pdf' | 'config' | 'override' | 'calculated';
}

export interface RulesResult {
  eligible: boolean;
  ruleHits: RuleHit[];
  advanceMultiplierDelta: number;  // Cumulative multiplier adjustment
  approvalProbabilityDelta: number;  // -1.0 to +1.0
  reasons: string[];  // Human-readable explanations
}

// ============================================================================
// VEHICLE & CUSTOMER INPUT TYPES
// ============================================================================

export interface VehicleInput {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  vin?: string;
  retailPrice: number;  // Selling price
  dealerCost: number;   // ACV/invoice
  color?: string;
  bodyStyle?: string;
}

export interface CustomerInput {
  fico: number;
  monthlyGrossIncome: number;
  monthlyDebtPayments?: number;  // For DTI calculation
  employmentMonths?: number;
  residenceMonths?: number;
  bankruptcyHistory?: boolean;
  repoHistory?: boolean;
}

export interface TradeInput {
  allowance: number;  // Trade-in value
  payoff: number;     // Amount owed on trade
}

export interface ProductSelection {
  gap: boolean;
  gapTier?: 'standard' | 'premium';
  vsc: boolean;
  vscTier?: 'basic' | 'standard' | 'premium';
  otherProductsTotal?: number;
}

export interface DealInput {
  // Core identifiers
  dealId?: string;
  timestamp?: number;

  // Location
  state: string;
  dealerTier?: 'A' | 'B' | 'C' | 'D';

  // Vehicle
  vehicle: VehicleInput;

  // Customer
  customer: CustomerInput;

  // Trade
  trade?: TradeInput;

  // Deal structure
  downPayment: number;
  products: ProductSelection;

  // Preferences
  preferredTerm?: number;
  preferredLender?: string;
  maxPayment?: number;

  // Constraints
  constraints?: DealConstraints;
}

export interface DealConstraints {
  minFrontGross?: number;
  minNetCheck?: number;
  maxDownPayment?: number;
  maxPayment?: number;
  minDownPayment?: number;
  allowPriceReduction?: boolean;
  maxPriceReduction?: number;
  allowedLenders?: string[];
  excludedLenders?: string[];
}

// ============================================================================
// CALCULATION OUTPUT TYPES
// ============================================================================

export interface BookValueResult {
  baseValue: number;
  ageFactor: number;
  mileageUtilization: number;
  makeMultiplier: number;
  seasonalMultiplier: number;
  finalBookValue: number;
  calculationSteps: string[];
}

export interface AmountFinancedBreakdown {
  retailPrice: number;
  salesTax: number;
  docFee: number;
  registrationFee: number;
  deliveryFee: number;
  gapCost: number;
  vscCost: number;
  otherProducts: number;
  acquisitionFee: number;
  grossAmount: number;
  tradeEquity: number;
  totalDown: number;
  amountFinanced: number;
}

export interface APRCalculation {
  baseTierRate: number;
  ficoAdjustment: number;
  ltvAdjustment: number;
  downPaymentAdjustment: number;
  lenderAdjustment: number;
  riskAdjustment: number;
  rawAPR: number;
  stateCapAPR: number;
  finalAPR: number;
  calculationSteps: string[];
}

export interface PaymentCalculation {
  amountFinanced: number;
  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalOfPayments: number;
}

export interface LenderEvaluation {
  lenderId: string;
  lenderName: string;
  program: string;
  eligible: boolean;
  ruleHits: RuleHit[];

  // Calculated values
  bookValue?: number;
  ltv?: number;
  pti?: number;
  dti?: number;

  // Advance calculation
  baseAdvancePercent?: number;
  adjustedAdvancePercent?: number;
  grossAdvance?: number;
  lenderFees?: number;
  netAdvance?: number;

  // Final deal metrics
  apr?: number;
  termMonths?: number;
  payment?: number;
  netCheckToDealer?: number;
  dealerProfit?: number;

  // Rejection reasons
  rejectionReasons?: string[];
}

export interface DealerProfitBreakdown {
  frontGross: number;        // Price - Cost
  backEndGross: number;      // Product profit
  reserveIncome: number;     // Rate markup income
  totalGross: number;
  packDeduction: number;     // Dealer pack
  netProfit: number;
}

// ============================================================================
// REHASH ACTIONS & OPTIMIZATION
// ============================================================================

export type RehashActionType =
  | 'INCREASE_DOWN'
  | 'DECREASE_DOWN'
  | 'ADD_GAP'
  | 'REMOVE_GAP'
  | 'ADD_VSC'
  | 'REMOVE_VSC'
  | 'UPGRADE_VSC'
  | 'DOWNGRADE_VSC'
  | 'EXTEND_TERM'
  | 'SHORTEN_TERM'
  | 'REDUCE_PRICE'
  | 'SWITCH_LENDER'
  | 'SWITCH_PROGRAM';

export interface RehashAction {
  type: RehashActionType;
  field: string;
  fromValue: number | string | boolean;
  toValue: number | string | boolean;
  impact: {
    paymentDelta?: number;
    profitDelta?: number;
    ltvDelta?: number;
    approvalDelta?: number;
  };
  reason: string;
}

export interface CandidateDeal {
  lender: LenderEvaluation;
  amountFinanced: AmountFinancedBreakdown;
  payment: PaymentCalculation;
  profit: DealerProfitBreakdown;

  // Optimization metadata
  score: number;
  actionsFromOriginal: RehashAction[];
  ruleHits: RuleHit[];

  // Approval confidence
  approvalProbability: number;
  approvalConfidence: 'high' | 'medium' | 'low';
}

export interface RehashResult {
  // Input echo
  originalInput: DealInput;

  // Best recommended deal
  bestDeal: CandidateDeal | null;

  // Alternative options (2-3)
  alternatives: CandidateDeal[];

  // All evaluated but rejected
  rejectedDeals: LenderEvaluation[];

  // What changed from original
  requiredActions: RehashAction[];

  // Aggregate rule hits
  allRuleHits: RuleHit[];

  // Warnings and notes
  warnings: string[];
  missingInputs: string[];

  // Processing metadata
  processingTimeMs: number;
  candidatesEvaluated: number;
}

// ============================================================================
// CALIBRATION TYPES
// ============================================================================

export interface CalibrationConfig {
  version: string;
  lastUpdated: number;

  // Per-lender adjustments
  lenderAdjustments: Record<string, LenderCalibration>;

  // Per-state overrides
  stateOverrides: Record<string, StateCalibration>;

  // Make/model multiplier overrides
  vehicleOverrides: VehicleCalibration[];
}

export interface LenderCalibration {
  lenderId: string;
  advanceMultiplier: number;  // 1.0 = no change
  feeAdjustment: number;      // Additive
  aprAdjustment: number;      // Additive
  source: string;
  notes?: string;
}

export interface StateCalibration {
  state: string;
  docFeeOverride?: number;
  regFeeOverride?: number;
  taxRateOverride?: number;
  aprCapOverride?: number;
  source: string;
}

export interface VehicleCalibration {
  make: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  multiplierOverride: number;
  source: string;
  notes?: string;
}

export interface CalibrationResidual {
  field: string;
  expected: number;
  actual: number;
  residual: number;
  percentError: number;
  suggestedAdjustment?: number;
}

export interface CalibrationAnalysis {
  dealId: string;
  residuals: CalibrationResidual[];
  overallAccuracy: number;
  suggestedCalibrationUpdates: Partial<CalibrationConfig>;
  withinTolerances: boolean;
}

// ============================================================================
// VALIDATION TOLERANCES (from PDF spec)
// ============================================================================

export interface ValidationTolerances {
  bookValuePercent: number;      // ±2%
  amountFinancedDollars: number; // $100
  paymentDollars: number;        // ±$5/month
  aprPercent: number;            // ±0.5%
  netCheckPercent: number;       // ±2%
}

export const DEFAULT_TOLERANCES: ValidationTolerances = {
  bookValuePercent: 0.02,
  amountFinancedDollars: 100,
  paymentDollars: 5,
  aprPercent: 0.005,
  netCheckPercent: 0.02,
};

// ============================================================================
// GROQ AI INTEGRATION TYPES
// ============================================================================

export interface ParsedDealSheet {
  input: DealInput;
  confidence: number;  // 0.0 - 1.0
  missingFields: string[];
  assumedValues: Array<{
    field: string;
    value: number | string;
    reason: string;
  }>;
  parseWarnings: string[];
}

export interface DealExplanation {
  dealerMemo: string;
  customerExplanation: string;
  keyPoints: string[];
  riskFactors: string[];
  recommendations: string[];
}

export interface AnomalyDetection {
  hasAnomalies: boolean;
  anomalies: Array<{
    field: string;
    value: number;
    expected: string;
    severity: 'warning' | 'error';
    explanation: string;
  }>;
}

// ============================================================================
// LEGACY COMPATIBILITY (for existing code)
// ============================================================================

// Re-export types that existing code might use
export type { RuleHit as LegacyRuleHit };

// Helper to convert from legacy DealInput format
export function fromLegacyDealInput(legacy: {
  vehicleYear: number;
  vehicleMileage: number;
  vehiclePrice: number;
  vehicleCost: number;
  vehicleMake?: string;
  vehicleModel?: string;
  downPayment: number;
  tradeAllowance: number;
  tradePayoff: number;
  customerCreditTier: string;
  monthlyGrossIncome?: number;
  backendProducts: { gap: boolean; vsc: boolean; otherProductsTotal: number };
}): DealInput {
  const ficoMap: Record<string, number> = {
    'prime': 720,
    'near_prime': 670,
    'subprime': 600,
    'deep_subprime': 520,
  };

  return {
    state: 'TX', // Default state
    vehicle: {
      year: legacy.vehicleYear,
      make: legacy.vehicleMake || 'Unknown',
      model: legacy.vehicleModel || 'Unknown',
      mileage: legacy.vehicleMileage,
      retailPrice: legacy.vehiclePrice,
      dealerCost: legacy.vehicleCost,
    },
    customer: {
      fico: ficoMap[legacy.customerCreditTier] || 600,
      monthlyGrossIncome: legacy.monthlyGrossIncome || 4000,
    },
    trade: {
      allowance: legacy.tradeAllowance,
      payoff: legacy.tradePayoff,
    },
    downPayment: legacy.downPayment,
    products: {
      gap: legacy.backendProducts.gap,
      vsc: legacy.backendProducts.vsc,
      otherProductsTotal: legacy.backendProducts.otherProductsTotal,
    },
  };
}
