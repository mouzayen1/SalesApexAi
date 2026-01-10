// Main rehash engine - deterministic lender matching
import { DealInputs, DealOutputs } from '../deal/dealTypes';
import { LenderConfig, LenderDecision } from '../lender/lenderTypes';
import { getLenderConfigs } from '../lender/lenderConfigs';
import {
  checkDealTypeMatch,
  checkCreditTierMatch,
  checkPriceInRange,
  checkDownPaymentRequirement,
  checkLoanToValue,
} from '../lender/lenderRules';
import {
  calculateAmountFinanced,
  calculateMonthlyPayment,
} from '../deal/paymentMath';

export function evaluateLenders(deal: DealInputs): LenderDecision[] {
  const configs = getLenderConfigs();
  const decisions: LenderDecision[] = [];

  for (const config of configs) {
    const decision = evaluateSingleLender(deal, config);
    decisions.push(decision);
  }

  return decisions.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? -1 : 1;
    if (a.apr && b.apr) return a.apr - b.apr;
    return b.score - a.score;
  });
}

function evaluateSingleLender(
  deal: DealInputs,
  config: LenderConfig
): LenderDecision {
  const rules = [
    { check: checkDealTypeMatch, reason: 'Deal type not supported' },
    { check: checkCreditTierMatch, reason: 'Credit tier not accepted' },
    { check: checkPriceInRange, reason: 'Vehicle price out of range' },
    { check: checkDownPaymentRequirement, reason: 'Insufficient down payment' },
    { check: checkLoanToValue, reason: 'LTV exceeds maximum' },
  ];

  for (const rule of rules) {
    if (!rule.check(deal, config)) {
      return {
        lenderId: config.id,
        lenderName: config.name,
        approved: false,
        reason: rule.reason,
        score: 0,
      };
    }
  }

  const tier = deal.creditTier || 'good';
  const apr = config.aprByTier[tier] || 10;
  const terms = config.termsByTier[tier] || [60];
  const termMonths = terms[0];

  const amountFinanced = calculateAmountFinanced(
    deal.vehiclePrice,
    deal.downPayment,
    deal.tradeValue,
    deal.tradeOwed,
    deal.salesTax,
    deal.docFee
  );

  const monthlyPayment = calculateMonthlyPayment(amountFinanced, apr, termMonths);

  return {
    lenderId: config.id,
    lenderName: config.name,
    approved: true,
    apr,
    termMonths,
    monthlyPayment,
        netCheckToDealer: amountFinanced * 0.90,
    score: 100 - apr,
  };
}

export function findBestDeal(deal: DealInputs): DealOutputs | null {
  const decisions = evaluateLenders(deal);
  const best = decisions.find((d) => d.approved);

  if (!best || !best.apr || !best.termMonths || !best.monthlyPayment) {
    return null;
  }

  const amountFinanced = calculateAmountFinanced(
    deal.vehiclePrice,
    deal.downPayment,
    deal.tradeValue,
    deal.tradeOwed,
    deal.salesTax,
    deal.docFee
  );

  return {
    amountFinanced,
    monthlyPayment: best.monthlyPayment,
    totalCost: best.monthlyPayment * best.termMonths,
    apr: best.apr,
    termMonths: best.termMonths,
    lenderName: best.lenderName,
    approved: true,
  };
}
