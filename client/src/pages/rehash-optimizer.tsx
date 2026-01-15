// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calculator,
  DollarSign,
  Car,
  User,
  TrendingUp,
  CheckCircle,
  XCircle,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runRehash } from "../../../shared/rehash";
import type { DealInput, DealCandidate } from "../../../shared/deals";
import { cn } from "@/lib/utils";

// US States for dropdown
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

interface DealCardProps {
  deal: DealCandidate;
  isBest?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

function DealCard({ deal, isBest, isSelected, onSelect }: DealCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        isBest && "border-green-500 bg-green-500/5",
        isSelected && !isBest && "border-primary bg-primary/5",
        !isBest && !isSelected && "hover:border-muted-foreground/30"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isBest && <Award className="h-5 w-5 text-green-500" />}
            <span className="font-semibold">{deal.lenderName}</span>
          </div>
          <div className="flex items-center gap-2">
            {isBest && (
              <Badge className="bg-green-500 text-white">Best Deal</Badge>
            )}
            {deal.withinGuidelines ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Declined
              </Badge>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Payment</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(deal.payment)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">APR</p>
            <p className="text-lg font-semibold">{deal.apr.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Term</p>
            <p className="text-lg font-semibold">{deal.termMonths} mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LTV</p>
            <p className="text-lg font-semibold">{deal.ltv.toFixed(0)}%</p>
          </div>
        </div>

        {/* Profit Metrics */}
        <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Net Check to Dealer</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(deal.netCheckToDealer)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Dealer Profit</p>
            <p className={cn(
              "text-xl font-bold",
              deal.dealerProfit >= 0 ? "text-primary" : "text-red-600"
            )}>
              {formatCurrency(deal.dealerProfit)}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
        >
          {expanded ? (
            <>
              Hide Details <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show Details <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Financed</span>
              <span className="font-medium">{formatCurrency(deal.amountFinanced)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Down</span>
              <span className="font-medium">{formatCurrency(deal.totalDown)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend Total</span>
              <span className="font-medium">{formatCurrency(deal.backendTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Front Gross</span>
              <span className="font-medium">{formatCurrency(deal.dealerFrontGross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Back Gross</span>
              <span className="font-medium">{formatCurrency(deal.dealerBackEndGross)}</span>
            </div>
            {deal.adjustments && deal.adjustments.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-muted-foreground mb-1">Adjustments:</p>
                <ul className="text-xs space-y-1">
                  {deal.adjustments.map((adj, i) => (
                    <li key={i} className="text-muted-foreground">• {adj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RehashOptimizerPage() {
  const [searchParams] = useSearchParams();

  // Initialize deal input with URL params or defaults
  const [dealInput, setDealInput] = useState<DealInput>(() => {
    const price = searchParams.get("price");
    return {
      vehicleId: searchParams.get("vehicleId") || "demo-1",
      vehicleYear: Number(searchParams.get("year")) || 2020,
      vehicleMileage: Number(searchParams.get("mileage")) || 50000,
      vehiclePrice: price ? Number(price) : 21995,
      vehicleCost: 18500,
      taxRate: 0.09,
      fees: 799,
      downPayment: 3000,
      tradeAllowance: 0,
      tradePayoff: 0,
      backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
      customerCreditTier: "subprime",
      targetPayment: 450,
      paymentTolerance: 50,
    };
  });

  const [results, setResults] = useState<{
    bestDeal: DealCandidate | null;
    allCandidates: DealCandidate[];
  } | null>(null);

  const [selectedDeal, setSelectedDeal] = useState<DealCandidate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleFindLenders = () => {
    setIsCalculating(true);
    // Small timeout for UI feedback
    setTimeout(() => {
      const rehashResults = runRehash(dealInput);
      setResults(rehashResults);
      if (rehashResults.bestDeal) {
        setSelectedDeal(rehashResults.bestDeal);
      }
      setIsCalculating(false);
    }, 100);
  };

  // Auto-run on mount
  useEffect(() => {
    handleFindLenders();
  }, []);

  const handleInputChange = (field: keyof DealInput, value: any) => {
    setDealInput((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-full py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel - Deal Form */}
          <div className="w-full lg:w-96 shrink-0">
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
                        onChange={(e) => handleInputChange("vehicleYear", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mileage</Label>
                      <Input
                        type="number"
                        value={dealInput.vehicleMileage}
                        onChange={(e) => handleInputChange("vehicleMileage", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Selling Price</Label>
                      <Input
                        type="number"
                        value={dealInput.vehiclePrice}
                        onChange={(e) => handleInputChange("vehiclePrice", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cost (ACV)</Label>
                      <Input
                        type="number"
                        value={dealInput.vehicleCost}
                        onChange={(e) => handleInputChange("vehicleCost", Number(e.target.value))}
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
                      onChange={(e) => handleInputChange("customerCreditTier", e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="prime">Prime (700+)</option>
                      <option value="near_prime">Near Prime (650-699)</option>
                      <option value="subprime">Subprime (550-649)</option>
                      <option value="deep_subprime">Deep Subprime (&lt;550)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Down Payment</Label>
                      <Input
                        type="number"
                        value={dealInput.downPayment}
                        onChange={(e) => handleInputChange("downPayment", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Target Payment</Label>
                      <Input
                        type="number"
                        value={dealInput.targetPayment}
                        onChange={(e) => handleInputChange("targetPayment", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Trade Value</Label>
                      <Input
                        type="number"
                        value={dealInput.tradeAllowance}
                        onChange={(e) => handleInputChange("tradeAllowance", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trade Payoff</Label>
                      <Input
                        type="number"
                        value={dealInput.tradePayoff}
                        onChange={(e) => handleInputChange("tradePayoff", Number(e.target.value))}
                      />
                    </div>
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
                          handleInputChange("backendProducts", {
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
                          handleInputChange("backendProducts", {
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

                {/* Calculate Button */}
                <Button
                  onClick={handleFindLenders}
                  className="w-full"
                  size="lg"
                  disabled={isCalculating}
                >
                  {isCalculating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
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
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Deal Optimizer</h1>
              <p className="text-muted-foreground">
                Find the best lender structure to maximize dealer profit
              </p>
            </div>

            {/* No Results */}
            {!results && !isCalculating && (
              <Card className="p-8 text-center">
                <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Enter deal parameters and click "Find Best Lenders" to see results
                </p>
              </Card>
            )}

            {/* Loading */}
            {isCalculating && (
              <Card className="p-8 text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-muted-foreground">Calculating optimal structures...</p>
              </Card>
            )}

            {/* No Matches */}
            {results && results.allCandidates.length === 0 && !isCalculating && (
              <Card className="p-8 text-center border-destructive bg-destructive/5">
                <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Valid Structures Found</h3>
                <p className="text-muted-foreground">
                  Try adjusting down payment, credit tier, or vehicle parameters
                </p>
              </Card>
            )}

            {/* Results List */}
            {results && results.allCandidates.length > 0 && !isCalculating && (
              <div className="space-y-4">
                {/* Summary */}
                <Card className="p-4 bg-muted/30">
                  <div className="flex flex-wrap gap-4 justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Options Found</p>
                      <p className="text-2xl font-bold">{results.allCandidates.length}</p>
                    </div>
                    {results.bestDeal && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Best Net Check</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(results.bestDeal.netCheckToDealer)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Best Payment</p>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(results.bestDeal.payment)}/mo
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                {/* Deal Cards */}
                <div className="space-y-3">
                  {results.allCandidates.map((deal, index) => (
                    <DealCard
                      key={`${deal.lenderId}-${deal.termMonths}-${index}`}
                      deal={deal}
                      isBest={index === 0}
                      isSelected={selectedDeal === deal}
                      onSelect={() => setSelectedDeal(deal)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
