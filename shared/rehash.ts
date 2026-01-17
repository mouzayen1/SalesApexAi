// shared/rehash.ts
import type { DealInput, DealCandidate } from './deals';
import { LENDERS, LenderConfig, LenderTierPricing } from './lenders';
import { getStateConfig } from './state-config';

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
}

interface AprResult {
  buyRate: number;
  contractRate: number;
  markup: number;
  dealerReserve: number;
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

function calculateAprAndReserve(
  lender: LenderConfig,
  tierRow: LenderTierPricing,
  amountFinanced: number,
  termMonths: number,
  stateMaxApr: number | null
): AprResult {
  const buyRate = tierRow.buyRate;

  // Calculate max allowed contract rate
  let maxContract = buyRate + tierRow.maxMarkup;
  if (stateMaxApr !== null) {
    maxContract = Math.min(maxContract, stateMaxApr);
  }

  // Use midpoint of buy rate and max contract as default
  const contractRate = (buyRate + maxContract) / 2;
  const markup = contractRate - buyRate;

  // Reserve calculation: only on markup portion
  // Reserve = (markup / 12) * amountFinanced * term * dealer split
  const monthlyMarkup = markup / 100 / 12;
  const totalInterestOnMarkup = monthlyMarkup * amountFinanced * termMonths;
  const dealerReserve = totalInterestOnMarkup * lender.dealerReserveSplit;

  return {
    buyRate,
    contractRate,
    markup,
    dealerReserve,
  };
}

function computeAmountFinanced(deal: DealInput, backendTotal: number): number {
  const stateConfig = getStateConfig(deal.state);
  const tradeEquity = deal.tradeAllowance - deal.tradePayoff;

  // Apply trade-in tax credit if state allows it
  let taxableBase = deal.vehiclePrice;
  if (stateConfig.tradeInTaxCredit && tradeEquity > 0) {
    taxableBase = Math.max(0, deal.vehiclePrice - tradeEquity);
  }

  const tax = taxableBase * deal.taxRate;
  const gross = deal.vehiclePrice + tax + deal.fees + backendTotal;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;

  return Math.max(gross - totalDown, 0);
}

function estimateNetCheckAndProfit(
  deal: DealInput,
  lender: LenderConfig,
  tierRow: { baseAdvancePercent: number; maxAdvancePercent: number; maxLtvPercent: number },
  amountFinanced: number,
  backendTotal: number,
  dealerReserve: number
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

  // Include dealer reserve in profit calculation
  const dealerProfit = netCheck + totalDown - deal.vehicleCost - deal.fees + dealerReserve;

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
  const stateConfig = getStateConfig(deal.state);

  const activeLenders = lenders.filter(l => l.active);

  activeLenders.forEach(lender => {
    const vehicleAge = new Date().getFullYear() - deal.vehicleYear;
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

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

          // Calculate APR using buy rate logic
          const aprResult = calculateAprAndReserve(
            lender,
            tierRow,
            amountFinanced,
            term,
            stateConfig.maxApr
          );

          const payment = calculateMonthlyPayment(amountFinanced, aprResult.contractRate, term);

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
            aprResult.dealerReserve
          );

          // Build improved insights
          const adjustments: string[] = [];
          adjustments.push(
            `${lender.name}: ${term}mo @ ${aprResult.contractRate.toFixed(2)}% (buy rate: ${aprResult.buyRate}%)`
          );

          if (stateConfig.tradeInTaxCredit && deal.tradeAllowance > deal.tradePayoff) {
            adjustments.push(`Trade-in tax credit applied (${stateConfig.stateName})`);
          }

          if (finalLtv > 100) {
            adjustments.push(`High LTV (${finalLtv.toFixed(0)}%) - GAP recommended`);
          }

          if (down !== deal.downPayment) {
            adjustments.push(
              `Down increased from $${deal.downPayment.toFixed(0)} to $${down.toFixed(0)}`
            );
          }

          if (scenario.value === 0) {
            adjustments.push('No backend products to maximize net check');
          } else {
            adjustments.push(
              `Included backend products: $${scenario.value.toFixed(0)} (within lender cap)`
            );
          }

          if (aprResult.dealerReserve > 0) {
            adjustments.push(`Dealer reserve: $${aprResult.dealerReserve.toFixed(0)}`);
          }

          const candidate: DealCandidate = {
            lenderId: lender.id,
            lenderName: lender.name,
            termMonths: term,
            apr: aprResult.contractRate,
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
