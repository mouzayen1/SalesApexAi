import { useState, useRef, useEffect } from "react";
import { Mic, Square, Volume2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface VoiceInterfaceProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  isConfigured?: boolean;
}

// Browser SpeechRecognition types
type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
};

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceInterface({
  onTranscription,
  isProcessing,
  isSpeaking,
  onStopSpeaking,
  isConfigured = true,
}: VoiceInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
    const transcriptRef = useRef<string>("");
  const { toast } = useToast();

  // Check if browser supports SpeechRecognition
  const SpeechRecognition = 
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const getStatus = () => {
    if (voiceError) return voiceError;
    if (isSpeaking) return "Speaking...";
    if (isProcessing) return "Processing...";
    if (isListening) return "Listening...";
    if (interimTranscript) return interimTranscript;
    if (finalTranscript) return `Heard: ${finalTranscript}`;
    return "Press to speak";
  };

  const startListening = () => {
    if (!SpeechRecognition) {
      const errorMsg = "Speech recognition requires Chrome or Edge browser";
      setVoiceError(errorMsg);
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: errorMsg,
      });
      return;
    }

    try {
      setVoiceError(null);
      setFinalTranscript("");
      setInterimTranscript("");

      const recognition = new SpeechRecognition() as SpeechRecognitionType;
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript + " ";
          } else {
            interim += transcript;
          }
        }

        if (interim) setInterimTranscript(interim);
        if (final) {
          setFinalTranscript((prev) => prev + final);
                  transcriptRef.current += final;
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        let errorMsg = "Recognition error";
        
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          errorMsg = "Microphone permission denied";
        } else if (event.error === 'no-speech') {
          errorMsg = "No speech detected";
        } else if (event.error === 'network') {
          errorMsg = "Network error";
        }

        setVoiceError(errorMsg);
        stopListening();
        
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMsg,
        });
      };

      recognition.onend = () => {
        setIsListening(false);
    const fullTranscript = transcriptRef.current.trim();        if (fullTranscript) {
          onTranscription(fullTranscript);
            transcriptRef.current = ""; // Clear for next recognition
        }
      };

      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error("Error starting recognition:", error);
      setVoiceError("Failed to start listening");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start speech recognition",
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleMicClick = () => {
    if (isSpeaking) {
      onStopSpeaking();
      return;
    }

    if (isListening) {
      stopListening();
    } else if (!isProcessing) {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <Button
          size="icon"
          variant={isListening ? "destructive" : isSpeaking ? "secondary" : "default"}
          className={cn(
            "w-24 h-24 rounded-full transition-all duration-300",
            isListening && "animate-pulse"
          )}
          onClick={handleMicClick}
          disabled={isProcessing || !SpeechRecognition}
          data-testid="button-microphone"
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isSpeaking ? (
            <Volume2 className="w-10 h-10" />
          ) : isListening ? (
            <Square className="w-8 h-8" />
          ) : voiceError ? (
            <AlertCircle className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </Button>

        {(isListening || isSpeaking) && (
          <div className="absolute inset-0 -z-10 rounded-full animate-ping bg-primary/20" />
        )}
      </div>

      {/* Debug panel showing transcripts */}
      <div className="w-full max-w-md space-y-2">
        <p
          className={cn(
            "text-sm font-medium text-center transition-colors min-h-[20px]",
            isListening ? "text-destructive" :
            voiceError ? "text-destructive" :
            isSpeaking ? "text-foreground" : "text-muted-foreground"
          )}
          data-testid="text-voice-status"
        >
          {getStatus()}
        </p>
        
        {(finalTranscript || interimTranscript) && (
          <div className="p-3 bg-muted rounded-md space-y-1">
            {finalTranscript && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Final:</span> {finalTranscript}
              </p>
            )}
            {interimTranscript && (
              <p className="text-xs text-muted-foreground italic">
                <span className="font-semibold">Interim:</span> {interimTranscript}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
