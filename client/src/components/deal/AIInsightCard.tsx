// client/src/components/deal/AIInsightCard.tsx
// Groq AI-powered deal insight card
import { useState, useEffect, useMemo } from "react";

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

  // Props validation - early return if invalid
  if (!bestDeal || !targetPayment) {
    return null;
  }

  // Calculate gap
  const gap = bestDeal.payment ? bestDeal.payment - targetPayment : 0;

  // Build bank rules from deal context
  const bankRules = useMemo(() => {
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
  }, [bestDeal?.ltv, bestDeal?.hasVsc, bestDeal?.hasGap]);

  // Memoized request key for exact re-trigger
  const requestKey = useMemo(() =>
    JSON.stringify({ vehiclePrice, targetPayment, bestPayment: bestDeal?.payment, creditTier }),
    [vehiclePrice, targetPayment, bestDeal?.payment, creditTier]
  );

  useEffect(() => {
    // Only fetch if there's a positive gap
    if (gap <= 0 || !bestDeal?.payment || !vehiclePrice) {
      setInsight(null);
      return;
    }

    const fetchInsight = async () => {
      setLoading(true);
      console.log("[AIInsightCard] Fetching insight for:", { vehiclePrice, targetPayment, bestPayment: bestDeal.payment, creditTier, gap });

      try {
        const response = await fetch("/api/analyze-deal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehiclePrice,
            targetPayment,
            bestPayment: bestDeal.payment,
            creditTier,
            income: income || 5000,
            bankRules,
          }),
        });

        console.log("[AIInsightCard] Response status:", response.status);

        const data = await response.json();
        console.log("[AIInsightCard] Parsed data:", data);

        // Always set insight even on error - backend returns valid fallback
        setInsight(data);
      } catch (err) {
        console.error("[AIInsightCard] Fetch error:", err);
        // Network failure fallback - use gap-based logic
        setInsight({
          status: gap < 50 ? "good" : gap < 100 ? "difficult" : "impossible",
          analysis: gap < 50
            ? "Deal appears achievable."
            : gap < 100
              ? "Moderate gap - adjustments may help."
              : "Large gap - consider alternatives.",
          strategy: gap < 50
            ? "Focus on maximizing backend."
            : gap < 100
              ? "Suggest down payment or term extension."
              : "Explore different vehicle options.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInsight();
  }, [requestKey]);

  // Don't render if no gap or no best deal
  if (gap <= 0 || !bestDeal?.payment) {
    return null;
  }

  // Border and background colors - NO RED for errors, use neutral instead
  const getBorderColor = () => {
    if (!insight || insight.status === "error") return "border-slate-500";
    switch (insight.status) {
      case "good":
        return "border-green-500";
      case "difficult":
        return "border-yellow-500";
      case "impossible":
        return "border-orange-500"; // Orange instead of red for impossible
      default:
        return "border-slate-500";
    }
  };

  const getBackgroundClass = () => {
    if (!insight || insight.status === "error") return "bg-slate-800/50";
    switch (insight.status) {
      case "good":
        return "bg-gradient-to-r from-green-900/20 to-green-800/10";
      case "difficult":
        return "bg-gradient-to-r from-yellow-900/20 to-amber-800/10";
      case "impossible":
        return "bg-gradient-to-r from-orange-900/20 to-orange-800/10"; // Orange gradient
      default:
        return "bg-slate-800/50";
    }
  };

  const getStatusEmoji = () => {
    if (!insight || insight.status === "error") return "💡";
    switch (insight.status) {
      case "good":
        return "✅";
      case "difficult":
        return "⚠️";
      case "impossible":
        return "🔄"; // Suggest pivot, not stop
      default:
        return "💡";
    }
  };

  const getStatusLabel = () => {
    if (!insight || insight.status === "error") return "Analyzing...";
    switch (insight.status) {
      case "good":
        return "Realistic Deal";
      case "difficult":
        return "Challenging";
      case "impossible":
        return "Needs Adjustment";
      default:
        return "Analyzing...";
    }
  };

  const getStatusTextColor = () => {
    if (!insight || insight.status === "error") return "text-slate-300";
    switch (insight.status) {
      case "good":
        return "text-green-300";
      case "difficult":
        return "text-yellow-300";
      case "impossible":
        return "text-orange-300";
      default:
        return "text-slate-300";
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
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          ) : insight ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getStatusEmoji()}</span>
                <span className={`text-sm font-semibold ${getStatusTextColor()}`}>
                  {getStatusLabel()}
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
