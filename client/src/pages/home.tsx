import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car as CarIcon, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceInterface } from "@/components/voice-interface";
import { ConversationDisplay } from "@/components/conversation-display";
import { CarInventory } from "@/components/car-inventory";
import { useToast } from "@/hooks/use-toast";
import type { Message, Car } from "@shared/schema";

// Deterministic filter parser
function parseFilters(transcript: string) {
  const lower = transcript.toLowerCase();
  const filters: {
    bodyStyle?: string;
    drivetrain?: string;
    maxPrice?: number;
        color?: string;
    make?: string;
  } = {};

  // Body style detection
  if (lower.includes("suv")) filters.bodyStyle = "SUV";
  else if (lower.includes("sedan")) filters.bodyStyle = "Sedan";
  else if (lower.includes("truck")) filters.bodyStyle = "Truck";
  else if (lower.includes("coupe")) filters.bodyStyle = "Coupe";

  // Drivetrain detection
  if (lower.includes("awd") || lower.includes("all wheel")) filters.drivetrain = "AWD";
  else if (lower.includes("fwd") || lower.includes("front wheel")) filters.drivetrain = "FWD";
  else if (lower.includes("4wd") || lower.includes("four wheel")) filters.drivetrain = "4WD";
  else if (lower.includes("rwd") || lower.includes("rear wheel")) filters.drivetrain = "RWD";

  // Price detection (under $X)
  const priceMatch = lower.match(/under\s?\$?(\d{2,6})k?/);
  if (priceMatch) {
    const num = parseInt(priceMatch[1]);
    filters.maxPrice = priceMatch[0].includes("k") ? num * 1000 : num;
  }

    // Color detection
  if (lower.includes("silver") || lower.includes("grey") || lower.includes("gray")) filters.color = "Silver";
  else if (lower.includes("white")) filters.color = "White";
  else if (lower.includes("black")) filters.color = "Black";
  else if (lower.includes("blue")) filters.color = "Blue";
  else if (lower.includes("red")) filters.color = "Red";

  // Make/Model detection
  if (lower.includes("tesla")) filters.make = "Tesla";
  else if (lower.includes("toyota")) filters.make = "Toyota";
  else if (lower.includes("honda")) filters.make = "Honda";
  else if (lower.includes("ford")) filters.make = "Ford";
  else if (lower.includes("chevrolet") || lower.includes("chevy")) filters.make = "Chevrolet";

  return filters;
}

// Generate system message
function generateSystemMessage(count: number, filters: any): string {
  if (count === 0) {
    return "No matches found. Try adjusting your budget, drivetrain, or vehicle type.";
  }

  let parts: string[] = [];
  parts.push(`Showing ${count}`);
  if (filters.drivetrain) parts.push(filters.drivetrain);
  if (filters.bodyStyle) parts.push(filters.bodyStyle + (count > 1 ? "s" : ""));
  else parts.push(count > 1 ? "vehicles" : "vehicle");
  if (filters.maxPrice) parts.push(`under $${filters.maxPrice.toLocaleString()}`);

  return parts.join(" ");
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const { data: cars = [], isLoading: carsLoading } = useQuery<Car[]>({
    queryKey: ["/api/cars"],
  });

  // Filter cars based on current filters
  const filteredCars = useMemo(() => {
    if (!cars.length) return [];
    
    return cars.filter((car) => {
      if (currentFilters.bodyStyle && car.body_style !== currentFilters.bodyStyle) return false;
      if (currentFilters.drivetrain && car.drivetrain !== currentFilters.drivetrain) return false;
      if (currentFilters.maxPrice && car.price > currentFilters.maxPrice) return false;
            if (currentFilters.color && car.color !== currentFilters.color) return false;
      if (currentFilters.make && car.make !== currentFilters.make) return false;
      return true;
    });
  }, [cars, currentFilters]);

  const handleTranscription = useCallback((text: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Parse filters from transcript
    const filters = parseFilters(text);
    setCurrentFilters(filters);

    // Generate system message
    const matchCount = cars.filter((car) => {
      if (filters.bodyStyle && car.body_style !== filters.bodyStyle) return false;
      if (filters.drivetrain && car.drivetrain !== filters.drivetrain) return false;
      if (filters.maxPrice && car.price > filters.maxPrice) return false;
                if (filters.color && car.color !== filters.color) return false;
      if (filters.make && car.make !== filters.make) return false;

      return true;
    }).length;

    const sysMsg = generateSystemMessage(matchCount, filters);
    setSystemMessage(sysMsg);

    // Add system response as assistant message
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
            </Card>
          </div>

          <div className="flex-1 lg:w-[55%] overflow-hidden bg-muted/30" data-testid="panel-inventory">
            <CarInventory cars={filteredCars} isLoading={carsLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
