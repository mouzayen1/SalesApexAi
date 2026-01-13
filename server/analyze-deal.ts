// server/analyze-deal.ts
// Groq-powered deal insight analyzer
import Groq from "groq-sdk";
import type { Request, Response } from "express";

interface AnalyzeDealRequest {
  vehiclePrice: number;
  targetPayment: number;
  bestPayment: number;
  creditTier: string;
  income: number;
  bankRules: string[];
}

interface DealInsight {
  status: "good" | "difficult" | "impossible" | "error";
  analysis: string;
  strategy: string;
}

// API key from environment - required for Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY2;

// Log API key status on startup
console.log("[Analyze Deal] Groq API Key:", GROQ_API_KEY ? "OK (loaded)" : "MISSING - set GROQ_API_KEY env var");

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export async function handleAnalyzeDeal(req: Request, res: Response) {
  console.log("[Analyze Deal] Request received:", JSON.stringify(req.body));

  try {
    const body = req.body as AnalyzeDealRequest;
    const {
      vehiclePrice,
      targetPayment,
      bestPayment,
      creditTier,
      income,
      bankRules = [],
    } = body;

    // Validate required fields
    if (!targetPayment || !bestPayment) {
      console.log("[Analyze Deal] Missing required fields");
      const gap = (bestPayment || 0) - (targetPayment || 0);
      return res.status(200).json({
        status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
        analysis: "Basic analysis - some inputs missing",
        strategy: "Verify all deal details are entered.",
      } as DealInsight);
    }

    const gap = bestPayment - targetPayment;
    console.log("[Analyze Deal] Gap calculated:", gap);

    // If no API key, return smart fallback immediately
    if (!groq) {
      console.log("[Analyze Deal] No Groq API key - using fallback logic");
      return res.status(200).json({
        status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
        analysis: gap < 50
          ? "Payment gap is small - deal looks achievable."
          : gap < 100
            ? "Moderate payment gap. Consider negotiation strategies."
            : "Large payment gap. Customer expectations may need adjustment.",
        strategy: gap < 50
          ? "Maximize backend profit while closing the deal."
          : gap < 100
            ? "Suggest cash down payment or extend term to 72-84 months."
            : "Explore lower-priced vehicle or lease alternatives.",
      } as DealInsight);
    }

    // Shortened prompt for reliability (under 200 tokens)
    const systemPrompt = `Auto finance expert. Analyze payment gap.
Gap<$50="good", $50-99="difficult", $100+="impossible".
Rules: ${bankRules.join(", ") || "standard"}.
Output JSON only: {"status":"good|difficult|impossible","analysis":"reason","strategy":"tip"}`;

    try {
      console.log("[Analyze Deal] Calling Groq API...");

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Target:$${targetPayment}, Best:$${bestPayment}, Gap:$${gap}, Tier:${creditTier}, Price:$${vehiclePrice}` },
        ],
        model: "llama3-70b-8192",
        temperature: 0.1,
        max_tokens: 150,
      });

      const content = chatCompletion.choices[0]?.message?.content || "";
      console.log("[Analyze Deal] Groq response:", content);

      // Parse JSON from response
      let insight: DealInsight;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          insight = JSON.parse(jsonMatch[0]);
          // Validate status
          if (!["good", "difficult", "impossible"].includes(insight.status)) {
            insight.status = gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible";
          }
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.log("[Analyze Deal] JSON parse failed, using fallback");
        // Smart fallback based on gap
        insight = {
          status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
          analysis: gap < 50
            ? "Payment gap is manageable. Deal is realistic."
            : gap < 100
              ? "Moderate gap. Consider adjustments."
              : "Large gap. Customer expectations may be unrealistic.",
          strategy: gap < 50
            ? "Maximize backend profit while closing."
            : gap < 100
              ? "Suggest cash down or extend term to 72-84 months."
              : "Explore cheaper vehicle options or lease alternative.",
        };
      }

      console.log("[Analyze Deal] Returning insight:", JSON.stringify(insight));
      return res.status(200).json(insight);

    } catch (groqError: any) {
      console.error("[Analyze Deal] Groq API error:", groqError?.message || groqError);

      // Smart fallback when API fails
      const fallbackInsight: DealInsight = {
        status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
        analysis: gap < 50
          ? "Deal looks achievable based on payment gap."
          : gap < 100
            ? "Moderate challenge - adjustments recommended."
            : "Significant gap - may need alternative approach.",
        strategy: gap < 50
          ? "Proceed with confidence, focus on backend."
          : gap < 100
            ? "Stretch term or request down payment."
            : "Consider lower-priced vehicle or lease option.",
      };

      return res.status(200).json(fallbackInsight);
    }
  } catch (error: any) {
    console.error("[Analyze Deal] Unexpected error:", error?.message || error);

    // Always return valid JSON, never error state for UI
    return res.status(200).json({
      status: "difficult",
      analysis: "Analysis in progress. Review deal manually.",
      strategy: "Use standard negotiation approach.",
    } as DealInsight);
  }
}
