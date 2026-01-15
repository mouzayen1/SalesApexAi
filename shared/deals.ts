// shared/deals.ts
export type CreditTier = 'deep_subprime' | 'subprime' | 'near_prime' | 'prime';

export interface BackendProducts {
  gap: boolean;
  vsc: boolean;
  otherProductsTotal: number;
}

export interface DealInput {
  vehicleId: string;
  vehicleYear: number;
  vehicleMileage: number;
  vehiclePrice: number;      // Selling price (before tax/fees)
  vehicleCost: number;        // Dealer cost (for profit calculation)
  vehicleMake?: string;       // Make for theft risk calculation
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
  monthlyGrossIncome?: number; // Customer's monthly gross income for PTI calculation
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
}

export interface DealConstraintsResult {
  isValid: boolean;
  reasons: string[];
}
