// client/src/components/deal/AIInsightCard.tsx
// Groq AI-powered deal insight card
import { useState, useEffect } from "react";

interface DealInsight {
  status: "good" | "difficult" | "impossible" | "error";
  analysis: string;
  strategy: string;
}

interface AIInsightCardProps {
  vehiclePrice: number;
  targetPayment: number;
  bestDeal: {
    payment: number;
    lenderName?: string;
    ltv?: number;
    hasGap?: boolean;
    hasVsc?: boolean;
  } | null;
  creditTier: string;
  income: number;
}

export default function AIInsightCard({
  vehiclePrice,
  targetPayment,
  bestDeal,
  creditTier,
  income,
}: AIInsightCardProps) {
  const [insight, setInsight] = useState<DealInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate gap
  const gap = bestDeal?.payment ? bestDeal.payment - targetPayment : 0;

  // Build bank rules from deal context
  const getBankRules = () => {
    const rules: string[] = [];
    if (bestDeal?.ltv && bestDeal.ltv > 100) {
      rules.push(`Max LTV ${Math.ceil(bestDeal.ltv)}%`);
    }
    if (bestDeal?.hasVsc) {
      rules.push("Includes VSC");
    }
    if (bestDeal?.hasGap) {
      rules.push("Includes GAP");
    }
    return rules;
  };

  useEffect(() => {
    // Only fetch if there's a positive gap (customer wants less than best available)
    if (gap <= 0 || !bestDeal?.payment || !vehiclePrice) {
      setInsight(null);
      return;
    }

    const fetchInsight = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/analyze-deal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehiclePrice,
            targetPayment,
            bestPayment: bestDeal.payment,
            creditTier,
            income: income || 0,
            bankRules: getBankRules(),
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setInsight(data);
      } catch (err) {
        console.error("AI Insight fetch error:", err);
        setError("Failed to fetch insight");
        // Set fallback insight
        setInsight({
          status: "error",
          analysis: "Check inputs",
          strategy: "Recalculate.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInsight();
  }, [vehiclePrice, creditTier, targetPayment, bestDeal?.payment]);

  // Don't render if no gap or no best deal
  if (gap <= 0 || !bestDeal?.payment) {
    return null;
  }

  // Border color based on status
  const getBorderColor = () => {
    if (!insight) return "border-slate-600";
    switch (insight.status) {
      case "good":
        return "border-green-500";
      case "difficult":
        return "border-yellow-500";
      case "impossible":
      case "error":
        return "border-red-500";
      default:
        return "border-slate-600";
    }
  };

  // Background gradient based on status
  const getBackgroundClass = () => {
    if (!insight) return "bg-slate-800/50";
    switch (insight.status) {
      case "good":
        return "bg-gradient-to-r from-green-900/20 to-green-800/10";
      case "difficult":
        return "bg-gradient-to-r from-yellow-900/20 to-amber-800/10";
      case "impossible":
      case "error":
        return "bg-gradient-to-r from-red-900/20 to-red-800/10";
      default:
        return "bg-slate-800/50";
    }
  };

  // Status emoji
  const getStatusEmoji = () => {
    if (!insight) return "";
    switch (insight.status) {
      case "good":
        return "✅";
      case "difficult":
        return "⚠️";
      case "impossible":
        return "🚫";
      case "error":
        return "❌";
      default:
        return "";
    }
  };

  return (
    <div
      className={`mb-4 rounded-lg border-2 ${getBorderColor()} ${getBackgroundClass()} p-3 transition-all duration-300`}
      style={{ minHeight: "80px" }}
    >
      <div className="flex items-start gap-3">
        {/* AI Label */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center rounded-full bg-indigo-600/80 px-2 py-0.5 text-xs font-semibold text-white">
            AI Insight
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            // Skeleton loader
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          ) : insight ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getStatusEmoji()}</span>
                <span
                  className={`text-sm font-semibold capitalize ${
                    insight.status === "good"
                      ? "text-green-300"
                      : insight.status === "difficult"
                      ? "text-yellow-300"
                      : "text-red-300"
                  }`}
                >
                  {insight.status === "good"
                    ? "Realistic Deal"
                    : insight.status === "difficult"
                    ? "Challenging"
                    : insight.status === "impossible"
                    ? "Unrealistic"
                    : "Analysis Error"}
                </span>
                <span className="text-xs text-slate-400">
                  (Gap: ${gap.toFixed(0)})
                </span>
              </div>
              <p className="text-sm text-slate-200 mb-1">{insight.analysis}</p>
              <p className="text-xs text-blue-300">
                <span className="font-semibold">Strategy:</span> {insight.strategy}
              </p>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Analyzing deal...</div>
          )}
        </div>
      </div>
    </div>
  );
}
