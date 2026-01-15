import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceSearchButtonProps {
  isListening: boolean;
  isSupported: boolean;
  transcript?: string;
  error?: string;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceSearchButton({
  isListening,
  isSupported,
  transcript,
  error,
  onStart,
  onStop,
}: VoiceSearchButtonProps) {
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <MicOff className="h-4 w-4" />
        <span>Voice search not supported</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Button */}
      <div className="relative">
        <Button
          variant={isListening ? "destructive" : "default"}
          size="lg"
          onClick={isListening ? onStop : onStart}
          className={cn(
            "h-12 w-12 rounded-full p-0 transition-all",
            isListening && "ring-4 ring-destructive/30"
          )}
        >
          <Mic className={cn("h-5 w-5", isListening && "animate-pulse")} />
        </Button>

        {/* Ping animation when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full animate-ping bg-destructive/40" />
        )}
      </div>

      {/* Status Text */}
      <div className="text-center min-h-[20px]">
        {isListening && (
          <p className="text-sm font-medium text-destructive animate-pulse">
            Listening...
          </p>
        )}
        {transcript && !isListening && (
          <p className="text-sm text-muted-foreground max-w-xs truncate">
            "{transcript}"
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!isListening && !transcript && !error && (
          <p className="text-sm text-muted-foreground">
            Click to search by voice
          </p>
        )}
      </div>

      {/* Example commands */}
      {!isListening && !error && (
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">Try saying:</p>
          <p className="text-xs text-muted-foreground italic">
            "Show me Toyota SUVs under $30,000"
          </p>
          <p className="text-xs text-muted-foreground italic">
            "2020 or newer with AWD"
          </p>
        </div>
      )}
    </div>
  );
}
