import React, { useState } from 'react';
import { DealInputs } from '../lib/domain/deal/dealTypes';
import { evaluateLenders } from '../lib/domain/rehash/rehashEngine';
import { LenderDecision } from '../lib/domain/lender/lenderTypes';

const RehashOptimizerPage: React.FC = () => {
  const [deal, setDeal] = useState<DealInputs>({
    vehiclePrice: 25000,
    downPayment: 3000,
    tradeValue: 0,
    tradeOwed: 0,
    salesTax: 7.5,
    docFee: 300,
    dealType: 'retail',
    creditTier: 'good',
  });
  const [results, setResults] = useState<LenderDecision[]>([]);

  const handleCalculate = () => {
    const lenderDecisions = evaluateLenders(deal);
    setResults(lenderDecisions);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Rehash Optimizer</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Deal Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2">Vehicle Price</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded bg-white/20 text-white"
                  value={deal.vehiclePrice}
                  onChange={(e) => setDeal({ ...deal, vehiclePrice: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-white mb-2">Down Payment</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded bg-white/20 text-white"
                  value={deal.downPayment}
                  onChange={(e) => setDeal({ ...deal, downPayment: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-white mb-2">Trade Value</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded bg-white/20 text-white"
                  value={deal.tradeValue}
                  onChange={(e) => setDeal({ ...deal, tradeValue: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-white mb-2">Trade Owed</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 rounded bg-white/20 text-white"
                  value={deal.tradeOwed}
                  onChange={(e) => setDeal({ ...deal, tradeOwed: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-white mb-2">Credit Tier</label>
                <select
                  className="w-full px-4 py-2 rounded bg-white/20 text-white"
                  value={deal.creditTier}
                  onChange={(e) => setDeal({ ...deal, creditTier: e.target.value as any })}
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="deep-subprime">Deep Subprime</option>
                </select>
              </div>
              
              <button
                onClick={handleCalculate}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition"
              >
                Find Lenders
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Lender Results</h2>
            
            {results.length === 0 ? (
              <p className="text-white/70">Click "Find Lenders" to see results</p>
            ) : (
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={result.lenderId}
                    className={`p-4 rounded-lg ${
                      result.approved ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {index + 1}. {result.lenderName}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded text-sm ${
                          result.approved
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {result.approved ? 'Approved' : 'Declined'}
                      </span>
                    </div>
                    
                    {result.approved ? (
                      <div className="text-white/90 space-y-1">
                        <p>APR: {result.apr}%</p>
                        <p>Term: {result.termMonths} months</p>
                        <p>Monthly Payment: ${result.monthlyPayment?.toFixed(2)}</p>
                      </div>
                    ) : (
                      <p className="text-white/70">{result.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RehashOptimizerPage;
