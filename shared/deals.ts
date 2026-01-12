// shared/deals.ts
export type CreditTier = 'deep_subprime' | 'subprime' | 'near_prime' | 'prime';

export interface BackendProducts {
  gap: boolean;
  vsc: boolean;
  otherProductsTotal: number;
}

// Smart product recommendation types
export type ProductDecisionReason =
  | 'ltv_high'           // LTV > 100%, vehicle is upside down
  | 'high_mileage'       // Vehicle has high mileage (out of warranty)
  | 'vehicle_age'        // Vehicle is old (out of factory warranty)
  | 'budget_optimization' // Removed to meet payment target
  | 'lender_declined'    // Removed because lender wouldn't approve
  | 'risk_based'         // Added due to risk assessment
  | 'profit_maximization'; // Added to maximize dealer profit

export interface ProductDecision {
  included: boolean;
  reason: ProductDecisionReason;
  note: string;
}

export interface SmartProductRecommendation {
  gap: ProductDecision;
  vsc: ProductDecision;
}

export interface RiskAssessment {
  isUpsideDown: boolean;      // LTV > 100%
  ltvPercent: number;
  isOutOfWarranty: boolean;   // Age > 3 years OR mileage > 36,000
  outOfWarrantyReason: 'age' | 'mileage' | 'both' | null;
  vehicleAgeYears: number;
  vehicleMileage: number;
  recommendGap: boolean;
  recommendVsc: boolean;
}

export interface DealInput {
  vehicleId: string;
  vehicleYear: number;
  vehicleMileage: number;
  vehiclePrice: number;      // Selling price (before tax/fees)
  vehicleCost: number;        // Dealer cost (for profit calculation)
  taxRate: number;            // e.g., 0.09 for 9%
  fees: number;               // Doc + DMV + misc dealer fees
  downPayment: number;        // Customer cash down
  tradeAllowance: number;     // Trade-in value (if any)
  tradePayoff: number;        // Payoff on trade (if any)
  backendProducts: BackendProducts;
  customerCreditTier: CreditTier;
  targetPayment: number;      // Customer's desired monthly payment
  paymentTolerance: number;   // e.g., 50 means ±$50
  preferredTermMonths?: number;
}

export interface DealCandidate {
  lenderId: string;
  lenderName: string;
  termMonths: number;
  apr: number;
  amountFinanced: number;
  payment: number;
  netCheckToDealer: number;   // The funded check dealer receives
  dealerFrontGross: number;   // Price - Cost
  dealerBackEndGross: number; // Backend product profit
  dealerProfit: number;       // Total: Net Check + Down - Cost - Fees
  totalDown: number;          // Down + Trade Equity
  backendTotal: number;       // Total backend dollars included
  ltv: number;                // LTV percentage
  withinGuidelines: boolean;
  reasons: string[];
  adjustments: string[];      // Human-readable changes made
  // Smart Finance Manager additions
  hasGap: boolean;
  hasVsc: boolean;
  smartNote: string;          // Explanation of the product decision
  productRecommendation?: SmartProductRecommendation;
  riskAssessment?: RiskAssessment;
  optimizationLevel: 'optimal' | 'vsc_stripped' | 'all_stripped';
}

export interface DealConstraintsResult {
  isValid: boolean;
  reasons: string[];
}
