// shared/smartDealAI.ts
import type { CreditTier, DealCandidate } from './deals';

export interface SmartDealAIRequest {
  targetPayment: number;
  bestProfitPayment: number;
  floorPayment: number;
  bankRulesHit: string[];
  customerIncome?: number;
  creditTier: CreditTier;
  amountFinanced: number;
  ltv: number;
  termMonths: number;
  downPayment: number;
  vehiclePrice: number;
}

export interface SmartDealAIResponse {
  insight: string;
  scenario: 'realistic' | 'unrealistic';
  gap: number;
  suggestedActions?: string[];
}

export interface FloorPaymentResult {
  payment: number;
  termMonths: number;
  apr: number;
  lenderName: string;
  amountFinanced: number;
  ltv: number;
  bankRulesHit: string[];
}
