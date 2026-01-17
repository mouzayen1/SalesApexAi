// shared/state-config.ts
export interface StateConfig {
  stateCode: string;
  stateName: string;
  tradeInTaxCredit: boolean;
  maxDocFee: number | null;
  maxApr: number | null;
}

export const STATE_CONFIGS: Record<string, StateConfig> = {
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    tradeInTaxCredit: true,
    maxDocFee: 150,
    maxApr: null,
  },
  CA: {
    stateCode: 'CA',
    stateName: 'California',
    tradeInTaxCredit: false,
    maxDocFee: 85,
    maxApr: null,
  },
  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    tradeInTaxCredit: true,
    maxDocFee: 899,
    maxApr: null,
  },
  AZ: {
    stateCode: 'AZ',
    stateName: 'Arizona',
    tradeInTaxCredit: true,
    maxDocFee: null,
    maxApr: null,
  },
  NV: {
    stateCode: 'NV',
    stateName: 'Nevada',
    tradeInTaxCredit: false,
    maxDocFee: null,
    maxApr: null,
  },
  DEFAULT: {
    stateCode: 'DEFAULT',
    stateName: 'Default',
    tradeInTaxCredit: false,
    maxDocFee: null,
    maxApr: null,
  },
};

export function getStateConfig(stateCode?: string): StateConfig {
  if (!stateCode) return STATE_CONFIGS.DEFAULT;
  return STATE_CONFIGS[stateCode.toUpperCase()] ?? STATE_CONFIGS.DEFAULT;
}
