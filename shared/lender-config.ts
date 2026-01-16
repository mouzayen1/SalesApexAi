// shared/lender-config.ts
// Config module that bridges base lender configs with admin overrides

import { LENDERS, type LenderConfig, type LenderTierPricing } from './lenders';

// Type for admin overrides (matches LenderConfigEditor)
export interface LenderOverride {
  id: string;
  name: string;
  allowGAP: boolean;
  allowVSC: boolean;
  aprOverride?: number;
  maxLTVOverride?: number;
  active: boolean;
}

// Extended lender config with override fields
export interface ExtendedLenderConfig extends LenderConfig {
  allowGAP: boolean;
  allowVSC: boolean;
  aprOverride?: number;
  maxLTVOverride?: number;
}

// Default overrides (all products allowed, no APR override)
const DEFAULT_OVERRIDES: LenderOverride[] = LENDERS.map(l => ({
  id: l.id,
  name: l.name,
  allowGAP: true,
  allowVSC: true,
  active: l.active,
}));

// Storage key (must match LenderConfigEditor)
const STORAGE_KEY = "lenderConfigOverrides";

/**
 * Load lender overrides from localStorage (browser-only)
 */
export function loadLenderOverrides(): LenderOverride[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_OVERRIDES;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load lender overrides:", e);
  }
  return DEFAULT_OVERRIDES;
}

/**
 * Get merged lender configs with admin overrides applied
 */
export function getMergedLenderConfigs(
  overrides?: LenderOverride[]
): ExtendedLenderConfig[] {
  const activeOverrides = overrides ?? loadLenderOverrides();

  return LENDERS.map(baseLender => {
    const override = activeOverrides.find(o => o.id === baseLender.id);

    // If override sets inactive, mark the lender as inactive
    const isActive = override?.active ?? baseLender.active;

    // Build extended config
    const extended: ExtendedLenderConfig = {
      ...baseLender,
      active: isActive,
      allowGAP: override?.allowGAP ?? true,
      allowVSC: override?.allowVSC ?? true,
      aprOverride: override?.aprOverride,
      maxLTVOverride: override?.maxLTVOverride,
    };

    // If APR override is set, apply it to all tiers
    if (override?.aprOverride !== undefined) {
      extended.pricingGrid = baseLender.pricingGrid.map(tier => ({
        ...tier,
        minApr: override.aprOverride!,
        maxApr: override.aprOverride!,
      }));
    }

    // If max LTV override is set, apply it to all tiers
    if (override?.maxLTVOverride !== undefined) {
      extended.pricingGrid = (extended.pricingGrid || baseLender.pricingGrid).map(tier => ({
        ...tier,
        maxLtvPercent: override.maxLTVOverride!,
      }));
    }

    return extended;
  });
}

/**
 * Get a specific lender config with overrides applied
 */
export function getLenderConfigById(
  id: string,
  overrides?: LenderOverride[]
): ExtendedLenderConfig | undefined {
  return getMergedLenderConfigs(overrides).find(l => l.id === id);
}

/**
 * Check if a backend product (GAP/VSC) is allowed for a lender
 */
export function isProductAllowed(
  lenderId: string,
  product: 'gap' | 'vsc',
  overrides?: LenderOverride[]
): boolean {
  const configs = getMergedLenderConfigs(overrides);
  const config = configs.find(c => c.id === lenderId);
  if (!config) return true; // Default to allowed if lender not found

  return product === 'gap' ? config.allowGAP : config.allowVSC;
}

/**
 * Calculate backend total respecting lender product allowances
 */
export function calculateAllowedBackend(
  lenderId: string,
  includeGAP: boolean,
  includeVSC: boolean,
  gapPrice: number,
  vscPrice: number,
  otherProducts: number,
  maxBackendTotal: number,
  overrides?: LenderOverride[]
): number {
  const configs = getMergedLenderConfigs(overrides);
  const config = configs.find(c => c.id === lenderId);

  let total = otherProducts;

  // Only include GAP if lender allows it
  if (includeGAP && (config?.allowGAP ?? true)) {
    total += gapPrice;
  }

  // Only include VSC if lender allows it
  if (includeVSC && (config?.allowVSC ?? true)) {
    total += vscPrice;
  }

  // Respect lender cap
  return Math.min(total, maxBackendTotal);
}
