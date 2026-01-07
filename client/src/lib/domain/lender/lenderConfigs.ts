// Default lender configurations (editable via localStorage)
import { LenderConfig } from './lenderTypes';

export const DEFAULT_LENDERS: LenderConfig[] = [
  {
    id: 'bhph-1',
    name: 'In-House Financing',
    dealTypes: ['buy-here-pay-here'],
    creditTiers: ['poor', 'deep-subprime'],
    minVehiclePrice: 5000,
    maxVehiclePrice: 25000,
    minDownPercent: 20,
    maxLoanToValue: 100,
    aprByTier: { poor: 18.9, 'deep-subprime': 24.9 },
    termsByTier: { poor: [24, 36, 48], 'deep-subprime': [24, 36] },
  },
  {
    id: 'credit-union-1',
    name: 'Local Credit Union',
    dealTypes: ['retail'],
    creditTiers: ['excellent', 'good', 'fair'],
    minVehiclePrice: 10000,
    maxVehiclePrice: 100000,
    minDownPercent: 10,
    maxLoanToValue: 120,
    aprByTier: { excellent: 3.99, good: 5.49, fair: 8.99 },
    termsByTier: {
      excellent: [36, 48, 60, 72],
      good: [36, 48, 60],
      fair: [36, 48],
    },
  },
  {
    id: 'subprime-1',
    name: 'Subprime Specialist',
    dealTypes: ['retail'],
    creditTiers: ['fair', 'poor'],
    minVehiclePrice: 8000,
    maxVehiclePrice: 40000,
    minDownPercent: 15,
    maxLoanToValue: 110,
    aprByTier: { fair: 12.99, poor: 16.99 },
    termsByTier: { fair: [48, 60], poor: [36, 48] },
  },
];

export function getLenderConfigs(): LenderConfig[] {
  const stored = localStorage.getItem('rehash-lender-configs');
  return stored ? JSON.parse(stored) : DEFAULT_LENDERS;
}

export function saveLenderConfigs(configs: LenderConfig[]): void {
  localStorage.setItem('rehash-lender-configs', JSON.stringify(configs));
}
