// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { runRehash, assessRisk, RehashResult } from '../../../shared/rehash';
import type { DealInput, DealCandidate, RiskAssessment } from '../../../shared/deals';
import type { Car } from '@shared/schema';
import AIInsightCard from '../components/deal/AIInsightCard';
import ConfidenceBadge from '../components/deal/ConfidenceBadge';
import { useBankFirstTriage } from '../hooks/useBankFirstTriage';

// Product badge component
function ProductBadge({ hasGap, hasVsc }: { hasGap: boolean; hasVsc: boolean }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {hasGap && (
        <span className="inline-flex items-center rounded-full bg-emerald-600/80 px-2 py-0.5 text-xs font-semibold text-white">
          +GAP
        </span>
      )}
      {hasVsc && (
        <span className="inline-flex items-center rounded-full bg-purple-600/80 px-2 py-0.5 text-xs font-semibold text-white">
          +VSC
        </span>
      )}
      {!hasGap && !hasVsc && (
        <span className="inline-flex items-center rounded-full bg-slate-600/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
          No Products
        </span>
      )}
    </div>
  );
}

// Risk assessment badge component
function RiskBadge({ riskAssessment }: { riskAssessment: RiskAssessment | undefined }) {
  if (!riskAssessment) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {riskAssessment.isUpsideDown && (
        <span className="inline-flex items-center rounded-full bg-amber-600/80 px-2 py-0.5 text-xs font-semibold text-white">
          ⚠️ Upside Down ({riskAssessment.ltvPercent.toFixed(0)}% LTV)
        </span>
      )}
      {riskAssessment.isOutOfWarranty && (
        <span className="inline-flex items-center rounded-full bg-orange-600/80 px-2 py-0.5 text-xs font-semibold text-white">
          🔧 Out of Warranty
        </span>
      )}
    </div>
  );
}

export default function RehashOptimizer() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dealInput, setDealInput] = useState<DealInput>({
    vehicleId: '',
    vehicleYear: 0,
    vehicleMake: '',
    vehicleMileage: 0,
    vehiclePrice: 0,
    vehicleCost: 0,
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: true, vsc: true, otherProductsTotal: 0 },
    customerCreditTier: 'subprime',
    targetPayment: 450,
    paymentTolerance: 50,
    monthlyIncome: undefined,
  });

  const [vehicleInfo, setVehicleInfo] = useState<{ year: number; make: string; model: string } | null>(null);
  const [results, setResults] = useState<RehashResult | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Bank-First 3-Phase Triage
  const triageData = useBankFirstTriage({
    allCandidates: results?.allCandidates || [],
    targetPayment: dealInput.targetPayment,
    vehicleMileage: dealInput.vehicleMileage,
    creditTier: dealInput.customerCreditTier,
    riskAssessment: results?.riskAssessment || null,
    enabled: !!results && results.allCandidates.length > 0,
  });

  const handleFindLenders = useCallback(() => {
    if (dealInput.vehiclePrice > 0) {
      const rehashResults = runRehash(dealInput);
      setResults(rehashResults);
    }
  }, [dealInput]);

  // Read vehicle data from navigation state on mount
  useEffect(() => {
    const vehicle = (location.state as { vehicle?: Car })?.vehicle;
    if (vehicle && !hasInitialized) {
      const vehicleCost = Math.round(vehicle.price * 0.9); // Estimate dealer cost as 90% of price
      setDealInput(prev => ({
        ...prev,
        vehicleId: String(vehicle.id),
        vehiclePrice: vehicle.price,
        vehicleCost: vehicleCost,
        vehicleYear: vehicle.year,
        vehicleMake: vehicle.make || '',
        vehicleMileage: vehicle.mileage || 0,
      }));
      setVehicleInfo({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
      });
      setHasInitialized(true);
    }
  }, [location.state, hasInitialized]);

  // Auto-run rehash once vehicle data is loaded
  useEffect(() => {
    if (hasInitialized && dealInput.vehiclePrice > 0) {
      handleFindLenders();
    }
  }, [hasInitialized, dealInput.vehiclePrice, handleFindLenders]);

  const handleInputChange = (field: keyof DealInput, value: any) => {
    setDealInput(prev => ({ ...prev, [field]: value }));
  };

  // Show a message if no vehicle was passed
  if (!location.state?.vehicle && !hasInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Rehash Optimizer</h1>
            <button
              onClick={() => navigate('/')}
              className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
            >
              ← Back to Home
            </button>
          </div>
          <div className="rounded-lg bg-slate-800 p-8 text-center shadow-xl">
            <p className="text-lg text-slate-300">No vehicle selected.</p>
            <p className="mt-2 text-slate-400">Please select a vehicle from the inventory to optimize the deal.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 rounded bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Browse Inventory
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Vehicle Info Banner */}
        {vehicleInfo && (
          <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-300">Optimizing Deal For</p>
                <h2 className="text-2xl font-bold text-white">
                  {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
                </h2>
                {results?.riskAssessment && (
                  <div className="mt-2">
                    <RiskBadge riskAssessment={results.riskAssessment} />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-300">Vehicle Price</p>
                <p className="text-xl font-bold text-white">${dealInput.vehiclePrice.toLocaleString()}</p>
                {results?.riskAssessment && (
                  <div className="mt-1 text-xs text-slate-400">
                    {results.riskAssessment.vehicleAgeYears} years old • {results.riskAssessment.vehicleMileage.toLocaleString()} mi
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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

              <div>
                <label className="mb-1 block text-sm text-slate-300">Monthly Gross Income</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    value={dealInput.monthlyIncome || ''}
                    onChange={e => handleInputChange('monthlyIncome', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Optional - for PTI check"
                    className="w-full rounded bg-slate-700 pl-7 pr-3 py-2 text-white placeholder-slate-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">Used to calculate Payment-to-Income ratio</p>
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

              {/* Phase 1: Compliance Filter Status */}
              {triageData.rejectedCount > 0 && (
                <div className="mb-4 rounded-lg bg-slate-700/50 border border-slate-600 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">
                      <span className="font-semibold text-blue-300">Bank-First Filter:</span>{' '}
                      {triageData.validDeals.length} compliant deals
                    </span>
                    <span className="text-slate-400">
                      ({triageData.rejectedCount} filtered for compliance)
                    </span>
                  </div>
                  {triageData.bankRules && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="text-slate-400">Rules:</span>
                      <span className="text-slate-300">LTV Cap {triageData.bankRules.ltvCap}%</span>
                      {triageData.bankRules.mandatoryVsc && (
                        <span className="text-purple-300">• VSC Required</span>
                      )}
                      {triageData.bankRules.mandatoryGap && (
                        <span className="text-emerald-300">• GAP Required</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {results && results.bestDeal && (
                <>
                  {/* AI Insight Card */}
                  <AIInsightCard
                    vehiclePrice={dealInput.vehiclePrice}
                    targetPayment={dealInput.targetPayment}
                    bestDeal={results.bestDeal}
                    creditTier={dealInput.customerCreditTier}
                    income={dealInput.monthlyIncome || 0}
                  />

                  {/* Best Deal Card */}
                  <div className="mb-6 rounded-lg border-2 border-green-500 bg-gradient-to-br from-green-900/30 to-green-800/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-green-300">Best Deal</h3>
                        <ProductBadge hasGap={results.bestDeal.hasGap} hasVsc={results.bestDeal.hasVsc} />
                      </div>
                      <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                        HIGHEST NET CHECK
                      </span>
                    </div>

                    {/* Smart Note */}
                    {results.bestDeal.smartNote && (
                      <div className="mb-4 rounded-md bg-slate-700/50 px-3 py-2 border-l-4 border-blue-400">
                        <p className="text-sm text-blue-200">
                          <span className="font-semibold">💡 Smart Decision:</span> {results.bestDeal.smartNote}
                        </p>
                      </div>
                    )}

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

                    {/* Backend Products Breakdown */}
                    <div className="mt-4 pt-3 border-t border-green-600/30">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Backend Products Total</span>
                        <span className="font-semibold text-white">${results.bestDeal.backendTotal.toFixed(0)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-slate-400">LTV</span>
                        <span className={`font-semibold ${results.bestDeal.ltv > 100 ? 'text-amber-400' : 'text-white'}`}>
                          {results.bestDeal.ltv.toFixed(0)}%
                        </span>
                      </div>
                      {results.bestDeal.advanceMultiplier !== 1.0 && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-slate-400">Advance Adjustment</span>
                          <span className={`font-semibold ${results.bestDeal.advanceMultiplier < 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {results.bestDeal.advanceMultiplier < 1 ? '-' : '+'}
                            {Math.abs((1 - results.bestDeal.advanceMultiplier) * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                      {/* PTI Display */}
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-slate-400">PTI (Payment-to-Income)</span>
                        {results.bestDeal.ptiPercent !== null ? (
                          <span className={`font-semibold ${results.bestDeal.ptiExceedsLimit ? 'text-red-400' : 'text-emerald-400'}`}>
                            {results.bestDeal.ptiPercent.toFixed(1)}%
                            {results.bestDeal.ptiExceedsLimit && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            Requires ${results.bestDeal.requiredIncome?.toLocaleString()}+ income
                          </span>
                        )}
                      </div>
                    </div>

                    {/* PTI Warning */}
                    {results.bestDeal.ptiWarning && (
                      <div className="mt-3 pt-3 border-t border-red-600/30">
                        <div className="rounded-md bg-red-900/30 border border-red-500/50 px-3 py-2">
                          <p className="text-sm text-red-200">
                            <span className="font-semibold">⚠️ Income Warning:</span> {results.bestDeal.ptiWarning}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bank-First Triage Confidence Badge */}
                    {triageData.triageResult && (
                      <ConfidenceBadge
                        mode={triageData.triageResult.mode}
                        badge={triageData.triageResult.badge}
                        reason={triageData.triageResult.reason}
                      />
                    )}

                    {/* Vehicle Warnings */}
                    {results.bestDeal.vehicleWarnings && results.bestDeal.vehicleWarnings.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-600/30">
                        <div className="flex flex-wrap gap-2">
                          {results.bestDeal.vehicleWarnings.map((warning, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-amber-600/30 border border-amber-500/50 px-2 py-1 text-xs text-amber-200"
                            >
                              ⚠️ {warning}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                          <th className="px-3 py-2 text-center">Products</th>
                          <th className="px-3 py-2 text-center">Term</th>
                          <th className="px-3 py-2 text-right">Payment</th>
                          <th className="px-3 py-2 text-right font-bold text-green-300">Net Check</th>
                          <th className="px-3 py-2 text-right text-blue-300">Profit</th>
                          <th className="px-3 py-2 text-center">LTV</th>
                          <th className="px-3 py-2 text-center">PTI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.allCandidates.map((candidate, index) => (
                          <tr
                            key={index}
                            className={`border-t border-slate-700 ${
                              index === 0 ? 'bg-green-900/20' : index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-850'
                            }`}
                            title={candidate.smartNote}
                          >
                            <td className="px-3 py-2 text-white">
                              <div className="flex flex-col">
                                <span>
                                  {candidate.lenderName}
                                  {index === 0 && (
                                    <span className="ml-2 rounded bg-green-600 px-2 py-0.5 text-xs font-bold">
                                      BEST
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <ProductBadge hasGap={candidate.hasGap} hasVsc={candidate.hasVsc} />
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
                            <td className={`px-3 py-2 text-center ${
                              candidate.ltv > 100 ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                              {candidate.ltv.toFixed(0)}%
                            </td>
                            <td className={`px-3 py-2 text-center ${
                              candidate.ptiExceedsLimit ? 'text-red-400' : candidate.ptiPercent !== null ? 'text-emerald-400' : 'text-slate-500'
                            }`}>
                              {candidate.ptiPercent !== null ? (
                                <>
                                  {candidate.ptiPercent.toFixed(0)}%
                                  {candidate.ptiExceedsLimit && ' ⚠️'}
                                </>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
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
