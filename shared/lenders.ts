// shared/lenders.ts
import type { CreditTier, DealInput } from './deals';

export interface LenderTierPricing {
  creditTier: CreditTier;
  minApr: number;
  maxApr: number;
  minDownPct: number;
  baseAdvancePercent: number;
  maxAdvancePercent: number;
  maxLtvPercent: number;
  buyRate: number;      // Base rate lender charges
  maxMarkup: number;    // Max dealer markup allowed
}

export interface LenderConfig {
  id: string;
  name: string;
  active: boolean;
  allowedTerms: number[];
  minAmountFinanced: number;
  maxAmountFinanced: number;
  maxBackendTotal: number;
  maxBackendPercentOfAmount: number;
  maxVehicleAgeYears: number;
  maxMiles: number;
  lenderFeePercent: number;
  dealerReserveSplit: number;  // e.g., 0.7 = dealer gets 70% of reserve
  pricingGrid: LenderTierPricing[];
  validateDeal: (deal: DealInput, amountFinanced: number) => { isValid: boolean; reasons: string[] };
}

export const LENDERS: LenderConfig[] = [
  {
    id: 'westlake',
    name: 'Westlake Financial',
    active: true,
    allowedTerms: [36, 48, 60, 72],
    minAmountFinanced: 5000,
    maxAmountFinanced: 45000,
    maxBackendTotal: 3500,
    maxBackendPercentOfAmount: 25,
    maxVehicleAgeYears: 12,
    maxMiles: 150000,
    lenderFeePercent: 3.0,
    dealerReserveSplit: 0.70,
    pricingGrid: [
      {
        creditTier: 'deep_subprime',
        minApr: 22,
        maxApr: 27,
        minDownPct: 0.1,
        baseAdvancePercent: 115,
        maxAdvancePercent: 145,
        maxLtvPercent: 145,
        buyRate: 20,
        maxMarkup: 3,
      },
      {
        creditTier: 'subprime',
        minApr: 18,
        maxApr: 23,
        minDownPct: 0.1,
        baseAdvancePercent: 115,
        maxAdvancePercent: 140,
        maxLtvPercent: 140,
        buyRate: 16,
        maxMarkup: 3,
      },
      {
        creditTier: 'near_prime',
        minApr: 12,
        maxApr: 18,
        minDownPct: 0.05,
        baseAdvancePercent: 110,
        maxAdvancePercent: 130,
        maxLtvPercent: 130,
        buyRate: 10,
        maxMarkup: 3,
      },
      {
        creditTier: 'prime',
        minApr: 8,
        maxApr: 12,
        minDownPct: 0.0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 120,
        maxLtvPercent: 120,
        buyRate: 6,
        maxMarkup: 2.5,
      },
    ],
    validateDeal: (deal, amountFinanced) => {
      const reasons: string[] = [];
      if (amountFinanced < 5000) reasons.push('Below Westlake minimum amount financed ($5,000)');
      if (amountFinanced > 45000) reasons.push('Above Westlake maximum amount financed ($45,000)');
      if (deal.downPayment < deal.vehiclePrice * 0.05)
        reasons.push('Down payment below 5% minimum for Westlake');
      return { isValid: reasons.length === 0, reasons };
    },
  },
  {
    id: 'western_funding',
    name: 'Western Funding',
    active: true,
    allowedTerms: [48, 60, 72, 84],
    minAmountFinanced: 4000,
    maxAmountFinanced: 40000,
    maxBackendTotal: 4000,
    maxBackendPercentOfAmount: 30,
    maxVehicleAgeYears: 15,
    maxMiles: 180000,
    lenderFeePercent: 2.5,
    dealerReserveSplit: 0.75,
    pricingGrid: [
      {
        creditTier: 'deep_subprime',
        minApr: 24,
        maxApr: 29,
        minDownPct: 0.08,
        baseAdvancePercent: 120,
        maxAdvancePercent: 150,
        maxLtvPercent: 150,
        buyRate: 22,
        maxMarkup: 3,
      },
      {
        creditTier: 'subprime',
        minApr: 20,
        maxApr: 25,
        minDownPct: 0.08,
        baseAdvancePercent: 115,
        maxAdvancePercent: 145,
        maxLtvPercent: 145,
        buyRate: 18,
        maxMarkup: 3,
      },
      {
        creditTier: 'near_prime',
        minApr: 14,
        maxApr: 20,
        minDownPct: 0.05,
        baseAdvancePercent: 110,
        maxAdvancePercent: 135,
        maxLtvPercent: 135,
        buyRate: 12,
        maxMarkup: 3,
      },
      {
        creditTier: 'prime',
        minApr: 9,
        maxApr: 14,
        minDownPct: 0.0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 125,
        maxLtvPercent: 125,
        buyRate: 7,
        maxMarkup: 2.5,
      },
    ],
    validateDeal: (deal, amountFinanced) => {
      const reasons: string[] = [];
      if (amountFinanced < 4000) reasons.push('Below Western Funding minimum amount financed ($4,000)');
      if (amountFinanced > 40000) reasons.push('Above Western Funding maximum amount financed ($40,000)');
      return { isValid: reasons.length === 0, reasons };
    },
  },
  {
    id: 'uac',
    name: 'United Auto Credit',
    active: true,
    allowedTerms: [36, 48, 60, 72],
    minAmountFinanced: 5000,
    maxAmountFinanced: 50000,
    maxBackendTotal: 3000,
    maxBackendPercentOfAmount: 20,
    maxVehicleAgeYears: 10,
    maxMiles: 140000,
    lenderFeePercent: 2.0,
    dealerReserveSplit: 0.65,
    pricingGrid: [
      {
        creditTier: 'deep_subprime',
        minApr: 23,
        maxApr: 28,
        minDownPct: 0.1,
        baseAdvancePercent: 115,
        maxAdvancePercent: 140,
        maxLtvPercent: 140,
        buyRate: 21,
        maxMarkup: 3,
      },
      {
        creditTier: 'subprime',
        minApr: 19,
        maxApr: 24,
        minDownPct: 0.1,
        baseAdvancePercent: 112,
        maxAdvancePercent: 135,
        maxLtvPercent: 135,
        buyRate: 17,
        maxMarkup: 3,
      },
      {
        creditTier: 'near_prime',
        minApr: 14,
        maxApr: 20,
        minDownPct: 0.05,
        baseAdvancePercent: 108,
        maxAdvancePercent: 125,
        maxLtvPercent: 125,
        buyRate: 11,
        maxMarkup: 3,
      },
      {
        creditTier: 'prime',
        minApr: 9,
        maxApr: 14,
        minDownPct: 0.0,
        baseAdvancePercent: 105,
        maxAdvancePercent: 120,
        maxLtvPercent: 120,
        buyRate: 7,
        maxMarkup: 2.5,
      },
    ],
    validateDeal: (deal, amountFinanced) => {
      const reasons: string[] = [];
      if (deal.downPayment < 500) reasons.push('UAC requires at least $500 down payment');
      if (amountFinanced < 5000) reasons.push('Below UAC minimum amount financed ($5,000)');
      if (amountFinanced > 50000) reasons.push('Above UAC maximum amount financed ($50,000)');
      return { isValid: reasons.length === 0, reasons };
    },
  },
];

export function getLenderById(id: string): LenderConfig | undefined {
  return LENDERS.find(l => l.id === id);
}
