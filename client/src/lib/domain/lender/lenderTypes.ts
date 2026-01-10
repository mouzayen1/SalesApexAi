// Lender configuration types
import { DealInputs } from '../deal/dealTypes';

export interface LenderConfig {
  id: string;
  name: string;
  dealTypes: ('buy-here-pay-here' | 'retail' | 'lease')[];
  creditTiers: string[];
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minDownPercent: number;
  maxLoanToValue: number;
  aprByTier: Record<string, number>;
  termsByTier: Record<string, number[]>;
}

export interface LenderDecision {
  lenderId: string;
  lenderName: string;
  approved: boolean;
  reason?: string;
  apr?: number;
  termMonths?: number;
  monthlyPayment?: number;
    netCheckToDealer?: number;
  score: number;
}

export type LenderRule = (deal: DealInputs, config: LenderConfig) => boolean;
export type LenderScorer = (deal: DealInputs, config: LenderConfig) => number;
