import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { calcMonthlyPayment } from "@/lib/payment";

export interface CalculatorValues {
  down: number;
  apr: number;
  termMonths: number;
  taxRate: number;
  fees: number;
}

interface PaymentCalculatorProps {
  values: CalculatorValues;
  onChange: (values: CalculatorValues) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const TERM_OPTIONS = [36, 48, 60, 72, 84];

export function PaymentCalculator({
  values,
  onChange,
  enabled,
  onEnabledChange,
}: PaymentCalculatorProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (patch: Partial<CalculatorValues>) => {
    onChange({ ...values, ...patch });
  };

  // Calculate example payment for a $25,000 vehicle
  const examplePayment = calcMonthlyPayment({
    price: 25000,
    down: values.down,
    apr: values.apr,
    termMonths: values.termMonths,
    taxRate: values.taxRate,
    fees: values.fees,
  }).monthlyPayment;

  return (
    <div className="border border-border rounded-lg bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-md",
              enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">Payment Calculator</h3>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? `Showing est. payments ($${values.down} down, ${values.apr}% APR, ${values.termMonths} mo)`
                : "Enable to show estimated monthly payments"}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between mb-4">
            <Label htmlFor="calc-enabled" className="text-sm font-medium">
              Show estimated payments
            </Label>
            <Switch
              id="calc-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>

          <div className="space-y-4">
            {/* Down Payment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Down Payment</Label>
                <span className="text-sm font-medium">${values.down.toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ down: Math.max(0, values.down - 500) })}
                >
                  -$500
                </Button>
                <Input
                  type="number"
                  value={values.down}
                  onChange={(e) => update({ down: Number(e.target.value) || 0 })}
                  className="flex-1 h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ down: values.down + 500 })}
                >
                  +$500
                </Button>
              </div>
            </div>

            {/* APR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">APR (%)</Label>
                <span className="text-sm font-medium">{values.apr}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={values.apr}
                  onChange={(e) => update({ apr: Number(e.target.value) || 0 })}
                  className="w-20 h-8"
                />
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={values.apr}
                  onChange={(e) => update({ apr: Number(e.target.value) })}
                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Term */}
            <div className="space-y-2">
              <Label className="text-sm">Loan Term</Label>
              <div className="grid grid-cols-5 gap-2">
                {TERM_OPTIONS.map((term) => (
                  <Button
                    key={term}
                    variant={values.termMonths === term ? "default" : "outline"}
                    size="sm"
                    onClick={() => update({ termMonths: term })}
                    className="text-xs"
                  >
                    {term} mo
                  </Button>
                ))}
              </div>
            </div>

            {/* Example Payment */}
            {enabled && (
              <div className="mt-4 p-3 rounded-md bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Example: $25,000 vehicle
                </p>
                <p className="text-lg font-bold text-primary">
                  ~${Math.round(examplePayment)}/mo
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
