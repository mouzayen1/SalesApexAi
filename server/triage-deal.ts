// server/triage-deal.ts
// Phase 2: Groq-powered Budget Triage
import Groq from "groq-sdk";
import type { Request, Response } from "express";
import type { TriageRequest, TriageResponse } from "../shared/bankFirstTriage";

// API key from environment
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY2;

console.log("[Triage] Groq API Key:", GROQ_API_KEY ? "OK (loaded)" : "MISSING - set GROQ_API_KEY env var");

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export async function handleTriageDeal(req: Request, res: Response) {
  console.log("[Triage] Request received");

  try {
    const body = req.body as TriageRequest;
    const { validDeals, targetPayment, mandatoryProducts = [] } = body;

    console.log("[Triage] Processing", validDeals?.length || 0, "deals for target:", targetPayment);

    // Validate input
    if (!validDeals || validDeals.length === 0) {
      console.log("[Triage] No valid deals provided");
      return res.status(200).json({
        mode: "survival",
        bestDealId: "",
        reason: "No compliant deals available",
        badge: "⚠️ No Options",
      } as TriageResponse);
    }

    if (!targetPayment) {
      console.log("[Triage] No target payment provided");
      return res.status(200).json({
        mode: "survival",
        bestDealId: validDeals[0].id,
        reason: "Target payment not specified",
        badge: "📊 Review Required",
      } as TriageResponse);
    }

    // Calculate close threshold (within 10% of target)
    const closeThreshold = targetPayment * 1.1;

    // Split deals into close and far
    const closeDeals = validDeals.filter(d => d.payment <= closeThreshold);
    const hasCloseDeals = closeDeals.length > 0;

    console.log("[Triage] Close deals:", closeDeals.length, "of", validDeals.length);

    // If no Groq API key, use deterministic fallback
    if (!groq) {
      console.log("[Triage] No Groq API - using deterministic logic");
      return res.status(200).json(deterministicTriage(validDeals, targetPayment, mandatoryProducts));
    }

    // Prepare deals summary for Groq (limit to top 10)
    const dealsSummary = validDeals.slice(0, 10).map((d, i) => ({
      idx: i,
      id: d.id,
      payment: d.payment,
      net: d.netCheckToDealer,
      gap: d.hasGap,
      vsc: d.hasVsc,
      lender: d.lenderName,
    }));

    const systemPrompt = `You are an auto finance expert. Select the BEST deal.
Target payment: $${targetPayment}. Close threshold: $${closeThreshold.toFixed(0)} (target * 1.1).
Mandatory products: ${mandatoryProducts.join(", ") || "none"}.

Rules:
1. If ANY deal has payment <= ${closeThreshold.toFixed(0)}: MODE="profit", pick highest netCheck among close deals.
2. If NO close deals exist: MODE="survival", pick LOWEST payment (do NOT strip mandatory products).

Output ONLY valid JSON:
{"mode":"profit|survival","bestDealId":"the-deal-id","reason":"1 sentence","badge":"emoji + 2-3 words"}

Examples:
- profit mode badge: "💰 Max Profit" or "✅ Target Met"
- survival mode badge: "⚠️ Lowest Possible" or "🔄 Needs Adjustment"`;

    try {
      console.log("[Triage] Calling Groq API...");

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Deals:\n${JSON.stringify(dealsSummary, null, 2)}\n\nSelect best deal.`,
          },
        ],
        model: "llama3-70b-8192",
        temperature: 0.1,
        max_tokens: 150,
      });

      const content = chatCompletion.choices[0]?.message?.content || "";
      console.log("[Triage] Groq response:", content);

      // Parse JSON from response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as TriageResponse;

          // Validate the selected deal exists
          const selectedDeal = validDeals.find(d => d.id === parsed.bestDealId);
          if (!selectedDeal) {
            // Fallback to deterministic if Groq picks invalid ID
            console.log("[Triage] Groq picked invalid deal ID, using fallback");
            return res.status(200).json(deterministicTriage(validDeals, targetPayment, mandatoryProducts));
          }

          console.log("[Triage] Returning Groq result:", parsed);
          return res.status(200).json(parsed);
        }
        throw new Error("No JSON in response");
      } catch (parseError) {
        console.log("[Triage] JSON parse failed, using fallback");
        return res.status(200).json(deterministicTriage(validDeals, targetPayment, mandatoryProducts));
      }
    } catch (groqError: any) {
      console.error("[Triage] Groq API error:", groqError?.message || groqError);
      return res.status(200).json(deterministicTriage(validDeals, targetPayment, mandatoryProducts));
    }
  } catch (error: any) {
    console.error("[Triage] Unexpected error:", error?.message || error);
    return res.status(200).json({
      mode: "survival",
      bestDealId: "",
      reason: "Analysis error occurred",
      badge: "⚠️ Manual Review",
    } as TriageResponse);
  }
}

/**
 * Deterministic fallback when Groq is unavailable
 */
function deterministicTriage(
  deals: TriageRequest["validDeals"],
  targetPayment: number,
  mandatoryProducts: string[]
): TriageResponse {
  const closeThreshold = targetPayment * 1.1;

  // Filter to close deals (payment within 10% of target)
  const closeDeals = deals.filter(d => d.payment <= closeThreshold);

  if (closeDeals.length > 0) {
    // PROFIT MODE: Sort by netCheck DESC, pick highest
    const sorted = [...closeDeals].sort((a, b) => b.netCheckToDealer - a.netCheckToDealer);
    const best = sorted[0];

    const underTarget = best.payment <= targetPayment;
    return {
      mode: "profit",
      bestDealId: best.id,
      reason: underTarget
        ? `Payment $${best.payment.toFixed(0)} meets target with max profit`
        : `Payment $${best.payment.toFixed(0)} within range, maximizing dealer profit`,
      badge: underTarget ? "✅ Target Met" : "💰 Max Profit",
    };
  }

  // SURVIVAL MODE: Sort by payment ASC, pick lowest
  // But respect mandatory products - don't pick deals missing them
  let eligibleDeals = deals;

  if (mandatoryProducts.includes("VSC")) {
    const withVsc = deals.filter(d => d.hasVsc);
    if (withVsc.length > 0) eligibleDeals = withVsc;
  }

  if (mandatoryProducts.includes("GAP")) {
    const withGap = eligibleDeals.filter(d => d.hasGap);
    if (withGap.length > 0) eligibleDeals = withGap;
  }

  const sorted = [...eligibleDeals].sort((a, b) => a.payment - b.payment);
  const best = sorted[0];

  const gap = best.payment - targetPayment;
  return {
    mode: "survival",
    bestDealId: best.id,
    reason: `Lowest possible payment $${best.payment.toFixed(0)} (gap: $${gap.toFixed(0)})`,
    badge: "⚠️ Lowest Possible",
  };
}
