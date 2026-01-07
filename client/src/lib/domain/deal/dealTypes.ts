// Core domain types for vehicle deals

export type DealType = 'buy-here-pay-here' | 'retail' | 'lease';

export interface DealInputs {
  vehiclePrice: number;
  downPayment: number;
  tradeValue: number;
  tradeOwed: number;
  salesTax: number;  // percentage
  docFee: number;
  dealType: DealType;
  creditTier?: 'excellent' | 'good' | 'fair' | 'poor' | 'deep-subprime';
}

export interface DealOutputs {
  amountFinanced: number;
  monthlyPayment: number;
  totalCost: number;
  apr: number;
  termMonths: number;
  lenderName: string;
  approved: boolean;
  reason?: string;
}
