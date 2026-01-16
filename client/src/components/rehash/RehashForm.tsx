// client/src/components/rehash/RehashForm.tsx
// Modular form component for deal input parameters

import { useState } from "react";
import {
  Calculator,
  DollarSign,
  Car,
  User,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealInput, CreditTier } from "../../../../shared/deals";
import { CREDIT_TIER_LABELS } from "../../../../shared/deal-insights";

interface RehashFormProps {
  dealInput: DealInput;
  onChange: (field: keyof DealInput, value: DealInput[keyof DealInput]) => void;
  onCalculate: () => void;
  isCalculating?: boolean;
}

export function RehashForm({
  dealInput,
  onChange,
  onCalculate,
  isCalculating = false,
}: RehashFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Card className="sticky top-24">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Deal Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vehicle Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <Car className="h-4 w-4" />
            Vehicle Details
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={dealInput.vehicleYear}
                onChange={(e) => onChange("vehicleYear", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mileage</Label>
              <Input
                type="number"
                value={dealInput.vehicleMileage}
                onChange={(e) => onChange("vehicleMileage", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Selling Price</Label>
              <Input
                type="number"
                value={dealInput.vehiclePrice}
                onChange={(e) => onChange("vehiclePrice", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cost (ACV)</Label>
              <Input
                type="number"
                value={dealInput.vehicleCost}
                onChange={(e) => onChange("vehicleCost", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Customer Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            Customer & Deal
          </h3>

          <div className="space-y-1">
            <Label className="text-xs">Credit Tier</Label>
            <select
              value={dealInput.customerCreditTier}
              onChange={(e) => onChange("customerCreditTier", e.target.value as CreditTier)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {Object.entries(CREDIT_TIER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Down Payment</Label>
              <Input
                type="number"
                value={dealInput.downPayment}
                onChange={(e) => onChange("downPayment", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target Payment</Label>
              <Input
                type="number"
                value={dealInput.targetPayment}
                onChange={(e) => onChange("targetPayment", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Trade Value</Label>
              <Input
                type="number"
                value={dealInput.tradeAllowance}
                onChange={(e) => onChange("tradeAllowance", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trade Payoff</Label>
              <Input
                type="number"
                value={dealInput.tradePayoff}
                onChange={(e) => onChange("tradePayoff", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Monthly Gross Income (PTI)</Label>
            <Input
              type="number"
              placeholder="Optional"
              value={dealInput.monthlyGrossIncome || ""}
              onChange={(e) =>
                onChange("monthlyGrossIncome", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
        </div>

        {/* Products Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Backend Products
          </h3>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dealInput.backendProducts.gap}
                onChange={(e) =>
                  onChange("backendProducts", {
                    ...dealInput.backendProducts,
                    gap: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">GAP Insurance</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dealInput.backendProducts.vsc}
                onChange={(e) =>
                  onChange("backendProducts", {
                    ...dealInput.backendProducts,
                    vsc: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">Vehicle Service Contract</span>
            </label>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
        >
          {showAdvanced ? (
            <>
              Hide Advanced <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show Advanced <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(dealInput.taxRate * 100).toFixed(2)}
                  onChange={(e) => onChange("taxRate", Number(e.target.value) / 100)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fees</Label>
                <Input
                  type="number"
                  value={dealInput.fees}
                  onChange={(e) => onChange("fees", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Tolerance (±)</Label>
                <Input
                  type="number"
                  value={dealInput.paymentTolerance}
                  onChange={(e) => onChange("paymentTolerance", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other Products ($)</Label>
                <Input
                  type="number"
                  value={dealInput.backendProducts.otherProductsTotal}
                  onChange={(e) =>
                    onChange("backendProducts", {
                      ...dealInput.backendProducts,
                      otherProductsTotal: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Calculate Button */}
        <Button
          onClick={onCalculate}
          className="w-full"
          size="lg"
          disabled={isCalculating}
        >
          {isCalculating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Find Best Lenders
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default RehashForm;
