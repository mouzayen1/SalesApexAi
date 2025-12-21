import { useState, useRef, useCallback, useMemo } from "react";
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
import ResultsBottomSheet from "@/components/ResultsBottomSheet";

// Test phrases for quick testing
const TEST_PHRASES = [
  "Show me AWD SUVs under 40k with CarPlay and heated seats",
  "Find a 2021 or newer Honda under 30K",  "Electric sedan under 35k",
  "Truck 4WD under 32k less than 70k miles",
  "7 seater SUV with third row under 45K",
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

  const { data: inventory = [] } = useQuery<Car[]>({
    queryKey: ["/api/cars"],  });

  const { toast } = useToast();

  const handleTranscription = useCallback((text: string) => {
    console.log("[Home] Transcription received:", text);
    
    // Extract filters from transcript
    const filters = extractFilters(text) ?? {};
    setCurrentFilters(filters);
    console.log("[Home] Extracted filters:", filters);
    
    // Filter inventory
    const result = filterInventory(inventory, filters);    console.log("[Home] Filter result:", result);
    
    // Generate title and subtitle
    const title = result.matches.length === 0 
      ? "No matches found"
      : `Found ${result.matches.length} ${result.matches.length === 1 ? 'vehicle' : 'vehicles'}`;
    
    const subtitle = Object.keys(filters).length === 0
      ? "Try adding filters like price, make, or features"
      : generateSubtitle(filters);
    
    // Update bottom sheet
    setSheetTitle(title);
    setSheetSubtitle(subtitle);
    setSheetResults(result);
    setSheetOpen(true);
    
    // Set system message banner
    if (result.matches.length === 0) {
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
      />
    </div>
  );
}

function generateSubtitle(filters: Filters): string {
    if (!filters) return "All vehicles";
  const parts: string[] = [];
  
  if (filters.make) parts.push(filters.make);
  if (filters.year?.min) parts.push(`${filters.year.min}+`);
  if (filters.price?.max) parts.push(`Under $${(filters.price.max / 1000).toFixed(0)}k`);
  if (filters.drivetrain) parts.push(filters.drivetrain.toUpperCase());
  if (filters.body_style) parts.push(filters.body_style);
  if (filters.fuel_type) parts.push(filters.fuel_type);
  
  const features: string[] = [];  if (filters.features?.carplay) features.push("CarPlay");
  if (filters.features?.heated_seats) features.push("Heated Seats");
  if (filters.features?.sunroof) features.push("Sunroof");
  if (filters.features?.backup_camera) features.push("Backup Camera");
  if (filters.features?.leather) features.push("Leather");
  if (filters.features?.third_row) features.push("3rd Row");
  
  if (features.length > 0) parts.push(features.join(", "));
  
  return parts.length > 0 ? parts.join(" • ") : "All vehicles";
}
