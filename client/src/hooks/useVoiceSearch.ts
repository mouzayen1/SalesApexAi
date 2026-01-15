import { useState, useRef, useCallback, useEffect } from "react";

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

export interface UseVoiceSearchReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceSearch(onTranscript?: (text: string) => void): UseVoiceSearchReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const transcriptRef = useRef<string>("");

  // Check if browser supports SpeechRecognition
  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const isSupported = !!SpeechRecognition;

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported");
      return;
    }

    try {
      setError(null);
      setTranscript("");
      setInterimTranscript("");
      transcriptRef.current = "";

      const recognition = new SpeechRecognition() as SpeechRecognitionType;
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += result + " ";
          } else {
            interim += result;
          }
        }

        if (interim) setInterimTranscript(interim);
        if (final) {
          setTranscript((prev) => prev + final);
          transcriptRef.current += final;
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        let errorMsg = "Recognition error";

        if (event.error === "not-allowed" || event.error === "permission-denied") {
          errorMsg = "Microphone permission denied";
        } else if (event.error === "no-speech") {
          errorMsg = "No speech detected";
        } else if (event.error === "network") {
          errorMsg = "Network error";
        }

        setError(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        const fullTranscript = transcriptRef.current.trim();
        if (fullTranscript && onTranscript) {
          onTranscript(fullTranscript);
        }
      };

      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("Error starting recognition:", err);
      setError("Failed to start listening");
    }
  }, [SpeechRecognition, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    transcriptRef.current = "";
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
