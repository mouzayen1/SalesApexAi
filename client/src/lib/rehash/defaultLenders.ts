import type { LenderRulePack } from './types';

export const DEFAULT_LENDERS: LenderRulePack[] = [
  {
    id: 'Capital One Auto',
    includeGAP: true,
    includeVSC: false,
    aprOverride: 7.49,
  },
  {
    id: 'Chase Auto Finance',
    includeGAP: true,
    includeVSC: true,
    aprOverride: 6.99,
  },
  {
    id: 'Wells Fargo Dealer Services',
    includeGAP: false,
    includeVSC: true,
    aprOverride: 8.25,
  },
  {
    id: 'Ally Financial',
    includeGAP: true,
    includeVSC: true,
    aprOverride: 7.75,
  },
  {
    id: 'Santander Consumer USA',
    includeGAP: false,
    includeVSC: false,
    aprOverride: 11.99,
  },
];
