// shared/rehash.ts
import type { DealInput, DealCandidate } from './deals';
import { LENDERS, LenderConfig } from './lenders';
import {
  getMergedLenderConfigs,
  calculateAllowedBackend,
  type ExtendedLenderConfig,
  type LenderOverride,
} from './lender-config';
import {
  isEligible,
  getPreferenceMultiplier,
  type VehicleInfo,
  type RuleHit,
} from './lender-rules';

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
  // Aggregated rule hits across all evaluated lenders
  allRuleHits: RuleHit[];
}

export interface RehashOptions {
  // Optional admin overrides for lender configs
  lenderOverrides?: LenderOverride[];
  // Custom GAP/VSC prices (defaults: $900/$1800)
  gapPrice?: number;
  vscPrice?: number;
}

export function calculateMonthlyPayment(
  amountFinanced: number,
  apr: number,
  termMonths: number
): number {
  const r = apr / 100 / 12;
  if (r === 0) return amountFinanced / termMonths;
  const num = r * amountFinanced;
  const den = 1 - Math.pow(1 + r, -termMonths);
  return num / den;
}

function pickApr(lender: LenderConfig, creditTier: DealInput['customerCreditTier']): number | null {
  const row = lender.pricingGrid.find(p => p.creditTier === creditTier);
  if (!row) return null;
  return (row.minApr + row.maxApr) / 2;
}

function computeAmountFinanced(deal: DealInput, backendTotal: number): number {
  const taxableBase = deal.vehiclePrice;
  const tax = taxableBase * deal.taxRate;
  const gross = taxableBase + tax + deal.fees + backendTotal;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  return Math.max(gross - totalDown, 0);
}

function estimateNetCheckAndProfit(
  deal: DealInput,
  lender: LenderConfig,
  tierRow: { baseAdvancePercent: number; maxAdvancePercent: number; maxLtvPercent: number },
  amountFinanced: number,
  backendTotal: number,
  preferenceFactor: number = 1.0 // Lender preference multiplier
): {
  netCheckToDealer: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  dealerProfit: number;
  totalDown: number;
  ltv: number;
} {
  const vehicleValue = deal.vehiclePrice;
  const ltv = vehicleValue > 0 ? (amountFinanced / vehicleValue) * 100 : 999;

  // Apply preference factor to advance percentages
  // A factor < 1.0 means penalty (reduced advance)
  // A factor > 1.0 means bonus (increased advance)
  const adjustedBaseAdvancePct = tierRow.baseAdvancePercent * preferenceFactor;
  const adjustedMaxAdvancePct = tierRow.maxAdvancePercent * preferenceFactor;

  const baseAdvance = (adjustedBaseAdvancePct / 100) * deal.vehicleCost;
  const maxAdvanceByCost = (adjustedMaxAdvancePct / 100) * deal.vehicleCost;
  const maxAdvanceByLtv = (tierRow.maxLtvPercent / 100) * vehicleValue;

  const grossAdvance = Math.min(amountFinanced, maxAdvanceByCost, maxAdvanceByLtv);

  const lenderFee = (lender.lenderFeePercent / 100) * amountFinanced;
  const netCheck = Math.max(grossAdvance - lenderFee - deal.tradePayoff, 0);

  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  const frontGross = deal.vehiclePrice - deal.vehicleCost;
  const backGross = backendTotal;

  const dealerProfit = netCheck + totalDown - deal.vehicleCost - deal.fees;

  return {
    netCheckToDealer: netCheck,
    dealerFrontGross: frontGross,
    dealerBackEndGross: backGross,
    dealerProfit,
    totalDown,
    ltv,
  };
}

export function runRehash(
  deal: DealInput,
  lenders?: LenderConfig[],
  options?: RehashOptions
): RehashResult {
  const candidates: DealCandidate[] = [];
  const allRuleHits: RuleHit[] = [];

  // Use merged configs if no custom lenders provided
  const effectiveLenders = lenders ?? getMergedLenderConfigs(options?.lenderOverrides);
  const activeLenders = effectiveLenders.filter(l => l.active);

  // Default GAP/VSC prices
  const gapPrice = options?.gapPrice ?? 900;
  const vscPrice = options?.vscPrice ?? 1800;

  // Build vehicle info for rules engine
  const vehicleInfo: VehicleInfo = {
    make: deal.vehicleMake || '',
    model: deal.vehicleModel || '',
    year: deal.vehicleYear,
    mileage: deal.vehicleMileage,
  };

  activeLenders.forEach(lender => {
    // Check eligibility using rules engine
    const eligibility = isEligible(lender.id, vehicleInfo);
    if (!eligibility.eligible) {
      // Store ineligibility reasons but skip this lender
      allRuleHits.push(...eligibility.reasons);
      return;
    }

    // Also check basic lender config constraints (for lenders not in rules config)
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    // Get preference multiplier from rules engine
    const preferenceResult = getPreferenceMultiplier(lender.id, vehicleInfo);
    const preferenceFactor = preferenceResult.factor;
    const preferenceHits = preferenceResult.hits;

    // Collect all rule hits for this lender
    allRuleHits.push(...preferenceHits);

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    const apr = pickApr(lender, deal.customerCreditTier);
    if (apr == null) return;

    const terms = lender.allowedTerms;

    // Calculate backend total respecting lender product allowances (admin overrides)
    const extendedLender = lender as ExtendedLenderConfig;
    const canIncludeGAP = extendedLender.allowGAP !== false;
    const canIncludeVSC = extendedLender.allowVSC !== false;

    const backendScenarios = [
      { label: 'No backend', value: 0 },
      {
        label: 'GAP + VSC + Other',
        value: Math.min(
          (deal.backendProducts.gap && canIncludeGAP ? gapPrice : 0) +
            (deal.backendProducts.vsc && canIncludeVSC ? vscPrice : 0) +
            deal.backendProducts.otherProductsTotal,
          lender.maxBackendTotal
        ),
      },
    ];

    const downOptions = [deal.downPayment, deal.downPayment + 500, deal.downPayment + 1000];

    terms.forEach(term => {
      downOptions.forEach(down => {
        backendScenarios.forEach(scenario => {
          const modifiedDeal: DealInput = { ...deal, downPayment: down };
          const amountFinanced = computeAmountFinanced(modifiedDeal, scenario.value);

          if (
            amountFinanced < lender.minAmountFinanced ||
            amountFinanced > lender.maxAmountFinanced
          )
            return;

          const backendPct = amountFinanced > 0 ? (scenario.value / amountFinanced) * 100 : 999;
          if (backendPct > lender.maxBackendPercentOfAmount) return;

          const check = lender.validateDeal(modifiedDeal, amountFinanced);
          if (!check.isValid) return;

          const ltv =
            deal.vehiclePrice > 0 ? (amountFinanced / deal.vehiclePrice) * 100 : 999;
          if (ltv > tierRow.maxLtvPercent) return;

          const payment = calculateMonthlyPayment(amountFinanced, apr, term);

          // Pass preference factor to affect net check calculation
          const {
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            ltv: finalLtv,
          } = estimateNetCheckAndProfit(
            modifiedDeal,
            lender,
            tierRow,
            amountFinanced,
            scenario.value,
            preferenceFactor
          );

          const adjustments: string[] = [];
          adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);

          // Add preference factor info to adjustments if not 1.0
          if (preferenceFactor !== 1.0) {
            const factorPct = ((preferenceFactor - 1) * 100).toFixed(0);
            const sign = preferenceFactor > 1 ? '+' : '';
            adjustments.push(`Lender preference adjustment: ${sign}${factorPct}%`);
          }

          if (down !== deal.downPayment) {
            adjustments.push(
              `Increased down from $${deal.downPayment.toFixed(0)} to $${down.toFixed(0)}`
            );
          }
          if (scenario.value === 0) {
            adjustments.push('No backend products to maximize net check');
          } else {
            adjustments.push(
              `Included backend products: $${scenario.value.toFixed(0)} (within lender cap)`
            );
          }

          const candidate: DealCandidate = {
            lenderId: lender.id,
            lenderName: lender.name,
            termMonths: term,
            apr,
            amountFinanced,
            payment,
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            backendTotal: scenario.value,
            ltv: finalLtv,
            withinGuidelines: true,
            reasons: check.reasons,
            adjustments,
            preferenceFactor,
            ruleHits: preferenceHits,
          };

          candidates.push(candidate);
        });
      });
    });
  });

  const targetLow = deal.targetPayment - deal.paymentTolerance;
  const targetHigh = deal.targetPayment + deal.paymentTolerance;
  const withinPayment = candidates.filter(c => c.payment >= targetLow && c.payment <= targetHigh);

  const pool = withinPayment.length > 0 ? withinPayment : candidates;

  const sorted = pool.sort((a, b) => {
    if (b.netCheckToDealer !== a.netCheckToDealer) {
      return b.netCheckToDealer - a.netCheckToDealer;
    }
    const aGap = Math.abs(a.payment - deal.targetPayment);
    const bGap = Math.abs(b.payment - deal.targetPayment);
    return aGap - bGap;
  });

  const bestDeal = sorted.length > 0 ? sorted[0] : null;
  return { bestDeal, allCandidates: sorted, allRuleHits };
}
