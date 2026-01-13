// client/src/components/AIInsightCard.tsx
import { useState, useEffect, useRef } from 'react';
import type { SmartDealAIRequest, SmartDealAIResponse } from '../../../shared/smartDealAI';

interface AIInsightCardProps {
  dealData: SmartDealAIRequest | null;
  onRetry?: () => void;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Create a stable cache key from deal data for dependency tracking
function createCacheKey(data: SmartDealAIRequest | null): string {
  if (!data) return '';
  return `${data.vehiclePrice}-${data.targetPayment}-${data.creditTier}-${data.downPayment}-${data.floorPayment}-${data.bestProfitPayment}`;
}

export function AIInsightCard({ dealData, onRetry }: AIInsightCardProps) {
  const [insight, setInsight] = useState<SmartDealAIResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create cache key from specific values to detect actual changes
  const cacheKey = createCacheKey(dealData);

  useEffect(() => {
    // Cancel any pending request when inputs change
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state immediately when deal data changes
    setInsight(null);
    setError(null);

    if (!dealData) {
      setLoadingState('idle');
      return;
    }

    // Debug logging
    console.log('Smart Deal AI - Analyzing deal:', {
      vehiclePrice: dealData.vehiclePrice,
      targetPayment: dealData.targetPayment,
      creditTier: dealData.creditTier,
      bestProfitPayment: dealData.bestProfitPayment,
      floorPayment: dealData.floorPayment,
    });

    // Only trigger AI analysis if gap > $50 (dual-calculation strategy)
    const gap = dealData.bestProfitPayment - dealData.targetPayment;
    if (gap <= 50) {
      setInsight({
        insight: `Great news! Best payment is only $${Math.round(gap)} above target. Deal is structured well.`,
        scenario: 'realistic',
        gap: Math.round(gap),
        suggestedActions: ['Proceed with current structure', 'Minor adjustments optional'],
      });
      setLoadingState('success');
      return;
    }

    // Fetch AI insight
    fetchInsight(dealData);

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey]); // Use cache key instead of object reference

  async function fetchInsight(data: SmartDealAIRequest) {
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setLoadingState('loading');
    setError(null);

    console.log('Smart Deal AI - Sending to API:', JSON.stringify(data, null, 2));

    try {
      const response = await fetch('/api/smart-deal-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      // Get the raw text first to handle potential non-JSON responses
      const rawText = await response.text();
      console.log('Smart Deal AI - Raw response:', rawText.substring(0, 500));

      if (!response.ok) {
        // Try to parse error as JSON, fallback to raw text
        let errorMessage = 'Failed to get AI insight';
        try {
          const errorData = JSON.parse(rawText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If not JSON, use status text or raw text
          errorMessage = response.statusText || rawText.substring(0, 100) || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Try to parse as JSON with error handling
      let result: SmartDealAIResponse;
      try {
        result = JSON.parse(rawText);
      } catch (parseError) {
        console.error('Smart Deal AI - JSON Parse Error:', parseError);
        console.error('Smart Deal AI - Raw response was:', rawText);
        throw new Error('Invalid response format from AI service');
      }

      // Validate the response structure
      if (!result || typeof result.insight !== 'string') {
        console.error('Smart Deal AI - Invalid response structure:', result);
        throw new Error('AI response missing required fields');
      }

      setInsight(result);
      setLoadingState('success');
    } catch (err) {
      // Ignore abort errors (they're expected when canceling)
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Smart Deal AI - Request aborted (new request started)');
        return;
      }

      console.error('Smart Deal AI - Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI insight');
      setLoadingState('error');
    }
  }

  // Don't render if no deal data
  if (!dealData) return null;

  // Get border accent color based on gap
  const getBorderColor = () => {
    if (loadingState === 'loading' || loadingState === 'error' || !insight) {
      return 'border-l-slate-500';
    }
    if (insight.gap <= 50) return 'border-l-emerald-500';
    if (insight.gap <= 100) return 'border-l-amber-500';
    return 'border-l-red-500';
  };

  const getTextColor = () => {
    if (loadingState === 'loading' || loadingState === 'error' || !insight) {
      return 'text-slate-400';
    }
    if (insight.gap <= 50) return 'text-emerald-400';
    if (insight.gap <= 100) return 'text-amber-400';
    return 'text-red-400';
  };

  const getLabel = () => {
    if (loadingState === 'loading') return 'Analyzing...';
    if (loadingState === 'error') return 'Error';
    if (!insight) return 'Pending';
    if (insight.gap <= 50) return 'Good';
    if (insight.gap <= 100) return 'Attention';
    return 'Reality Check';
  };

  const color = getTextColor();

  return (
    <div className={`mb-4 rounded-lg border-l-4 bg-slate-700/50 p-3 ${getBorderColor()}`}>
      {/* Compact Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className={`h-4 w-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className={`text-sm font-semibold ${color}`}>AI Insight</span>
        </div>
        <div className="flex items-center gap-2">
          {insight && (
            <span className={`text-sm font-bold ${color}`}>
              ${insight.gap} gap
            </span>
          )}
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
            insight?.gap && insight.gap <= 50 ? 'bg-emerald-500/20 text-emerald-300' :
            insight?.gap && insight.gap <= 100 ? 'bg-amber-500/20 text-amber-300' :
            insight?.gap && insight.gap > 100 ? 'bg-red-500/20 text-red-300' : 'bg-slate-600 text-slate-300'
          }`}>
            {getLabel()}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loadingState === 'loading' && (
        <div className="animate-pulse">
          <div className="h-4 w-3/4 rounded bg-slate-600"></div>
        </div>
      )}

      {/* Error State */}
      {loadingState === 'error' && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => {
              onRetry?.();
              if (dealData) {
                fetchInsight(dealData);
              }
            }}
            className="rounded bg-red-600/50 px-2 py-1 text-xs text-white hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      )}

      {/* Success State - Compact */}
      {loadingState === 'success' && insight && (
        <div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {insight.insight}
          </p>
          {/* Compact suggested actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {insight.suggestedActions.slice(0, 2).map((action, idx) => (
                <span
                  key={idx}
                  className={`rounded px-2 py-0.5 text-xs ${
                    insight.gap <= 50 ? 'bg-emerald-500/10 text-emerald-300' :
                    insight.gap <= 100 ? 'bg-amber-500/10 text-amber-300' :
                    'bg-red-500/10 text-red-300'
                  }`}
                >
                  {action}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIInsightCard;
