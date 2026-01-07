// Deterministic payment calculations (no AI needed)

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) return principal / termMonths;
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    principal *
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(payment * 100) / 100;
}

export function calculateAmountFinanced(
  vehiclePrice: number,
  downPayment: number,
  tradeValue: number,
  tradeOwed: number,
  salesTax: number,
  docFee: number
): number {
  const netTrade = tradeValue - tradeOwed;
  const taxableAmount = vehiclePrice - netTrade;
  const taxAmount = (taxableAmount * salesTax) / 100;
  return vehiclePrice - downPayment - netTrade + taxAmount + docFee;
}
