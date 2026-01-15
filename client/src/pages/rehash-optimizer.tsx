// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { runRehash } from '../../../shared/rehash';
import { fetchCarById } from '../lib/api';
import type { DealInput, DealCandidate } from '../../../shared/deals';
import type { Car } from '@shared/schema';

export default function RehashOptimizer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get('vehicleId');

  // Vehicle state
  const [selectedVehicle, setSelectedVehicle] = useState<Car | null>(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const initializedFromVehicle = useRef(false);

  // Deal input state - start with placeholder values, will be overwritten once vehicle loads
  const [dealInput, setDealInput] = useState<DealInput>({
    vehicleId: '',
    vehicleYear: 0,
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
  });

  const [results, setResults] = useState<{ bestDeal: DealCandidate | null; allCandidates: DealCandidate[] } | null>(null);

  // Fetch vehicle by ID from URL
  useEffect(() => {
    async function loadVehicle() {
      if (!vehicleId) {
        setVehicleError('No vehicle ID provided. Please select a vehicle from inventory.');
        setIsLoadingVehicle(false);
        return;
      }

      setIsLoadingVehicle(true);
      setVehicleError(null);

      try {
        const car = await fetchCarById(vehicleId);
        if (car) {
          setSelectedVehicle(car);
        } else {
          setVehicleError(`Vehicle with ID "${vehicleId}" not found.`);
        }
      } catch (err) {
        setVehicleError('Failed to load vehicle. Please try again.');
      } finally {
        setIsLoadingVehicle(false);
      }
    }

    loadVehicle();
  }, [vehicleId]);

  // Initialize deal input from selected vehicle (only once)
  useEffect(() => {
    if (selectedVehicle && !initializedFromVehicle.current) {
      initializedFromVehicle.current = true;

      // Estimate vehicle cost as ~80% of selling price (typical dealer markup)
      const estimatedCost = Math.round(selectedVehicle.price * 0.80);

      setDealInput(prev => ({
        ...prev,
        vehicleId: String(selectedVehicle.id),
        vehicleYear: selectedVehicle.year,
        vehicleMileage: selectedVehicle.mileage,
        vehiclePrice: selectedVehicle.price,
        vehicleCost: estimatedCost,
      }));
    }
  }, [selectedVehicle]);

  // Run rehash when deal input changes (after vehicle is loaded)
  useEffect(() => {
    if (selectedVehicle && dealInput.vehiclePrice > 0) {
      const rehashResults = runRehash(dealInput);
      setResults(rehashResults);
    }
  }, [dealInput, selectedVehicle]);

  const handleFindLenders = () => {
    const rehashResults = runRehash(dealInput);
    setResults(rehashResults);
  };

  const handleInputChange = (field: keyof DealInput, value: any) => {
    setDealInput(prev => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (isLoadingVehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
          <p className="mt-4 text-lg text-slate-300">Loading vehicle...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (vehicleError || !selectedVehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
        <div className="max-w-md rounded-lg bg-slate-800 p-8 text-center shadow-xl">
          <div className="mb-4 text-5xl">🚗</div>
          <h2 className="mb-2 text-xl font-bold text-red-400">Vehicle Not Found</h2>
          <p className="mb-6 text-slate-300">{vehicleError || 'No vehicle selected.'}</p>
          <Link
            to="/"
            className="inline-block rounded bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            ← Back to Inventory
          </Link>
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

        {/* Vehicle Info Card */}
        <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-800/50 to-indigo-800/50 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                {selectedVehicle.trim && <span className="ml-2 text-lg text-slate-300">{selectedVehicle.trim}</span>}
              </h2>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-300">
                {selectedVehicle.color && <span>Color: {selectedVehicle.color}</span>}
                {selectedVehicle.drivetrain && <span>Drivetrain: {selectedVehicle.drivetrain}</span>}
                {selectedVehicle.fuelType && <span>Fuel: {selectedVehicle.fuelType}</span>}
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-sm text-slate-400">Selling Price</div>
                <div className="text-2xl font-bold text-green-400">${selectedVehicle.price.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Mileage</div>
                <div className="text-2xl font-bold text-blue-300">{selectedVehicle.mileage.toLocaleString()} mi</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Panel - Deal Information */}
          <div className="rounded-lg bg-slate-800 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-white">Deal Parameters</h2>

            <div className="space-y-4">
              {/* Vehicle Info Section */}
              <div className="rounded bg-slate-700/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-blue-300">Vehicle Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Year:</span>
                    <span className="ml-2 text-white">{dealInput.vehicleYear}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Mileage:</span>
                    <span className="ml-2 text-white">{dealInput.vehicleMileage.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Selling Price</label>
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
