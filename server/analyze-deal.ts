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

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function handleAnalyzeDeal(req: Request, res: Response) {
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
    if (!vehiclePrice || !targetPayment || !bestPayment) {
      return res.status(200).json({
        status: "error",
        analysis: "Missing required deal information",
        strategy: "Ensure vehicle price, target payment, and best payment are provided.",
      } as DealInsight);
    }

    const systemPrompt = `You are an expert auto finance director. Input: targetPayment=${targetPayment}, bestPayment=${bestPayment}, vehiclePrice=${vehiclePrice}, creditTier=${creditTier}, income=${income}, bankRules=${bankRules.join(", ")}.
Analyze gap:

If gap < $50: "good" - Realistic, max profit viable.

If $50 <= gap < $100: "difficult" - Suggest cash down/term stretch.

If gap >= $100: "impossible" - Explain bank rules/equity/LTV; suggest pivot (cheaper car/lease).

Respect bank rules - never suggest breaking them (e.g., no "drop VSC" if mandatory).

Output ONLY valid JSON: {"status": "good|difficult|impossible", "analysis": "1 sentence why", "strategy": "1 actionable sales tip"}. No other text.`;

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Analyze this deal: Target payment $${targetPayment}, Best available payment $${bestPayment}, Gap is $${bestPayment - targetPayment}. Vehicle price $${vehiclePrice}, Credit tier: ${creditTier}, Monthly income: $${income || "not provided"}.`,
          },
        ],
        model: "llama3-70b-8192",
        temperature: 0.3,
        max_tokens: 256,
      });

      const content = chatCompletion.choices[0]?.message?.content || "";

      // Try to parse JSON from response
      let insight: DealInsight;
      try {
        // Extract JSON if wrapped in other text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          insight = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch {
        // If JSON parsing fails, create a fallback response
        const gap = bestPayment - targetPayment;
        insight = {
          status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
          analysis: content.slice(0, 100) || "Unable to parse AI response",
          strategy: "Review the numbers manually and adjust accordingly.",
        };
      }

      return res.status(200).json(insight);
    } catch (groqError) {
      console.error("Groq API error:", groqError);
      return res.status(200).json({
        status: "error",
        analysis: "AI temporarily unavailable",
        strategy: "Use manual calc.",
      } as DealInsight);
    }
  } catch (error) {
    console.error("Analyze deal error:", error);
    return res.status(200).json({
      status: "error",
      analysis: "An unexpected error occurred",
      strategy: "Please try again or use manual calculations.",
    } as DealInsight);
  }
}
