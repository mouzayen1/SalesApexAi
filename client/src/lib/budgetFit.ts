import { calcMonthlyPayment } from "./payment";

export type BudgetFit = {
  payment: number;
  termMonths: number;
};

export function chooseTermForBudget(args: {
  price: number;
  down: number;
  apr: number;
  taxRate: number;
  fees: number;
  targetMonthly: number;
  tolerance: number;
  terms: number[];
}): BudgetFit | null {
  const { price, down, apr, taxRate, fees, targetMonthly, tolerance, terms } = args;

  for (const termMonths of terms) {
    const { monthlyPayment } = calcMonthlyPayment({
      price,
      down,
      apr,
      termMonths,
      taxRate,
      fees
    });

    if (monthlyPayment <= targetMonthly + tolerance) {
      return { payment: monthlyPayment, termMonths };
    }
  }

  return null;
}
