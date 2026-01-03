import React, { useState } from 'react';
import type { DealInputs, LenderRulePack } from '../lib/rehash/types';
import { generateRehashSuggestions } from '../lib/rehash/calculator';
import { DEFAULT_LENDERS } from '../lib/rehash/defaultLenders';

const RehashOptimizerPanel: React.FC = () => {
  const [inputs, setInputs] = useState<DealInputs>({
    vehicleYear: 2020,
    vehicleMileage: 35000,
    vehiclePrice: 25000,
    vehicleLabel: '',
    creditTier: 'near_prime',
    downPayment: 2000,
    tradeValue: 0,
    tradePayoff: 0,
    taxRate: 7,
    fees: 500,
    targetMonthly: 72,
    monthlyTolerance: 25,
    includeGAP: true,
    gapPrice: 800,
    includeVSC: false,
    vscPrice: 0,
  });

  const [lenders, setLenders] = useState<LenderRulePack[]>(DEFAULT_LENDERS);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showLenderEditor, setShowLenderEditor] = useState(false);

  const handleCalculate = () => {
    const results = generateRehashSuggestions(inputs, lenders);
    setSuggestions(results);
  };

  const handleInputChange = (field: keyof DealInputs, value: any) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Rehash Optimizer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vehicle Information */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Vehicle Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input
                type="number"
                value={inputs.vehicleYear}
                onChange={(e) => handleInputChange('vehicleYear', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mileage</label>
              <input
                type="number"
                value={inputs.vehicleMileage}
                onChange={(e) => handleInputChange('vehicleMileage', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price ($)</label>
              <input
                type="number"
                value={inputs.vehiclePrice}
                onChange={(e) => handleInputChange('vehiclePrice', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                type="text"
                value={inputs.vehicleLabel}
                onChange={(e) => handleInputChange('vehicleLabel', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Customer / Deal Structure */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Customer / Deal Structure</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Credit Tier</label>
              <select
                value={inputs.creditTier}
                onChange={(e) => handleInputChange('creditTier', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="prime">Prime</option>
                <option value="near_prime">Near Prime</option>
                <option value="subprime">Subprime</option>
                <option value="deep_subprime">Deep Subprime</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Down Payment ($)</label>
              <input
                type="number"
                value={inputs.downPayment}
                onChange={(e) => handleInputChange('downPayment', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trade Value ($)</label>
              <input
                type="number"
                value={inputs.tradeValue}
                onChange={(e) => handleInputChange('tradeValue', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trade Payoff ($)</label>
              <input
                type="number"
                value={inputs.tradePayoff}
                onChange={(e) => handleInputChange('tradePayoff', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
              <input
                type="number"
                value={inputs.taxRate}
                onChange={(e) => handleInputChange('taxRate', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fees ($)</label>
              <input
                type="number"
                value={inputs.fees}
                onChange={(e) => handleInputChange('fees', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Budget Target */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Budget Target (Optional)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Target Monthly ($)</label>
              <input
                type="number"
                value={inputs.targetMonthly}
                onChange={(e) => handleInputChange('targetMonthly', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monthly Tolerance ($)</label>
              <input
                type="number"
                value={inputs.monthlyTolerance}
                onChange={(e) => handleInputChange('monthlyTolerance', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Optional Products */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Optional Products</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={inputs.includeGAP}
                onChange={(e) => handleInputChange('includeGAP', e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm font-medium">Include GAP</label>
            </div>
            {inputs.includeGAP && (
              <div>
                <label className="block text-sm font-medium mb-1">GAP Price ($)</label>
                <input
                  type="number"
                  value={inputs.gapPrice}
                  onChange={(e) => handleInputChange('gapPrice', Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            )}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={inputs.includeVSC}
                onChange={(e) => handleInputChange('includeVSC', e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm font-medium">Include VSC</label>
            </div>
            {inputs.includeVSC && (
              <div>
                <label className="block text-sm font-medium mb-1">VSC Price ($)</label>
                <input
                  type="number"
                  value={inputs.vscPrice}
                  onChange={(e) => handleInputChange('vscPrice', Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={handleCalculate}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Calculate Suggestions
        </button>
        <button
          onClick={() => setShowLenderEditor(!showLenderEditor)}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          {showLenderEditor ? 'Hide' : 'Show'} Lender Config
        </button>
      </div>

      {/* Lender Editor */}
      {showLenderEditor && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Lender Configuration</h2>
          <div className="space-y-2">
            {lenders.map((lender, idx) => (
              <div key={idx} className="border p-2 rounded flex gap-4 items-center">
                <input
                  type="text"
                  value={lender.id}
                  onChange={(e) => {
                    const updated = [...lenders];
                    updated[idx].id = e.target.value;
                    setLenders(updated);
                  }}
                  className="flex-1 px-2 py-1 border rounded"
                />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={lender.includeGAP}
                    onChange={(e) => {
                      const updated = [...lenders];
                      updated[idx].includeGAP = e.target.checked;
                      setLenders(updated);
                    }}
                    className="mr-1"
                  />
                  GAP
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={lender.includeVSC}
                    onChange={(e) => {
                      const updated = [...lenders];
                      updated[idx].includeVSC = e.target.checked;
                      setLenders(updated);
                    }}
                    className="mr-1"
                  />
                  VSC
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={lender.aprOverride || ''}
                  onChange={(e) => {
                    const updated = [...lenders];
                    updated[idx].aprOverride = Number(e.target.value);
                    setLenders(updated);
                  }}
                  placeholder="APR"
                  className="w-24 px-2 py-1 border rounded"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {suggestions.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Suggested Lenders</h2>
          <div className="space-y-2">
            {suggestions.map((sugg, idx) => (
              <div key={idx} className="border p-3 rounded">
                <div className="font-semibold">{sugg.lenderName}</div>
                <div className="text-sm text-gray-600">
                  APR: {sugg.suggestedAPR.toFixed(2)}% | Est. Monthly: ${sugg.estimatedMonthly.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  {sugg.includesGAP && 'GAP '}
                  {sugg.includesVSC && 'VSC'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RehashOptimizerPanel;
