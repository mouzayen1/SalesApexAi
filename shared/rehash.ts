// shared/rehash.ts
import type { DealInput, DealCandidate } from './deals';
import { LENDERS, LenderConfig } from './lenders';
import type { FloorPaymentResult } from './smartDealAI';

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
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
  backendTotal: number
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

  const baseAdvance = (tierRow.baseAdvancePercent / 100) * deal.vehicleCost;
  const maxAdvanceByCost = (tierRow.maxAdvancePercent / 100) * deal.vehicleCost;
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

export function runRehash(deal: DealInput, lenders: LenderConfig[] = LENDERS): RehashResult {
  const candidates: DealCandidate[] = [];

  const activeLenders = lenders.filter(l => l.active);

  activeLenders.forEach(lender => {
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    const apr = pickApr(lender, deal.customerCreditTier);
    if (apr == null) return;

    const terms = lender.allowedTerms;

    const backendScenarios = [
      { label: 'No backend', value: 0 },
      {
        label: 'GAP + VSC + Other',
        value: Math.min(
          (deal.backendProducts.gap ? 900 : 0) +
            (deal.backendProducts.vsc ? 1800 : 0) +
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
            scenario.value
          );

          const adjustments: string[] = [];
          adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);
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
  return { bestDeal, allCandidates: sorted };
}

/**
 * Calculate the absolute floor (lowest possible) payment.
 * Uses: Maximum term, No backend products, Buy rate (lowest APR).
 * This represents the mathematically minimum payment achievable.
 */
export function calculateFloorPayment(
  deal: DealInput,
  lenders: LenderConfig[] = LENDERS
): FloorPaymentResult | null {
  const activeLenders = lenders.filter(l => l.active);
  let floorResult: FloorPaymentResult | null = null;

  activeLenders.forEach(lender => {
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    // Use the lowest APR (buy rate) for this tier
    const apr = tierRow.minApr;

    // Use maximum term for lowest payment
    const maxTerm = Math.max(...lender.allowedTerms);

    // No backend products for floor calculation
    const backendTotal = 0;

    // Calculate amount financed with current down payment (no modifications)
    const amountFinanced = computeAmountFinanced(deal, backendTotal);

    // Validate amount financed limits
    if (amountFinanced < lender.minAmountFinanced || amountFinanced > lender.maxAmountFinanced) {
      return;
    }

    // Validate LTV
    const ltv = deal.vehiclePrice > 0 ? (amountFinanced / deal.vehiclePrice) * 100 : 999;
    if (ltv > tierRow.maxLtvPercent) return;

    // Validate deal with lender rules
    const check = lender.validateDeal(deal, amountFinanced);
    if (!check.isValid) return;

    // Calculate monthly payment
    const payment = calculateMonthlyPayment(amountFinanced, apr, maxTerm);

    // Check if this is the lowest payment found
    if (!floorResult || payment < floorResult.payment) {
      // Collect bank rules that apply
      const bankRulesHit: string[] = [];

      if (ltv > 100) {
        bankRulesHit.push(`LTV ${ltv.toFixed(0)}% (Max ${tierRow.maxLtvPercent}%)`);
      }
      if (deal.vehicleMileage > 100000) {
        bankRulesHit.push('High mileage vehicle - may require VSC');
      }
      if (vehicleAge > 5) {
        bankRulesHit.push(`Vehicle age ${vehicleAge} years`);
      }
      if (tierRow.minDownPct > 0 && deal.downPayment < deal.vehiclePrice * tierRow.minDownPct) {
        bankRulesHit.push(`Minimum ${(tierRow.minDownPct * 100).toFixed(0)}% down required`);
      }
      bankRulesHit.push(`${lender.name}: Max term ${maxTerm}mo @ ${apr.toFixed(2)}% buy rate`);

      floorResult = {
        payment,
        termMonths: maxTerm,
        apr,
        lenderName: lender.name,
        amountFinanced,
        ltv,
        bankRulesHit,
      };
    }
  });

  return floorResult;
}
