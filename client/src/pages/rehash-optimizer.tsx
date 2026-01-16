// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { runRehash } from '../../../shared/rehash';
import type { DealInput, DealCandidate } from '../../../shared/deals';

export default function RehashOptimizer() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { dealInput?: any } };
    const [dealInput, setDealInput] = useState<DealInput>(() => {
    return location.state?.dealInput ?? {
    vehicleId: 'demo-1',
    vehicleYear: 2020,
    vehicleMileage: 50000,
    vehiclePrice: 21995,
    vehicleCost: 18500,
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
    customerCreditTier: 'subprime',
    targetPayment: 450,
    paymentTolerance: 50,
    };
  });

  const [results, setResults] = useState<{ bestDeal: DealCandidate | null; allCandidates: DealCandidate[] } | null>(null);

  const handleFindLenders = () => {
    const rehashResults = runRehash(dealInput);
    setResults(rehashResults);
  };

  // Hydrate from location state when it changes
  useEffect(() => {
    if (location.state?.dealInput) {
      setDealInput(location.state.dealInput);
    }
  }, [location.state?.dealInput]);

  // Recompute whenever dealInput changes
  useEffect(() => {
    handleFindLenders();
  }, [dealInput]);
  const handleInputChange = (field: keyof DealInput, value: any) => {
    setDealInput(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Rehash Optimizer</h1>
          <button
            onClick={() => navigate('/')}
            className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
          >
            ← Back to Home
          </button>
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
                Find Lenders
              </button>
            </div>
          </div>

          {/* Right Panel - Lender Results */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-slate-800 p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-white">Lender Results</h2>

              {!results && (
                <div className="text-center text-slate-400">
                  Click "Find Lenders" to see results
                </div>
              )}

              {results && results.allCandidates.length === 0 && (
                <div className="rounded bg-red-900/30 p-4 text-center text-red-300">
                  No valid lender structures found. Try adjusting down payment or credit tier.
                </div>
              )}

              {results && results.bestDeal && (
                <>
                  {/* Best Deal Card */}
                  <div className="mb-6 rounded-lg border-2 border-green-500 bg-gradient-to-br from-green-900/30 to-green-800/20 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-green-300">🏆 Best Deal</h3>
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
