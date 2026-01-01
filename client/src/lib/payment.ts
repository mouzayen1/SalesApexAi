export type PaymentInputs = {
  price: number;
  down: number;
  apr: number;
  termMonths: number;
  taxRate?: number;
  fees?: number;
  tradeIn?: number;
  payoff?: number;
};

export type PaymentResult = {
  amountFinanced: number;
  monthlyPayment: number;
};

export function calcMonthlyPayment(input: PaymentInputs): PaymentResult {
  const taxRate = input.taxRate ?? 0;
  const fees = input.fees ?? 0;
  const tradeIn = input.tradeIn ?? 0;
  const payoff = input.payoff ?? 0;

  const taxablePrice = Math.max(0, input.price - tradeIn);
  const tax = taxablePrice * taxRate;

  const amountFinanced = Math.max(
    0,
    input.price + tax + fees + payoff - input.down - tradeIn
  );

  const n = Math.max(1, Math.floor(input.termMonths));
  const apr = Math.max(0, input.apr);
  const r = apr === 0 ? 0 : (apr / 100) / 12;

  let monthlyPayment = 0;
  if (r === 0) monthlyPayment = amountFinanced / n;
  else monthlyPayment = amountFinanced * (r / (1 - Math.pow(1 + r, -n)));

  return { amountFinanced, monthlyPayment };
}
