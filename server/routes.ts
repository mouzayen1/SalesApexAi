import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { conversationRequestSchema } from "@shared/schema";
import { isGroqConfigured, generateSmartDealInsight } from "./groqService";
import type { SmartDealAIRequest } from "@shared/smartDealAI";
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI stub functions (not yet implemented)
function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

async function transcribeAudio(_buffer: Buffer): Promise<string> {
  throw new Error("OpenAI transcription not yet implemented");
}

async function generateChatResponse(_messages: any[], _userMessage: string): Promise<string> {
  throw new Error("OpenAI chat not yet implemented");
}

async function generateSpeech(_text: string): Promise<Buffer> {
  throw new Error("OpenAI TTS not yet implemented");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all cars
  app.get("/api/cars", async (req, res) => {
    try {
      const cars = await storage.getAllCars();
      res.json(cars);
    } catch (error) {
      console.error("Error fetching cars:", error);
      res.status(500).json({ error: "Failed to fetch cars" });
    }
  });

  // Search cars
  app.get("/api/cars/search", async (req, res) => {
    try {
      const { make, minPrice, maxPrice, year, color, fuelType } = req.query;
      const cars = await storage.searchCars({
        make: make as string | undefined,
        minPrice: minPrice ? parseInt(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        color: color as string | undefined,
        fuelType: fuelType as string | undefined,
      });
      res.json(cars);
    } catch (error) {
      console.error("Error searching cars:", error);
      res.status(500).json({ error: "Failed to search cars" });
    }
  });

  // Get car by ID
  app.get("/api/cars/:id", async (req, res) => {
    try {
      const car = await storage.getCarById(req.params.id);
      if (!car) {
        return res.status(404).json({ error: "Car not found" });
      }
      res.json(car);
    } catch (error) {
      console.error("Error fetching car:", error);
      res.status(500).json({ error: "Failed to fetch car" });
    }
  });

  
  // Check if OpenAI is configured
  app.get("/api/config", (req, res) => {
    res.json({ openaiConfigured: isConfigured() });
  });

  // Transcribe audio
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({ error: "OpenAI API key not configured" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const text = await transcribeAudio(req.file.buffer);
      res.json({ text });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // Chat with AI
  app.post("/api/chat", async (req, res) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({ error: "OpenAI API key not configured. Please add your OPENAI_API_KEY to use the AI assistant." });
      }
      
      const parsed = conversationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body" });
      }

      const { messages, userMessage } = parsed.data;
      
      const responseText = await generateChatResponse(messages, userMessage);
      
      // Generate speech for the response
      const audioBuffer = await generateSpeech(responseText);
      const audioBase64 = audioBuffer.toString("base64");
      const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

      res.json({
        message: responseText,
        audioUrl,
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // Text-to-speech
  app.post("/api/tts", async (req, res) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({ error: "OpenAI API key not configured" });
      }

      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const audioBuffer = await generateSpeech(text);
      res.set({
        "Content-Type": "audio/mp3",
        "Content-Length": audioBuffer.length,
      });
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Check if Groq AI is configured
  app.get("/api/groq/config", (req, res) => {
    res.json({ groqConfigured: isGroqConfigured() });
  });

  // Smart Deal AI - Generate insight for deal analysis
  app.post("/api/smart-deal-ai", async (req, res) => {
    try {
      if (!isGroqConfigured()) {
        return res.status(503).json({
          error: "Groq API key not configured. Please add GROQ_API_KEY to use Smart Deal AI."
        });
      }

      const request = req.body as SmartDealAIRequest;

      // Validate required fields
      if (
        typeof request.targetPayment !== 'number' ||
        typeof request.bestProfitPayment !== 'number' ||
        typeof request.floorPayment !== 'number'
      ) {
        return res.status(400).json({
          error: "Invalid request: targetPayment, bestProfitPayment, and floorPayment are required"
        });
      }

      const insight = await generateSmartDealInsight(request);
      res.json(insight);
    } catch (error) {
      console.error("Smart Deal AI error:", error);
      res.status(500).json({ error: "Failed to generate AI insight" });
    }
  });

  return httpServer;
}
