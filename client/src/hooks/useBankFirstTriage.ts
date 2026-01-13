// client/src/hooks/useBankFirstTriage.ts
// Hook for Bank-First 3-Phase Triage Logic

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DealCandidate, RiskAssessment } from '../../../shared/deals';
import {
  filterCompliantDeals,
  determineBankRules,
  type TriageResponse,
  type BankRules,
} from '../../../shared/bankFirstTriage';

interface UseBankFirstTriageProps {
  allCandidates: DealCandidate[];
  targetPayment: number;
  vehicleMileage: number;
  creditTier: string;
  riskAssessment: RiskAssessment | null;
  enabled?: boolean;
}

interface BankFirstTriageResult {
  // Phase 1 results
  validDeals: DealCandidate[];
  rejectedCount: number;
  bankRules: BankRules | null;

  // Phase 2 results
  triageResult: TriageResponse | null;
  bestDeal: DealCandidate | null;

  // Status
  loading: boolean;
  error: string | null;
}

export function useBankFirstTriage({
  allCandidates,
  targetPayment,
  vehicleMileage,
  creditTier,
  riskAssessment,
  enabled = true,
}: UseBankFirstTriageProps): BankFirstTriageResult {
  const [triageResult, setTriageResult] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: Determine bank rules based on deal characteristics
  const bankRules = useMemo(() => {
    if (!riskAssessment) return null;
    return determineBankRules(
      vehicleMileage,
      riskAssessment.ltvPercent,
      creditTier
    );
  }, [vehicleMileage, riskAssessment?.ltvPercent, creditTier]);

  // Phase 1: Filter compliant deals
  const { validDeals, rejectedCount } = useMemo(() => {
    if (!bankRules || allCandidates.length === 0) {
      return { validDeals: allCandidates, rejectedCount: 0 };
    }

    const result = filterCompliantDeals(allCandidates, bankRules);
    return {
      validDeals: result.validDeals,
      rejectedCount: result.rejectedDeals.length,
    };
  }, [allCandidates, bankRules]);

  // Build mandatory products list
  const mandatoryProducts = useMemo(() => {
    const products: string[] = [];
    if (bankRules?.mandatoryVsc) products.push('VSC');
    if (bankRules?.mandatoryGap) products.push('GAP');
    return products;
  }, [bankRules]);

  // Request key for memoization
  const requestKey = useMemo(() => {
    if (validDeals.length === 0) return '';
    return JSON.stringify({
      dealIds: validDeals.slice(0, 10).map(d => `${d.lenderId}-${d.termMonths}-${d.payment.toFixed(0)}`),
      targetPayment,
      mandatoryProducts,
    });
  }, [validDeals, targetPayment, mandatoryProducts]);

  // Phase 2: Call Groq triage API
  useEffect(() => {
    if (!enabled || validDeals.length === 0 || !targetPayment || !requestKey) {
      setTriageResult(null);
      return;
    }

    const fetchTriage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Prepare deals for API (with unique IDs)
        const dealsForApi = validDeals.slice(0, 10).map((d, idx) => ({
          id: `deal-${idx}-${d.lenderId}-${d.termMonths}`,
          payment: d.payment,
          netCheckToDealer: d.netCheckToDealer,
          hasGap: d.hasGap || false,
          hasVsc: d.hasVsc || false,
          ltv: d.ltv,
          termMonths: d.termMonths,
          lenderName: d.lenderName,
        }));

        console.log('[BankFirstTriage] Calling triage API with', dealsForApi.length, 'deals');

        const response = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            validDeals: dealsForApi,
            targetPayment,
            mandatoryProducts,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as TriageResponse;
        console.log('[BankFirstTriage] Triage result:', data);
        setTriageResult(data);
      } catch (err) {
        console.error('[BankFirstTriage] API error:', err);
        setError('Triage failed');

        // Fallback: deterministic selection
        const closeThreshold = targetPayment * 1.1;
        const closeDeals = validDeals.filter(d => d.payment <= closeThreshold);

        if (closeDeals.length > 0) {
          const sorted = [...closeDeals].sort((a, b) => b.netCheckToDealer - a.netCheckToDealer);
          setTriageResult({
            mode: 'profit',
            bestDealId: `deal-0-${sorted[0].lenderId}-${sorted[0].termMonths}`,
            reason: `Payment $${sorted[0].payment.toFixed(0)} within target, maximizing profit`,
            badge: '💰 Max Profit',
          });
        } else {
          const sorted = [...validDeals].sort((a, b) => a.payment - b.payment);
          setTriageResult({
            mode: 'survival',
            bestDealId: `deal-0-${sorted[0].lenderId}-${sorted[0].termMonths}`,
            reason: `Lowest payment $${sorted[0].payment.toFixed(0)} available`,
            badge: '⚠️ Lowest Possible',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTriage();
  }, [requestKey, enabled]);

  // Find the best deal from triage result
  const bestDeal = useMemo(() => {
    if (!triageResult?.bestDealId || validDeals.length === 0) {
      // Fallback to first valid deal
      return validDeals[0] || null;
    }

    // Parse deal ID to find matching deal
    const idParts = triageResult.bestDealId.split('-');
    if (idParts.length >= 4) {
      const idx = parseInt(idParts[1], 10);
      if (!isNaN(idx) && idx < validDeals.length) {
        return validDeals[idx];
      }
    }

    // Fallback to first valid deal if ID parsing fails
    return validDeals[0] || null;
  }, [triageResult, validDeals]);

  return {
    validDeals,
    rejectedCount,
    bankRules,
    triageResult,
    bestDeal,
    loading,
    error,
  };
}
