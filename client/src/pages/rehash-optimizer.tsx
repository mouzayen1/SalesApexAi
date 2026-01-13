// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { runRehash, calculateFloorPayment } from '../../../shared/rehash';
import type { DealInput, DealCandidate } from '../../../shared/deals';
import type { SmartDealAIRequest } from '../../../shared/smartDealAI';
import AIInsightCard from '../components/AIInsightCard';

interface VehicleInfo {
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage: number;
}

export default function RehashOptimizer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Parse vehicle info from URL params
  const vehicleInfo = useMemo<VehicleInfo>(() => ({
    id: searchParams.get('vehicleId') || 'demo-1',
    year: parseInt(searchParams.get('vehicleYear') || '2020', 10),
    make: searchParams.get('vehicleMake') || 'Demo',
    model: searchParams.get('vehicleModel') || 'Vehicle',
    price: parseInt(searchParams.get('vehiclePrice') || '21995', 10),
    mileage: parseInt(searchParams.get('vehicleMileage') || '50000', 10),
  }), [searchParams]);

  // Create a URL key for detecting changes
  const urlKey = searchParams.toString();

  const [dealInput, setDealInput] = useState<DealInput>(() => ({
    vehicleId: vehicleInfo.id,
    vehicleYear: vehicleInfo.year,
    vehicleMileage: vehicleInfo.mileage,
    vehiclePrice: vehicleInfo.price,
    vehicleCost: Math.round(vehicleInfo.price * 0.85), // Estimate cost at 85%
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
    customerCreditTier: 'subprime',
    targetPayment: 450,
    paymentTolerance: 50,
  }));

  const [results, setResults] = useState<{ bestDeal: DealCandidate | null; allCandidates: DealCandidate[] } | null>(null);
  const [aiInsightData, setAiInsightData] = useState<SmartDealAIRequest | null>(null);

  // Sync dealInput when URL params change
  useEffect(() => {
    console.log('URL changed, updating deal input:', vehicleInfo);
    setDealInput(prev => ({
      ...prev,
      vehicleId: vehicleInfo.id,
      vehicleYear: vehicleInfo.year,
      vehicleMileage: vehicleInfo.mileage,
      vehiclePrice: vehicleInfo.price,
      vehicleCost: Math.round(vehicleInfo.price * 0.85),
    }));
    // Clear results to show fresh state
    setResults(null);
    setAiInsightData(null);
  }, [urlKey, vehicleInfo]);

  // Auto-calculate when dealInput changes
  useEffect(() => {
    handleFindLenders();
  }, [dealInput.vehiclePrice, dealInput.customerCreditTier, dealInput.downPayment, dealInput.targetPayment]);

  const handleFindLenders = () => {
    console.log('Calculating lenders for:', dealInput);
    const rehashResults = runRehash(dealInput);
    setResults(rehashResults);

    // Calculate floor payment for AI analysis
    const floorResult = calculateFloorPayment(dealInput);

    // Prepare AI insight data if we have valid results
    if (rehashResults.bestDeal && floorResult) {
      const bestProfitPayment = rehashResults.bestDeal.payment;

      const aiRequest: SmartDealAIRequest = {
        targetPayment: dealInput.targetPayment,
        bestProfitPayment,
        floorPayment: floorResult.payment,
        bankRulesHit: floorResult.bankRulesHit,
        creditTier: dealInput.customerCreditTier,
        amountFinanced: floorResult.amountFinanced,
        ltv: floorResult.ltv,
        termMonths: floorResult.termMonths,
        downPayment: dealInput.downPayment,
        vehiclePrice: dealInput.vehiclePrice,
      };

      setAiInsightData(aiRequest);
    } else {
      setAiInsightData(null);
    }
  };

  const handleInputChange = (field: keyof DealInput, value: any) => {
    setDealInput(prev => ({ ...prev, [field]: value }));
  };

  // Calculate if trade is "upside down"
  const tradeEquity = dealInput.tradeAllowance - dealInput.tradePayoff;
  const isUpsideDown = tradeEquity < 0;

  // Determine if AI card should be shown (hide when gap < $10)
  const paymentGap = results?.bestDeal
    ? results.bestDeal.payment - dealInput.targetPayment
    : 0;
  const shouldShowAI = aiInsightData && paymentGap >= 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Navigation */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-sm text-blue-300 hover:text-blue-200"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Inventory
          </button>
        </div>

        {/* Vehicle Header - Blue Banner */}
        <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
              </h1>
              <p className="text-blue-200">Stock #{vehicleInfo.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Price Badge */}
              <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur">
                <div className="text-xs text-blue-100">Price</div>
                <div className="text-xl font-bold text-white">
                  ${vehicleInfo.price.toLocaleString()}
                </div>
              </div>
              {/* Mileage Badge */}
              <div className="rounded-lg bg-white/20 px-4 py-2 backdrop-blur">
                <div className="text-xs text-blue-100">Mileage</div>
                <div className="text-xl font-bold text-white">
                  {vehicleInfo.mileage.toLocaleString()} mi
                </div>
              </div>
              {/* Upside Down Warning */}
              {isUpsideDown && (
                <div className="rounded-lg bg-red-500/80 px-4 py-2">
                  <div className="text-xs text-red-100">Trade</div>
                  <div className="text-lg font-bold text-white">
                    ${Math.abs(tradeEquity).toLocaleString()} Upside Down
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Panel - Deal Information */}
          <div className="rounded-lg bg-slate-800 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-white">Deal Information</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Vehicle Price</label>
                <input
                  type="number"
                  value={dealInput.vehiclePrice}
                  onChange={e => handleInputChange('vehiclePrice', Number(e.target.value))}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Down Payment</label>
                <input
                  type="number"
                  value={dealInput.downPayment}
                  onChange={e => handleInputChange('downPayment', Number(e.target.value))}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Trade Value</label>
                <input
                  type="number"
                  value={dealInput.tradeAllowance}
                  onChange={e => handleInputChange('tradeAllowance', Number(e.target.value))}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Trade Owed</label>
                <input
                  type="number"
                  value={dealInput.tradePayoff}
                  onChange={e => handleInputChange('tradePayoff', Number(e.target.value))}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Credit Tier</label>
                <select
                  value={dealInput.customerCreditTier}
                  onChange={e => handleInputChange('customerCreditTier', e.target.value)}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                >
                  <option value="prime">Prime</option>
                  <option value="near_prime">Near Prime</option>
                  <option value="subprime">Subprime</option>
                  <option value="deep_subprime">Deep Subprime</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Target Payment</label>
                <input
                  type="number"
                  value={dealInput.targetPayment}
                  onChange={e => handleInputChange('targetPayment', Number(e.target.value))}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                />
              </div>

              <button
                onClick={handleFindLenders}
                className="w-full rounded bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Recalculate
              </button>
            </div>
          </div>

          {/* Right Panel - Lender Results */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-slate-800 p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-white">Lender Results</h2>

              {!results && (
                <div className="text-center text-slate-400">
                  Calculating best lender options...
                </div>
              )}

              {results && results.allCandidates.length === 0 && (
                <div className="rounded bg-red-900/30 p-4 text-center text-red-300">
                  No valid lender structures found. Try adjusting down payment or credit tier.
                </div>
              )}

              {results && results.bestDeal && (
                <>
                  {/* Smart Deal AI Insight Card - Compact version inside results */}
                  {shouldShowAI && (
                    <AIInsightCard
                      dealData={aiInsightData}
                      onRetry={handleFindLenders}
                    />
                  )}

                  {/* Best Deal Card */}
                  <div className="mb-6 rounded-lg border-2 border-green-500 bg-gradient-to-br from-green-900/30 to-green-800/20 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-green-300">Best Deal</h3>
                      <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                        HIGHEST NET CHECK
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400">Lender</div>
                        <div className="text-lg font-bold text-white">{results.bestDeal.lenderName}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Term</div>
                        <div className="text-lg font-bold text-white">{results.bestDeal.termMonths} months</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Monthly Payment</div>
                        <div className="text-xl font-bold text-blue-300">${results.bestDeal.payment.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">APR</div>
                        <div className="text-lg font-bold text-white">{results.bestDeal.apr.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-green-400">Net Check to Dealer</div>
                        <div className="text-2xl font-bold text-green-400">
                          ${results.bestDeal.netCheckToDealer.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-400">Dealer Profit</div>
                        <div className="text-2xl font-bold text-blue-400">
                          ${results.bestDeal.dealerProfit.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* All Options Table */}
                  <div className="overflow-x-auto">
                    <h3 className="mb-3 text-lg font-semibold text-white">
                      All Options (Sorted by Net Check)
                    </h3>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-700 text-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Lender</th>
                          <th className="px-3 py-2 text-center">Term</th>
                          <th className="px-3 py-2 text-right">Payment</th>
                          <th className="px-3 py-2 text-right font-bold text-green-300">Net Check</th>
                          <th className="px-3 py-2 text-right text-blue-300">Profit</th>
                          <th className="px-3 py-2 text-right">Amt Financed</th>
                          <th className="px-3 py-2 text-center">LTV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.allCandidates.map((candidate, index) => (
                          <tr
                            key={index}
                            className={`border-t border-slate-700 ${
                              index === 0 ? 'bg-green-900/20' : index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-850'
                            }`}
                          >
                            <td className="px-3 py-2 text-white">
                              {candidate.lenderName}
                              {index === 0 && (
                                <span className="ml-2 rounded bg-green-600 px-2 py-0.5 text-xs font-bold">
                                  BEST
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-300">{candidate.termMonths} mo</td>
                            <td className="px-3 py-2 text-right font-semibold text-white">
                              ${candidate.payment.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right text-lg font-bold text-green-400">
                              ${candidate.netCheckToDealer.toFixed(0)}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${
                              candidate.dealerProfit > 0 ? 'text-blue-400' : 'text-red-400'
                            }`}>
                              ${candidate.dealerProfit.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-300">
                              ${candidate.amountFinanced.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-400">
                              {candidate.ltv.toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
