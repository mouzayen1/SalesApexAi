import React from "react";

export type PaymentAssumptions = {
  down: number;
  targetMonthly: number;
  apr: number;
  termMonths: number;
  taxRate: number;
  fees: number;
  tolerance: number;
};

type Props = {
  value: PaymentAssumptions;
  onChange: (next: PaymentAssumptions) => void;
  onApplyFilter: () => void;
  onClearFilter: () => void;
};

export default function PaymentCalculatorPanel({
  value,
  onChange,
  onApplyFilter,
  onClearFilter
}: Props) {
  const set = (patch: Partial<PaymentAssumptions>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-lg font-semibold">Payment Calculator</div>
      <div className="text-sm text-white/60 mt-1">
        Set assumptions, then filter inventory by monthly payment.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm text-white/70">
          Down Payment ($)
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.down}
            onChange={(e) => set({ down: Number(e.target.value) || 0 })}
            inputMode="numeric"
          />
        </label>

        <label className="text-sm text-white/70">
          Target Monthly ($)
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.targetMonthly}
            onChange={(e) => set({ targetMonthly: Number(e.target.value) || 0 })}
            inputMode="numeric"
          />
        </label>

        <label className="text-sm text-white/70">
          APR (%)
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.apr}
            onChange={(e) => set({ apr: Number(e.target.value) || 0 })}
            inputMode="decimal"
          />
        </label>

        <label className="text-sm text-white/70">
          Term (months)
          <select
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.termMonths}
            onChange={(e) => set({ termMonths: Number(e.target.value) })}
          >
            {[36, 48, 60, 72, 84].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-white/70">
          Tax Rate (e.g. 0.09)
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.taxRate}
            onChange={(e) => set({ taxRate: Number(e.target.value) || 0 })}
            inputMode="decimal"
          />
        </label>

        <label className="text-sm text-white/70">
          Fees ($)
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.fees}
            onChange={(e) => set({ fees: Number(e.target.value) || 0 })}
            inputMode="numeric"
          />
        </label>

        <label className="text-sm text-white/70 col-span-2">
          Tolerance ($ "around")
          <input
            className="mt-1 w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={value.tolerance}
            onChange={(e) => set({ tolerance: Number(e.target.value) || 0 })}
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onApplyFilter}
          className="flex-1 rounded-xl bg-white text-black font-semibold py-2"
        >
          Apply Budget Filter
        </button>

        <button
          onClick={onClearFilter}
          className="rounded-xl border border-white/20 text-white/80 px-4 py-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
