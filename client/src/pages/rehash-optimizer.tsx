// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runRehash } from "../../../shared/rehash";
import type { DealInput, DealCandidate } from "../../../shared/deals";
import type { Car as CarType } from "@shared/schema";
import { fetchCarById } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  computeBadges,
  computeAiInsight,
  computeSmartDecision,
  CREDIT_TIER_LABELS,
  type VehicleBadge,
  type AiInsight,
  type SmartDecision,
} from "../../../shared/deal-insights";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMileage(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

interface DealCardProps {
  deal: DealCandidate;
  isBest?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  smartDecision?: SmartDecision;
}

function DealCard({ deal, isBest, isSelected, onSelect, smartDecision }: DealCardProps) {
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
            {/* Product Chips for Best Deal */}
            {isBest && smartDecision && smartDecision.products.length > 0 && (
              <>
                {smartDecision.products.map((product, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-blue-50 border-blue-500 text-blue-700"
                    title={product.reason}
                  >
                    +{product.name}
                  </Badge>
                ))}
              </>
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

        {/* Smart Decision Narrative for Best Deal */}
        {isBest && smartDecision && smartDecision.narrative && (
          <div className="mb-3 p-2 rounded bg-blue-50/50 border border-blue-100">
            <p className="text-xs">
              <span className="font-medium text-blue-700">Smart Decision:</span>{" "}
              <span className="text-muted-foreground">{smartDecision.narrative}</span>
            </p>
          </div>
        )}

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

// Helper to create initial deal input from vehicle
function createDealInputFromVehicle(vehicle: CarType): DealInput {
  // Estimate vehicle cost as ~85% of price (typical dealer markup)
  const estimatedCost = Math.round(vehicle.price * 0.85);

  return {
    vehicleId: vehicle.id,
    vehicleYear: vehicle.year,
    vehicleMileage: vehicle.mileage,
    vehiclePrice: vehicle.price,
    vehicleCost: estimatedCost,
    vehicleMake: vehicle.make,
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
    customerCreditTier: "subprime",
    targetPayment: 450,
    paymentTolerance: 50,
    monthlyGrossIncome: undefined,
  };
}

// Default deal input when no vehicle is selected
function createDefaultDealInput(): DealInput {
  return {
    vehicleId: "",
    vehicleYear: new Date().getFullYear() - 3,
    vehicleMileage: 50000,
    vehiclePrice: 25000,
    vehicleCost: 21000,
    vehicleMake: undefined,
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
    customerCreditTier: "subprime",
    targetPayment: 450,
    paymentTolerance: 50,
    monthlyGrossIncome: undefined,
  };
}

export default function RehashOptimizerPage() {
  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get("vehicleId");

  // Fetch vehicle data if vehicleId is provided
  const {
    data: vehicle,
    isLoading: isLoadingVehicle,
    error: vehicleError,
  } = useQuery({
    queryKey: ["car", vehicleId],
    queryFn: () => (vehicleId ? fetchCarById(vehicleId) : null),
    enabled: !!vehicleId,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches
  });

  // Deal input state
  const [dealInput, setDealInput] = useState<DealInput>(createDefaultDealInput);
  const [results, setResults] = useState<{
    bestDeal: DealCandidate | null;
    allCandidates: DealCandidate[];
  } | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealCandidate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Track which vehicleId was used to initialize the form (using ref to avoid re-renders)
  const initializedForVehicleIdRef = useRef<string | null>(null);
  const shouldAutoRunRef = useRef(false);

  // Reset and initialize deal input when vehicle changes
  useEffect(() => {
    // If we have a new vehicleId that differs from what we initialized for
    if (vehicleId && vehicleId !== initializedForVehicleIdRef.current && vehicle) {
      setDealInput(createDealInputFromVehicle(vehicle));
      initializedForVehicleIdRef.current = vehicleId;
      setResults(null);
      setSelectedDeal(null);
      shouldAutoRunRef.current = true; // Flag to auto-run calculation
    } else if (!vehicleId && initializedForVehicleIdRef.current !== "") {
      // No vehicleId provided, reset to defaults
      setDealInput(createDefaultDealInput());
      initializedForVehicleIdRef.current = "";
      setResults(null);
      setSelectedDeal(null);
      shouldAutoRunRef.current = true;
    }
  }, [vehicle, vehicleId]);

  // Run calculation function
  const runCalculation = useCallback((input: DealInput) => {
    setIsCalculating(true);
    // Use requestAnimationFrame for smoother UI
    requestAnimationFrame(() => {
      const rehashResults = runRehash(input);
      setResults(rehashResults);
      if (rehashResults.bestDeal) {
        setSelectedDeal(rehashResults.bestDeal);
      }
      setIsCalculating(false);
    });
  }, []);

  // Auto-run calculation after vehicle initialization
  useEffect(() => {
    if (shouldAutoRunRef.current && !isCalculating) {
      shouldAutoRunRef.current = false;
      runCalculation(dealInput);
    }
  }, [dealInput, isCalculating, runCalculation]);

  // Manual trigger for "Find Best Lenders" button
  const handleFindLenders = useCallback(() => {
    runCalculation(dealInput);
  }, [dealInput, runCalculation]);

  const handleInputChange = (field: keyof DealInput, value: DealInput[keyof DealInput]) => {
    setDealInput((prev) => ({ ...prev, [field]: value }));
  };

  // Computed derived state - badges, AI insight, smart decision
  const badges = useMemo<VehicleBadge[]>(() => {
    return computeBadges(
      dealInput,
      results?.bestDeal || null,
      vehicle?.make,
      vehicle?.model
    );
  }, [dealInput, results?.bestDeal, vehicle?.make, vehicle?.model]);

  const aiInsight = useMemo<AiInsight>(() => {
    return computeAiInsight(
      dealInput,
      results?.bestDeal || null,
      results?.allCandidates || []
    );
  }, [dealInput, results?.bestDeal, results?.allCandidates]);

  const smartDecision = useMemo<SmartDecision>(() => {
    return computeSmartDecision(dealInput, results?.bestDeal || null);
  }, [dealInput, results?.bestDeal]);

  // Loading state
  if (vehicleId && isLoadingVehicle) {
    return (
      <div className="min-h-full py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 text-center max-w-md mx-auto">
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading vehicle details...</p>
          </Card>
        </div>
      </div>
    );
  }

  // Vehicle not found state
  if (vehicleId && !isLoadingVehicle && !vehicle) {
    return (
      <div className="min-h-full py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 text-center max-w-md mx-auto border-destructive bg-destructive/5">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vehicle Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The vehicle you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (vehicleError) {
    return (
      <div className="min-h-full py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 text-center max-w-md mx-auto border-destructive bg-destructive/5">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Vehicle</h2>
            <p className="text-muted-foreground mb-4">
              There was a problem loading the vehicle data.
            </p>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inventory
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

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

                  <div className="space-y-1">
                    <Label className="text-xs">Monthly Gross Income (PTI)</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={dealInput.monthlyGrossIncome || ""}
                      onChange={(e) => handleInputChange("monthlyGrossIncome", e.target.value ? Number(e.target.value) : undefined)}
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
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 min-w-0">
            {/* Vehicle Header */}
            <div className="mb-6">
              {vehicle ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Link to="/" className="text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <Badge variant="outline">Selected Vehicle</Badge>
                  </div>
                  <h1 className="text-2xl font-bold">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                    {vehicle.trim && <span className="text-muted-foreground font-normal"> {vehicle.trim}</span>}
                  </h1>
                  <p className="text-muted-foreground">
                    {formatCurrency(vehicle.price)} • {formatMileage(vehicle.mileage)} miles • {vehicle.color}
                  </p>

                  {/* Vehicle Badges/Warnings */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {badges.map((badge, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={cn(
                            "text-xs font-medium",
                            badge.type === 'danger' && "border-red-500 text-red-600 bg-red-50",
                            badge.type === 'warning' && "border-amber-500 text-amber-600 bg-amber-50",
                            badge.type === 'info' && "border-blue-500 text-blue-600 bg-blue-50"
                          )}
                          title={badge.detail}
                        >
                          {badge.type === 'danger' && <ShieldAlert className="h-3 w-3 mr-1" />}
                          {badge.type === 'warning' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {badge.type === 'info' && <Info className="h-3 w-3 mr-1" />}
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">Deal Optimizer</h1>
                  <p className="text-muted-foreground">
                    Find the best lender structure to maximize dealer profit
                  </p>
                </>
              )}
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
                <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
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
                {/* AI Insight Panel */}
                <Card className={cn(
                  "p-4 border-l-4",
                  aiInsight.status === 'realistic' && "border-l-green-500 bg-green-50/50",
                  aiInsight.status === 'needs_adjustment' && "border-l-amber-500 bg-amber-50/50",
                  aiInsight.status === 'challenging' && "border-l-red-500 bg-red-50/50"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      aiInsight.status === 'realistic' && "bg-green-100",
                      aiInsight.status === 'needs_adjustment' && "bg-amber-100",
                      aiInsight.status === 'challenging' && "bg-red-100"
                    )}>
                      <Lightbulb className={cn(
                        "h-5 w-5",
                        aiInsight.status === 'realistic' && "text-green-600",
                        aiInsight.status === 'needs_adjustment' && "text-amber-600",
                        aiInsight.status === 'challenging' && "text-red-600"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs font-medium">AI Insight</Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-medium",
                            aiInsight.status === 'realistic' && "border-green-500 text-green-700",
                            aiInsight.status === 'needs_adjustment' && "border-amber-500 text-amber-700",
                            aiInsight.status === 'challenging' && "border-red-500 text-red-700"
                          )}
                        >
                          {aiInsight.statusLabel}
                        </Badge>
                        {aiInsight.gap > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Gap: {formatCurrency(aiInsight.gap)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {aiInsight.explanations.map((exp, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">{exp}</p>
                        ))}
                      </div>
                      <p className="text-sm font-medium mt-2">
                        <span className="text-muted-foreground">Strategy:</span> {aiInsight.strategy}
                      </p>
                    </div>
                  </div>
                </Card>

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
                      smartDecision={index === 0 ? smartDecision : undefined}
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
