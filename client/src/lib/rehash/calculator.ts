import type { DealInputs, LenderRulePack } from './types';

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) return principal / termMonths;
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return payment;
}

export function evaluateLenderMatch(
  inputs: DealInputs,
  lender: LenderRulePack
): boolean {
  // Credit tier check
  const creditMatch =
    inputs.creditTier === 'prime'
      ? lender.includeGAP
      : inputs.creditTier === 'near_prime'
      ? true
      : inputs.creditTier === 'subprime'
      ? true
      : inputs.creditTier === 'deep_subprime'
      ? lender.includeVSC
      : true;
  if (!creditMatch) return false;

  // Calculate basic values
  const totalVehiclePrice =
    inputs.vehicleYear * 1000 +
    inputs.vehicleMileage * 10 +
    inputs.vehiclePrice;

  const downPaymentAmount = inputs.downPayment || 0;
  const tradeInValue = inputs.tradeValue || 0;
  const tradeInPayoff = inputs.tradePayoff || 0;
  const netTrade = tradeInValue - tradeInPayoff;

  const taxAmount = (totalVehiclePrice * (inputs.taxRate || 0)) / 100;
  const totalFees = (inputs.fees || 0);

  let amountToFinance =
    totalVehiclePrice + taxAmount + totalFees - downPaymentAmount - netTrade;

  // Add optional products
  if (lender.includeGAP && inputs.includeGAP) {
    amountToFinance += inputs.gapPrice || 0;
  }
  if (lender.includeVSC && inputs.includeVSC) {
    amountToFinance += inputs.vscPrice || 0;
  }

  // Check target monthly
  if (inputs.targetMonthly) {
    const estimatedPayment = calculateMonthlyPayment(
      amountToFinance,
      lender.aprOverride || 8.99,
      inputs.targetMonthly
    );
    const tolerance = inputs.monthlyTolerance || 25;
    if (Math.abs(estimatedPayment - inputs.targetMonthly) > tolerance) {
      return false;
    }
  }

  return true;
}

export function generateRehashSuggestions(
  inputs: DealInputs,
  lenders: LenderRulePack[]
): Array<{
  lenderName: string;
  suggestedAPR: number;
  estimatedMonthly: number;
  includesGAP: boolean;
  includesVSC: boolean;
}> {
  const suggestions: Array<{
    lenderName: string;
    suggestedAPR: number;
    estimatedMonthly: number;
    includesGAP: boolean;
    includesVSC: boolean;
  }> = [];

  for (const lender of lenders) {
    if (evaluateLenderMatch(inputs, lender)) {
      const totalVehiclePrice =
        inputs.vehicleYear * 1000 +
        inputs.vehicleMileage * 10 +
        inputs.vehiclePrice;

      const downPaymentAmount = inputs.downPayment || 0;
      const tradeInValue = inputs.tradeValue || 0;
      const tradeInPayoff = inputs.tradePayoff || 0;
      const netTrade = tradeInValue - tradeInPayoff;

      const taxAmount = (totalVehiclePrice * (inputs.taxRate || 0)) / 100;
      const totalFees = inputs.fees || 0;

      let amountToFinance =
        totalVehiclePrice +
        taxAmount +
        totalFees -
        downPaymentAmount -
        netTrade;

      const includesGAP = lender.includeGAP && (inputs.includeGAP || false);
      const includesVSC = lender.includeVSC && (inputs.includeVSC || false);

      if (includesGAP) amountToFinance += inputs.gapPrice || 0;
      if (includesVSC) amountToFinance += inputs.vscPrice || 0;

      const apr = lender.aprOverride || 8.99;
      const termMonths = inputs.targetMonthly || 72;
      const monthly = calculateMonthlyPayment(amountToFinance, apr, termMonths);

      suggestions.push({
        lenderName: lender.id,
        suggestedAPR: apr,
        estimatedMonthly: monthly,
        includesGAP,
        includesVSC,
      });
    }
  }

  return suggestions;
}
