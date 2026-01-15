import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Filter, Loader2, Car as CarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleCard, VehicleCardSkeleton } from "@/components/VehicleCard";
import { FiltersPanel, FilterValues } from "@/components/FiltersPanel";
import { PaymentCalculator, CalculatorValues } from "@/components/PaymentCalculator";
import { VoiceSearchButton } from "@/components/VoiceSearchButton";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { useToast } from "@/hooks/use-toast";
import type { Car } from "@shared/schema";
import { extractFilters, type Filters } from "@/lib/extractFilters";
import { filterInventory } from "@/lib/filterInventory";
import { normalizeFilters } from "@/lib/normalizeFilters";
import { parseBudgetIntent } from "@/lib/parseBudgetIntent";
import { chooseTermForBudget } from "@/lib/budgetFit";
import { calcMonthlyPayment } from "@/lib/payment";
import { fetchCars, type CarsSearchParams } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Home() {
  const { toast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});

  // Calculator state
  const [calculatorEnabled, setCalculatorEnabled] = useState(false);
  const [calculatorValues, setCalculatorValues] = useState<CalculatorValues>({
    down: 5000,
    apr: 13.99,
    termMonths: 72,
    taxRate: 0.09,
    fees: 600,
  });

  // Voice filter state (from voice transcription)
  const [voiceFilters, setVoiceFilters] = useState<Filters>({});
  const [budgetMatches, setBudgetMatches] = useState<Record<string, { payment: number; termMonths: number }>>({});

  // Budget filter defaults
  const DEFAULT_TERMS = [48, 60, 72, 84];
  const DEFAULT_APR = 13.99;
  const DEFAULT_TAX_RATE = 0.09;
  const DEFAULT_FEES = 600;
  const DEFAULT_TOLERANCE = 25;

  // Convert filters to API search params
  const searchParams: CarsSearchParams = useMemo(() => ({
    maxPrice: filters.maxPrice || voiceFilters.maxPrice,
    minPrice: filters.minPrice || voiceFilters.minPrice,
    make: (filters.make?.[0]) || voiceFilters.make?.[0],
    year: filters.minYear || voiceFilters.minYear,
    color: filters.color?.[0] || voiceFilters.color?.[0],
    fuelType: filters.fuel?.[0] || voiceFilters.fuel?.[0],
    q: searchQuery || undefined,
  }), [filters, voiceFilters, searchQuery]);

  // Fetch inventory
  const { data: inventory = [], isLoading, error, refetch } = useQuery<Car[]>({
    queryKey: ["cars", searchParams],
    queryFn: () => fetchCars(searchParams),
  });

  // Handle voice transcription
  const handleVoiceTranscript = useCallback((text: string) => {
    console.log("[Home] Voice transcript:", text);
    setSearchQuery(text);

    // Check for budget intent
    const budget = parseBudgetIntent(text);

    // Extract filters from transcript
    const extractedFilters = extractFilters(text) ?? {};
    const normalized = normalizeFilters(extractedFilters);
    setVoiceFilters(normalized);

    if (budget) {
      // Budget-based filtering
      const down = budget.down ?? 0;
      const targetMonthly = budget.targetMonthly ?? 0;
      const apr = budget.apr ?? DEFAULT_APR;
      const terms = budget.termMonths ? [budget.termMonths] : DEFAULT_TERMS;

      const matches: Record<string, { payment: number; termMonths: number }> = {};
      const safeInventory = Array.isArray(inventory) ? inventory : [];
      const filtered = filterInventory(safeInventory, normalized);

      for (const car of filtered.results) {
        const fit = chooseTermForBudget({
          price: car.price,
          down,
          apr,
          taxRate: DEFAULT_TAX_RATE,
          fees: DEFAULT_FEES,
          targetMonthly,
          tolerance: DEFAULT_TOLERANCE,
          terms,
        });

        if (fit) {
          matches[car.id] = fit;
        }
      }

      setBudgetMatches(matches);

      toast({
        title: `Found ${Object.keys(matches).length} vehicles`,
        description: `Around $${targetMonthly}/mo with $${down} down`,
      });
    } else {
      setBudgetMatches({});
      toast({
        title: "Search updated",
        description: text,
      });
    }
  }, [inventory, toast]);

  // Voice search hook
  const {
    isListening,
    isSupported,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceSearch(handleVoiceTranscript);

  // Apply filters to inventory
  const filteredVehicles = useMemo(() => {
    const safeInventory = Array.isArray(inventory) ? inventory : [];

    // Combine panel filters with voice filters
    const combinedFilters: Filters = {
      ...voiceFilters,
      maxPrice: filters.maxPrice || voiceFilters.maxPrice,
      minPrice: filters.minPrice || voiceFilters.minPrice,
      make: filters.make?.length ? filters.make : voiceFilters.make,
      minYear: filters.minYear || voiceFilters.minYear,
      maxYear: filters.maxYear || voiceFilters.maxYear,
      bodyStyle: filters.bodyStyle?.length ? filters.bodyStyle : voiceFilters.bodyStyle,
      drivetrain: filters.drivetrain?.length ? filters.drivetrain : voiceFilters.drivetrain,
      fuel: filters.fuel?.length ? filters.fuel : voiceFilters.fuel,
      color: filters.color?.length ? filters.color : voiceFilters.color,
    };

    // Filter by client-side filters that aren't handled by API
    let result = safeInventory;

    // Apply body style filter
    if (combinedFilters.bodyStyle?.length) {
      result = result.filter((car) =>
        combinedFilters.bodyStyle!.some(
          (style) => car.body_style?.toLowerCase() === style.toLowerCase()
        )
      );
    }

    // Apply drivetrain filter
    if (combinedFilters.drivetrain?.length) {
      result = result.filter((car) =>
        combinedFilters.drivetrain!.some(
          (dt) => car.drivetrain?.toLowerCase() === dt.toLowerCase()
        )
      );
    }

    // Apply transmission filter
    if (filters.transmission?.length) {
      result = result.filter((car) =>
        filters.transmission!.some(
          (trans) => car.transmission?.toLowerCase() === trans.toLowerCase()
        )
      );
    }

    // Apply mileage filter
    if (filters.maxMiles) {
      result = result.filter((car) => car.mileage <= filters.maxMiles!);
    }

    // If budget matching is active, filter to only matching cars
    if (Object.keys(budgetMatches).length > 0) {
      result = result.filter((car) => car.id in budgetMatches);
    }

    // Apply sort
    if (filters.sort) {
      result = [...result].sort((a, b) => {
        switch (filters.sort) {
          case "price_asc":
            return a.price - b.price;
          case "price_desc":
            return b.price - a.price;
          case "year_desc":
            return b.year - a.year;
          case "mileage_asc":
            return a.mileage - b.mileage;
          default:
            return 0;
        }
      });
    }

    return result;
  }, [inventory, filters, voiceFilters, budgetMatches]);

  // Calculate payments for all vehicles
  const vehiclePayments = useMemo(() => {
    if (!calculatorEnabled) return {};

    const payments: Record<string, number> = {};
    for (const vehicle of filteredVehicles) {
      const { monthlyPayment } = calcMonthlyPayment({
        price: vehicle.price,
        down: calculatorValues.down,
        apr: calculatorValues.apr,
        termMonths: calculatorValues.termMonths,
        taxRate: calculatorValues.taxRate,
        fees: calculatorValues.fees,
      });
      payments[vehicle.id] = monthlyPayment;
    }
    return payments;
  }, [filteredVehicles, calculatorEnabled, calculatorValues]);

  // Get unique makes from inventory for filter options
  const availableMakes = useMemo(() => {
    const makes = new Set<string>();
    for (const car of inventory) {
      if (car.make) makes.add(car.make);
    }
    return Array.from(makes).sort();
  }, [inventory]);

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({});
    setVoiceFilters({});
    setBudgetMatches({});
    setSearchQuery("");
    resetTranscript();
  };

  // Handle search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleVoiceTranscript(searchQuery.trim());
    }
  };

  return (
    <div className="min-h-full">
      {/* Search Header */}
      <div className="sticky top-16 z-40 bg-background border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar Row */}
            <div className="flex items-center gap-3">
              {/* Mobile Filter Toggle */}
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden shrink-0"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>

              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by make, model, or features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </form>

              {/* Voice Search Button */}
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="shrink-0 relative"
                onClick={isListening ? stopListening : startListening}
                disabled={!isSupported}
              >
                {isListening && (
                  <span className="absolute inset-0 rounded-md animate-ping bg-destructive/40" />
                )}
                <svg
                  className={cn("h-4 w-4", isListening && "animate-pulse")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </Button>
            </div>

            {/* Voice status */}
            {(isListening || transcript) && (
              <div className="text-sm text-center">
                {isListening ? (
                  <span className="text-destructive animate-pulse">Listening...</span>
                ) : transcript ? (
                  <span className="text-muted-foreground">"{transcript}"</span>
                ) : null}
              </div>
            )}

            {/* Payment Calculator */}
            <PaymentCalculator
              values={calculatorValues}
              onChange={setCalculatorValues}
              enabled={calculatorEnabled}
              onEnabledChange={setCalculatorEnabled}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <aside
            className={cn(
              "w-72 shrink-0 transition-all duration-300",
              "hidden lg:block",
              showFilters && "fixed inset-0 z-50 block bg-background p-4 lg:relative lg:p-0"
            )}
          >
            {/* Mobile Close Button */}
            {showFilters && (
              <div className="flex justify-end mb-4 lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}

            <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
              <FiltersPanel
                filters={filters}
                onChange={setFilters}
                onClear={handleClearFilters}
                availableMakes={availableMakes}
              />
            </div>
          </aside>

          {/* Mobile Overlay */}
          {showFilters && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
          )}

          {/* Results Grid */}
          <main className="flex-1 min-w-0">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">
                  {isLoading ? (
                    "Loading..."
                  ) : (
                    <>
                      {filteredVehicles.length} Vehicle
                      {filteredVehicles.length !== 1 ? "s" : ""} Found
                    </>
                  )}
                </h1>
                {Object.keys(budgetMatches).length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Filtered by budget match
                  </p>
                )}
              </div>

              {/* Active filters summary */}
              {(Object.keys(filters).length > 0 || Object.keys(voiceFilters).length > 0) && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <VehicleCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-12">
                <p className="text-destructive mb-4">Failed to load inventory</p>
                <Button onClick={() => refetch()}>Try Again</Button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredVehicles.length === 0 && (
              <div className="text-center py-12">
                <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No vehicles found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or search query
                </p>
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}

            {/* Results Grid */}
            {!isLoading && !error && filteredVehicles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    estimatedPayment={
                      calculatorEnabled
                        ? vehiclePayments[vehicle.id]
                        : budgetMatches[vehicle.id]?.payment
                    }
                    paymentTerm={
                      calculatorEnabled
                        ? calculatorValues.termMonths
                        : budgetMatches[vehicle.id]?.termMonths
                    }
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
