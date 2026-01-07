// Lender approval rules (deterministic)
import { DealInputs } from '../deal/dealTypes';
import { LenderConfig } from './lenderTypes';
import { calculateAmountFinanced } from '../deal/paymentMath';

export function checkDealTypeMatch(deal: DealInputs, config: LenderConfig): boolean {
  return config.dealTypes.includes(deal.dealType);
}

export function checkCreditTierMatch(deal: DealInputs, config: LenderConfig): boolean {
  if (!deal.creditTier) return true;
  return config.creditTiers.includes(deal.creditTier);
}

export function checkPriceInRange(deal: DealInputs, config: LenderConfig): boolean {
  return deal.vehiclePrice >= config.minVehiclePrice && deal.vehiclePrice <= config.maxVehiclePrice;
}

export function checkDownPaymentRequirement(deal: DealInputs, config: LenderConfig): boolean {
  const downPercent = (deal.downPayment / deal.vehiclePrice) * 100;
  return downPercent >= config.minDownPercent;
}

export function checkLoanToValue(deal: DealInputs, config: LenderConfig): boolean {
  const amountFinanced = calculateAmountFinanced(
    deal.vehiclePrice,
    deal.downPayment,
    deal.tradeValue,
    deal.tradeOwed,
    deal.salesTax,
    deal.docFee
  );
  const ltv = (amountFinanced / deal.vehiclePrice) * 100;
  return ltv <= config.maxLoanToValue;
}
