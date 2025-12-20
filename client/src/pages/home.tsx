import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car as CarIcon, Trash2, Volume2, VolumeX, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceInterface } from "@/components/voice-interface";
import { ConversationDisplay } from "@/components/conversation-display";
import { CarInventory } from "@/components/car-inventory";
import { useToast } from "@/hooks/use-toast";
import type { Message, Car } from "@shared/schema";
import { extractFilters, type Filters } from "@/lib/extractFilters";
import { filterInventory, type FilterResult } from "@/lib/filterInventory";

// Test phrases for quick testing
const TEST_PHRASES = [
  "Show me AWD SUVs under 40k with CarPlay and heated seats",
  "Find a 2021 or newer Honda under 30k",
  "Electric sedan under 35k",
  "Truck 4WD under 32k less than 70k miles",
  "7 seater SUV with third row under 45k",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<Filters>({});
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: cars = [], isLoading: carsLoading } = useQuery<Car[]>({
    queryKey: ["/api/cars"],
  });

  // Get filtered cars from filterResult
  const filteredCars = useMemo(() => {
    return filterResult?.results || cars;
  }, [filterResult, cars]);

  const handleTranscription = useCallback((text: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Extract filters using new comprehensive module
    const filters = extractFilters(text, cars);
    setCurrentFilters(filters);

    // Apply filters using new filtering engine
    const result = filterInventory(cars, filters);
    setFilterResult(result);

    // Generate system message
    const count = result.results.length;
    let sysMsg = "";
    
    if (count === 0) {
      sysMsg = "No matches found. Try increasing budget, changing drivetrain, or removing a feature.";
    } else {
      let parts: string[] = [`Showing ${count}`];
      if (filters.drivetrain && filters.drivetrain.length > 0) {
        parts.push(filters.drivetrain.join("/"));
      }
      if (filters.bodyStyle && filters.bodyStyle.length > 0) {
        parts.push(filters.bodyStyle.join("/") + (count > 1 ? "s" : ""));
      } else {
        parts.push(count > 1 ? "vehicles" : "vehicle");
      }
      if (filters.maxPrice) {
        parts.push(`under $${filters.maxPrice.toLocaleString()}`);
      }
      sysMsg = parts.join(" ");
    }
    
    setSystemMessage(sysMsg);

    // Add system response
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: sysMsg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    toast({
      title: "Filters applied",
      description: sysMsg,
    });
  }, [cars, toast]);

  const handleTestPhrase = (phrase: string) => {
    handleTranscription(phrase);
  };

  const handleStopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const handleClearConversation = () => {
    setMessages([]);
    setSystemMessage(null);
    setCurrentFilters({});
    setFilterResult(null);
    handleStopSpeaking();
  };

  const toggleMute = () => {
    if (isSpeaking) {
      handleStopSpeaking();
    }
    setIsMuted((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 h-16 px-4 md:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center" data-testid="logo-container">
              <CarIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight" data-testid="text-app-title">SalesApex AI</h1>
              <p className="text-xs text-muted-foreground hidden sm:block" data-testid="text-app-subtitle">Voice-Controlled Inventory Search</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              data-testid="button-mute-toggle"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full" data-testid="main-content">
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
          <div className="flex flex-col lg:w-[45%] border-r" data-testid="panel-voice">
            <div className="flex-1 overflow-hidden">
              <ConversationDisplay
                messages={messages}
                isLoading={false}
              />
            </div>
            
            <Separator />
            
            <Card className="m-4 p-6 border-card-border" data-testid="card-voice-controls">
              <VoiceInterface
                onTranscription={handleTranscription}
                isProcessing={false}
                isSpeaking={isSpeaking}
                onStopSpeaking={handleStopSpeaking}
                isConfigured={true}
              />
              
              {messages.length > 0 && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearConversation}
                    className="text-muted-foreground"
                    data-testid="button-clear-conversation"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear conversation
                  </Button>
                </div>
              )}

              {/* Test Phrases */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Try these:</p>
                <div className="space-y-2">
                  {TEST_PHRASES.map((phrase, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs h-auto py-2 px-3"
                      onClick={() => handleTestPhrase(phrase)}
                    >
                      {phrase}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Debug Panel */}
              {filterResult && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebug(!showDebug)}
                    className="w-full justify-between text-xs"
                  >
                    <span>Extracted Filters (Debug)</span>
                    {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  {showDebug && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify({
                          filters: currentFilters,
                          totalCars: filterResult.debug.totalCars,
                          matchedCars: filterResult.debug.matchedCars,
                          appliedFilters: filterResult.debug.appliedFilters,
                        }, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="flex-1 lg:w-[55%] overflow-hidden bg-muted/30" data-testid="panel-inventory">
            {/* System Message Banner */}
            {systemMessage && filterResult && (
              <div className={
                filterResult.results.length === 0
                  ? "bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-800 p-4"
                  : "bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 p-4"
              }>
                <p className={
                  filterResult.results.length === 0
                    ? "text-sm text-yellow-800 dark:text-yellow-200 font-medium"
                    : "text-sm text-blue-800 dark:text-blue-200 font-medium"
                }>
                  {systemMessage}
                </p>
                {filterResult.debug.appliedFilters.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Applied: {filterResult.debug.appliedFilters.join(", ")}
                  </p>
                )}
              </div>
            )}
            <CarInventory cars={filteredCars} isLoading={carsLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
