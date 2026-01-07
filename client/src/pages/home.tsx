import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { Car as CarIcon, Trash2, Volume2, VolumeX, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceInterface } from "@/components/voice-interface";
import { CarInventory } from "@/components/car-inventory";
import { useToast } from "@/hooks/use-toast";
import type { Message, Car } from "@shared/schema";
import { extractFilters, type Filters } from "@/lib/extractFilters";
import { filterInventory, type FilterResult } from "@/lib/filterInventory";
import { normalizeFilters } from "@/lib/normalizeFilters";
import { parseBudgetIntent } from "../lib/parseBudgetIntent";
import { chooseTermForBudget } from "../lib/budgetFit";
import ResultsBottomSheet from "@/components/ResultsBottomSheet";
import PaymentCalculatorPanel, { PaymentAssumptions } from "../components/PaymentCalculatorPanel";
import { calcMonthlyPayment } from "../lib/payment";
import { fetchCars, type CarsSearchParams } from "@/lib/api";

// Test phrases for quick testing
const TEST_PHRASES = [
  "Show me all vehicles under 30k",
  "Find a 2021 or newer Honda under 30K",  "Show me only electric vehicles",
  "Truck 4WD under 32k less than 70k miles",
  "Find only coupe 2 door vehicles",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<Filters>({});
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetSubtitle, setSheetSubtitle] = useState("");
  const [sheetResults, setSheetResults] = useState<FilterResult | null>(null);
    const [budgetMatches, setBudgetMatches] = useState<Record<string, {payment: number; termMonths: number}>>({});
  const [budgetSummary, setBudgetSummary] = useState<string>("");
    const [paymentAssumptions, setPaymentAssumptions] = useState<PaymentAssumptions>({
    down: 5000,
    targetMonthly: 400,
    apr: 13.99,
    termMonths: 72,
    taxRate: 0.09,
    fees: 600,
    tolerance: 25
  });
  const [budgetFilterEnabled, setBudgetFilterEnabled] = useState(false);
  const [carPayments, setCarPayments] = useState<Record<string, number>>({});
  const [baseFilteredCars, setBaseFilteredCars] = useState<Car[]>([]);
    // Budget filter defaults
  const DEFAULT_TERMS = [48, 60, 72, 84];
  const DEFAULT_APR = 13.99;
  const DEFAULT_TAX_RATE = 0.09;
  const DEFAULT_FEES = 600;
  const DEFAULT_TOLERANCE = 25;

// Convert normalized filters to API search params
  const searchParams: CarsSearchParams = {
    maxPrice: currentFilters.maxPrice,
    minPrice: currentFilters.minPrice,
    make: currentFilters.make?.[0], // API expects single make
    year: currentFilters.minYear,
    color: currentFilters.color?.[0],
    fuelType: currentFilters.fuel?.[0],
  };

  const { data: inventory = [], isLoading, error } = useQuery<Car[]>({
    queryKey: ["cars", searchParams],
    queryFn: () => fetchCars(searchParams),
  });
  const { toast } = useToast();

    // Compute monthly payments for all visible cars
  useEffect(() => {
    const carsToDisplay = sheetResults?.results ?? [];
    const map: Record<string, number> = {};

    for (const car of carsToDisplay) {
      const { monthlyPayment } = calcMonthlyPayment({
        price: car.price,
        down: paymentAssumptions.down,
        apr: paymentAssumptions.apr,
        termMonths: paymentAssumptions.termMonths,
        taxRate: paymentAssumptions.taxRate,
        fees: paymentAssumptions.fees
      });
      map[car.id] = monthlyPayment;
    }

    setCarPayments(map);
  }, [sheetResults, paymentAssumptions]);

    // Apply budget filter
  function applyBudgetFilter() {
    setBudgetFilterEnabled(true);
    
    const baseList = baseFilteredCars.length > 0 ? baseFilteredCars : (inventory ?? []);
    
    const results = baseList.filter((car) => {
      const { monthlyPayment } = calcMonthlyPayment({
        price: car.price,
        down: paymentAssumptions.down,
        apr: paymentAssumptions.apr,
        termMonths: paymentAssumptions.termMonths,
        taxRate: paymentAssumptions.taxRate,
        fees: paymentAssumptions.fees
      });
      return Math.abs(monthlyPayment - paymentAssumptions.targetMonthly) <= paymentAssumptions.tolerance;
    });
    
    setSheetResults({ results, filters: currentFilters });
    setSheetTitle(`Found ${results.length} vehicles`);
    setSheetSubtitle(`~$${paymentAssumptions.targetMonthly}/mo with $${paymentAssumptions.down} down`);
    setSheetOpen(true);
  }
  
  // Clear budget filter
  function clearBudgetFilter() {
    setBudgetFilterEnabled(false);
    // Restore to base filtered cars
    const baseList = baseFilteredCars.length > 0 ? baseFilteredCars : (inventory ?? []);
    setSheetResults({ results: baseList, filters: currentFilters });
    setSheetTitle(`Found ${baseList.length} vehicles`);
    setSheetSubtitle(generateSubtitle(currentFilters));
  }

      const handleTranscription = useCallback((text: string) => {
    console.log("[Home] Transcription received:", text);

        // Check for budget intent first
    const budget = parseBudgetIntent(text);
    if (budget) {
      // Apply existing filter extraction for other criteria (SUV, AWD, etc.)
      const filters = extractFilters(text) ?? {};
      const normalized = normalizeFilters(filters);
      setCurrentFilters(normalized);

      const safeInventory = Array.isArray(inventory) ? inventory : [];
      const intermediateResult = filterInventory(safeInventory, normalized);
      const filteredCars = intermediateResult.results || [];

      const down = budget.down ?? 0;
      const targetMonthly = budget.targetMonthly ?? 0;
      const apr = budget.apr ?? DEFAULT_APR;
      const terms = budget.termMonths ? [budget.termMonths] : DEFAULT_TERMS;

      const matches: Record<string, {payment: number; termMonths: number}> = {};
      const resultCars = [];

      for (const car of filteredCars) {
        const fit = chooseTermForBudget({
          price: car.price,
          down,
          apr,
          taxRate: DEFAULT_TAX_RATE,
          fees: DEFAULT_FEES,
          targetMonthly,
          tolerance: DEFAULT_TOLERANCE,
          terms
        });

        if (fit) {
          matches[car.id] = fit;
          resultCars.push(car);
        }
      }

      setBudgetMatches(matches);
      setBudgetSummary(`Showing ${resultCars.length} matches for ~$${targetMonthly}/mo with $${down} down (${apr}% APR).`);
      
      const budgetResult = {
        results: resultCars,
        filters: normalized
      };
      setSheetResults(budgetResult);
      setSheetTitle(`Found ${resultCars.length} vehicles`);
      setSheetSubtitle(generateSubtitle(normalized));
      setSheetOpen(true);
      return;
    }
    
    // Extract filters from transcript
    const filters = extractFilters(text) ?? {};
        const normalized = normalizeFilters(filters);
    setCurrentFilters(normalized);
    console.log("[Home] Extracted filters:", filters);
    
    // Filter inventory
        const safeInventory = Array.isArray(inventory) ? inventory : [];
    const result = filterInventory(safeInventory, normalized);    console.log("[Home] Filter result:", result);
    
    // Generate title and subtitle
    const title = result.results.length === 0 
      ? "No matches found"
      : `Found ${result.results.length} ${result.results.length === 1 ? 'vehicle' : 'vehicles'}`;
    
    const subtitle = Object.keys(normalized).length === 0
      ? "Try adding filters like price, make, or features"
      : generateSubtitle(normalized);
    
    // Update bottom sheet
    setSheetTitle(title);
    setSheetSubtitle(subtitle);
    setSheetResults(result);
        setBaseFilteredCars(result.results);
    setSheetOpen(true);
    
    // Set system message banner
    if (result.results.length === 0) {
      setSystemMessage(result.reasoning || "No vehicles match your criteria");
    } else {
      setSystemMessage(result.reasoning || null);
    }
  }, [inventory]);

  const handleTestPhrase = (phrase: string) => {
    handleTranscription(phrase);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CarIcon className="h-6 w-6" />
            <h1 className="text-xl font-bold">AutoVoice AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

            {/* Payment Calculator Panel */}
      <div className="container mx-auto px-4 py-6">
        <PaymentCalculatorPanel
          value={paymentAssumptions}
          onChange={setPaymentAssumptions}
          onApplyFilter={applyBudgetFilter}
          onClearFilter={clearBudgetFilter}
        />
      </div>

      {systemMessage && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-900 dark:text-blue-100">{systemMessage}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSystemMessage(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Voice-Driven Car Search</h2>
            <p className="text-muted-foreground mb-6">
              Use your voice to search our inventory. Try saying things like "Show me AWD SUVs under 40k" or "Find a Honda under 30K"
            </p>
            <VoiceInterface
              onTranscription={handleTranscription}
              isSpeaking={isSpeaking}              isMuted={isMuted}
            />
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-3">Quick Test Phrases</h3>
            <div className="flex flex-wrap gap-2">
              {TEST_PHRASES.map((phrase, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestPhrase(phrase)}
                >
                  {phrase}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Debug Panel</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDebugOpen(!debugOpen)}
              >
                {debugOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {debugOpen && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Filters:</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                    {JSON.stringify(currentFilters, null, 2)}                  </pre>
                </div>
                {sheetResults && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Filter Results:</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                      {JSON.stringify(sheetResults, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </main>

      <ResultsBottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        results={sheetResults}
                carPayments={carPayments}
        paymentTermMonths={paymentAssumptions.termMonths}
        paymentApr={paymentAssumptions.apr}
        paymentDown={paymentAssumptions.down}
                budgetMatches={budgetMatches}
        budgetSummary={budgetSummary}
      />
    </div>
  );
}

import type { NormalizedFilters } from "@/lib/normalizeFilters";

function generateSubtitle(filters: NormalizedFilters): string {
  if (!filters) return "All vehicles";
  const parts: string[] = [];

  if (filters.make?.length) parts.push(filters.make.join("/"));
  if (filters.minYear) parts.push(`${filters.minYear}+`);
  if (filters.maxPrice) parts.push(`Under $${(filters.maxPrice / 1000).toFixed(0)}k`);
  if (filters.drivetrain?.length) parts.push(filters.drivetrain.map(d => d.toUpperCase()).join("/"));
  if (filters.bodyStyle?.length) parts.push(filters.bodyStyle.join("/"));
  if (filters.fuel?.length) parts.push(filters.fuel.join("/"));

  if (filters.features?.length) {
    const featureLabels = filters.features.map(f => {
      if (f === "carplay") return "CarPlay";
      if (f === "heated_seats") return "Heated Seats";
      if (f === "sunroof") return "Sunroof";
      if (f === "backup_camera") return "Backup Camera";
      if (f === "leather") return "Leather";
      if (f === "third_row") return "3rd Row";
      return f;
    });
    parts.push(featureLabels.join(", "));
  }

  return parts.length > 0 ? parts.join(" • ") : "All vehicles";
}
