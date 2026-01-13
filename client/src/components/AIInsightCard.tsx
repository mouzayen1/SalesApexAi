// client/src/components/AIInsightCard.tsx
import { useState, useEffect } from 'react';
import type { SmartDealAIRequest, SmartDealAIResponse } from '../../../shared/smartDealAI';

interface AIInsightCardProps {
  dealData: SmartDealAIRequest | null;
  onRetry?: () => void;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export function AIInsightCard({ dealData, onRetry }: AIInsightCardProps) {
  const [insight, setInsight] = useState<SmartDealAIResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealData) {
      setInsight(null);
      setLoadingState('idle');
      return;
    }

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

    fetchInsight();
  }, [dealData]);

  async function fetchInsight() {
    if (!dealData) return;

    setLoadingState('loading');
    setError(null);

    try {
      const response = await fetch('/api/smart-deal-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI insight');
      }

      const data: SmartDealAIResponse = await response.json();
      setInsight(data);
      setLoadingState('success');
    } catch (err) {
      console.error('AI Insight error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI insight');
      setLoadingState('error');
    }
  }

  // Don't render if no deal data
  if (!dealData) return null;

  // Determine styling based on scenario/gap
  const getCardStyle = () => {
    if (loadingState === 'loading') {
      return 'border-slate-500 bg-slate-800/50';
    }
    if (loadingState === 'error') {
      return 'border-red-500/50 bg-red-900/20';
    }
    if (!insight) {
      return 'border-slate-500 bg-slate-800/50';
    }

    // Gap-based styling
    if (insight.gap <= 50) {
      return 'border-emerald-500 bg-gradient-to-br from-emerald-900/30 to-emerald-800/20';
    } else if (insight.gap <= 100) {
      return 'border-amber-500 bg-gradient-to-br from-amber-900/30 to-amber-800/20';
    } else {
      return 'border-red-500 bg-gradient-to-br from-red-900/30 to-red-800/20';
    }
  };

  const getIconAndLabel = () => {
    if (loadingState === 'loading') {
      return { icon: '...', label: 'Analyzing', color: 'text-slate-400' };
    }
    if (loadingState === 'error') {
      return { icon: '!', label: 'Error', color: 'text-red-400' };
    }
    if (!insight) {
      return { icon: '?', label: 'Pending', color: 'text-slate-400' };
    }

    if (insight.gap <= 50) {
      return { icon: '...', label: 'Helpful Tip', color: 'text-emerald-400' };
    } else if (insight.gap <= 100) {
      return { icon: '!', label: 'Attention Needed', color: 'text-amber-400' };
    } else {
      return { icon: '!!', label: 'Reality Check', color: 'text-red-400' };
    }
  };

  const { label, color } = getIconAndLabel();

  return (
    <div className={`mb-6 rounded-lg border-2 p-4 transition-all duration-300 ${getCardStyle()}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
            insight?.gap && insight.gap <= 50 ? 'bg-emerald-500/20' :
            insight?.gap && insight.gap <= 100 ? 'bg-amber-500/20' :
            insight?.gap && insight.gap > 100 ? 'bg-red-500/20' : 'bg-slate-500/20'
          }`}>
            <svg className={`h-5 w-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className={`text-lg font-bold ${color}`}>Smart Deal AI</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          insight?.gap && insight.gap <= 50 ? 'bg-emerald-500/20 text-emerald-300' :
          insight?.gap && insight.gap <= 100 ? 'bg-amber-500/20 text-amber-300' :
          insight?.gap && insight.gap > 100 ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-300'
        }`}>
          {label}
        </span>
      </div>

      {/* Loading Skeleton */}
      {loadingState === 'loading' && (
        <div className="animate-pulse">
          <div className="mb-2 h-4 w-3/4 rounded bg-slate-700"></div>
          <div className="mb-3 h-4 w-1/2 rounded bg-slate-700"></div>
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded bg-slate-700"></div>
            <div className="h-6 w-24 rounded bg-slate-700"></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {loadingState === 'error' && (
        <div>
          <p className="mb-3 text-red-300">{error}</p>
          <button
            onClick={() => {
              onRetry?.();
              fetchInsight();
            }}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Success State */}
      {loadingState === 'success' && insight && (
        <div>
          {/* Gap Display */}
          <div className="mb-3 flex items-center gap-4">
            <div className={`text-2xl font-bold ${color}`}>
              ${insight.gap} Gap
            </div>
            <div className="text-sm text-slate-400">
              Target: ${dealData.targetPayment} | Floor: ${Math.round(dealData.floorPayment)}
            </div>
          </div>

          {/* AI Insight */}
          <p className="mb-4 text-white leading-relaxed">
            {insight.insight}
          </p>

          {/* Suggested Actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insight.suggestedActions.map((action, idx) => (
                <span
                  key={idx}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    insight.gap <= 50 ? 'bg-emerald-500/20 text-emerald-300' :
                    insight.gap <= 100 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-red-500/20 text-red-300'
                  }`}
                >
                  {action}
                </span>
              ))}
            </div>
          )}

          {/* Bank Rules Hit */}
          {dealData.bankRulesHit && dealData.bankRulesHit.length > 0 && (
            <div className="mt-4 border-t border-slate-700 pt-3">
              <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Bank Rules Applied</div>
              <div className="flex flex-wrap gap-1">
                {dealData.bankRulesHit.map((rule, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIInsightCard;
