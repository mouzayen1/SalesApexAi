// client/src/pages/rehash-optimizer.tsx
// Refactored Rehash Optimizer page using modular components

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  RehashForm,
  RehashResults,
  LenderConfigEditor,
  VehicleHeader,
  type LenderConfigOverride,
  type RehashResultsData,
} from "@/components/rehash";
import { runRehash, type RehashOptions } from "../../../shared/rehash";
import type { DealInput, DealCandidate } from "../../../shared/deals";
import type { Car as CarType } from "@shared/schema";
import { fetchCarById } from "@/lib/api";
import {
  computeBadges,
  computeAiInsight,
  computeSmartDecision,
  type VehicleBadge,
  type AiInsight,
  type SmartDecision,
} from "../../../shared/deal-insights";
import type { RuleHit } from "../../../shared/lender-rules";

// Helper to create initial deal input from vehicle
function createDealInputFromVehicle(vehicle: CarType): DealInput {
  const estimatedCost = Math.round(vehicle.price * 0.85);

  return {
    vehicleId: vehicle.id,
    vehicleYear: vehicle.year,
    vehicleMileage: vehicle.mileage,
    vehiclePrice: vehicle.price,
    vehicleCost: estimatedCost,
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
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
    vehicleModel: undefined,
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
    staleTime: 5 * 60 * 1000,
  });

  // State
  const [dealInput, setDealInput] = useState<DealInput>(createDefaultDealInput);
  const [results, setResults] = useState<{
    bestDeal: DealCandidate | null;
    allCandidates: DealCandidate[];
    allRuleHits: RuleHit[];
  } | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealCandidate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lenderOverrides, setLenderOverrides] = useState<LenderConfigOverride[]>([]);

  // Track which vehicleId was used to initialize the form
  const initializedForVehicleIdRef = useRef<string | null>(null);
  const shouldAutoRunRef = useRef(false);

  // Reset and initialize deal input when vehicle changes
  useEffect(() => {
    if (vehicleId && vehicleId !== initializedForVehicleIdRef.current && vehicle) {
      setDealInput(createDealInputFromVehicle(vehicle));
      initializedForVehicleIdRef.current = vehicleId;
      setResults(null);
      setSelectedDeal(null);
      shouldAutoRunRef.current = true;
    } else if (!vehicleId && initializedForVehicleIdRef.current !== "") {
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
    requestAnimationFrame(() => {
      const options: RehashOptions = {
        lenderOverrides: lenderOverrides.length > 0 ? lenderOverrides : undefined,
      };
      const rehashResults = runRehash(input, undefined, options);
      setResults(rehashResults);
      if (rehashResults.bestDeal) {
        setSelectedDeal(rehashResults.bestDeal);
      }
      setIsCalculating(false);
    });
  }, [lenderOverrides]);

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

  // Handle input changes
  const handleInputChange = (field: keyof DealInput, value: DealInput[keyof DealInput]) => {
    setDealInput((prev) => ({ ...prev, [field]: value }));
  };

  // Handle lender config changes from editor
  const handleLenderConfigChange = useCallback((configs: LenderConfigOverride[]) => {
    setLenderOverrides(configs);
  }, []);

  // Computed derived state
  const badges = useMemo<VehicleBadge[]>(() => {
    return computeBadges(
      dealInput,
      results?.bestDeal || null,
      vehicle?.make,
      vehicle?.model,
      results?.allRuleHits || []
    );
  }, [dealInput, results?.bestDeal, results?.allRuleHits, vehicle?.make, vehicle?.model]);

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

  // Convert results to RehashResultsData format
  const resultsData: RehashResultsData | null = results
    ? { bestDeal: results.bestDeal, allCandidates: results.allCandidates }
    : null;

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
            <RehashForm
              dealInput={dealInput}
              onChange={handleInputChange}
              onCalculate={handleFindLenders}
              isCalculating={isCalculating}
            />

            {/* Lender Config Editor (Admin) */}
            <LenderConfigEditor onConfigChange={handleLenderConfigChange} />
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 min-w-0">
            {/* Vehicle Header */}
            <VehicleHeader vehicle={vehicle} badges={badges} />

            {/* Results */}
            <RehashResults
              results={resultsData}
              isCalculating={isCalculating}
              aiInsight={aiInsight}
              smartDecision={smartDecision}
              selectedDeal={selectedDeal}
              onSelectDeal={setSelectedDeal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
