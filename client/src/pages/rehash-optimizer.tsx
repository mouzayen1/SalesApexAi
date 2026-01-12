// client/src/pages/rehash-optimizer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { runRehash } from '../../../shared/rehash';
import type { DealInput, DealCandidate } from '../../../shared/deals';
import { fetchCars } from '../lib/api';
import type { Car } from '@shared/schema';

export default function RehashOptimizer() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<Car[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [dealInput, setDealInput] = useState<DealInput>({
    vehicleId: '',
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
  });

  const [results, setResults] = useState<{ bestDeal: DealCandidate | null; allCandidates: DealCandidate[] } | null>(null);

  const handleFindLenders = useCallback((input: DealInput) => {
    const rehashResults = runRehash(input);
    setResults(rehashResults);
  }, []);

  // Fetch inventory on mount
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const cars = await fetchCars();
        setInventory(cars);
        // Auto-select first vehicle and update deal input
        if (cars.length > 0) {
          const firstCar = cars[0];
          const initialDealInput: DealInput = {
            ...dealInput,
            vehicleId: firstCar.id,
            vehiclePrice: firstCar.price,
            vehicleCost: Math.round(firstCar.price * 0.85), // Estimate cost as 85% of price
            vehicleYear: firstCar.year,
            vehicleMileage: firstCar.mileage,
          };
          setDealInput(initialDealInput);
          // Auto-run rehash with the first vehicle
          handleFindLenders(initialDealInput);
        }
      } catch (error) {
        console.error('Failed to load inventory:', error);
      } finally {
        setIsLoadingInventory(false);
      }
    };
    loadInventory();
  }, []);

  // Handle vehicle selection from dropdown
  const handleVehicleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const vehicle = inventory.find(v => v.id === selectedId);

    if (vehicle) {
      const updatedDealInput: DealInput = {
        ...dealInput,
        vehicleId: vehicle.id,
        vehiclePrice: vehicle.price,
        vehicleCost: Math.round(vehicle.price * 0.85), // Estimate cost as 85% of price
        vehicleYear: vehicle.year,
        vehicleMileage: vehicle.mileage,
      };
      setDealInput(updatedDealInput);
      // Auto-run rehash immediately after vehicle selection
      handleFindLenders(updatedDealInput);
    }
  };

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
              {/* Vehicle Selection Dropdown */}
              <div>
                <label className="mb-1 block text-sm text-slate-300">Select Vehicle</label>
                <select
                  value={dealInput.vehicleId}
                  onChange={handleVehicleSelect}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-white"
                  disabled={isLoadingInventory}
                >
                  {isLoadingInventory ? (
                    <option>Loading vehicles...</option>
                  ) : inventory.length === 0 ? (
                    <option>No vehicles available</option>
                  ) : (
                    inventory.map(car => (
                      <option key={car.id} value={car.id}>
                        {car.year} {car.make} {car.model} - ${car.price.toLocaleString()}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Vehicle Info Display */}
              {dealInput.vehicleId && (
                <div className="rounded bg-slate-700/50 p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-400">Year:</span>
                      <span className="ml-2 text-white">{dealInput.vehicleYear}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Miles:</span>
                      <span className="ml-2 text-white">{dealInput.vehicleMileage.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cost:</span>
                      <span className="ml-2 text-white">${dealInput.vehicleCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

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
                onClick={() => handleFindLenders(dealInput)}
                className="w-full rounded bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
                disabled={!dealInput.vehicleId}
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
