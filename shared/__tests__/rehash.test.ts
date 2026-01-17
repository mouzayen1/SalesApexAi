import { describe, it, expect } from 'vitest';
import { runRehash, calculateMonthlyPayment } from '../rehash';
import type { DealInput } from '../deals';
import { LENDERS } from '../lenders';

// Helper to create base deal input
function baseDeal(overrides: Partial<DealInput> = {}): DealInput {
  return {
    vehicleId: 'test-1',
    vehicleYear: 2020,
    vehicleMileage: 50000,
    vehiclePrice: 20000,
    vehicleCost: 17000,
    taxRate: 0.09,
    fees: 799,
    downPayment: 3000,
    tradeAllowance: 0,
    tradePayoff: 0,
    backendProducts: { gap: false, vsc: false, otherProductsTotal: 0 },
    customerCreditTier: 'subprime',
    targetPayment: 450,
    paymentTolerance: 50,
    ...overrides,
  };
}

describe('calculateMonthlyPayment', () => {
  it('calculates standard amortization correctly', () => {
    // $20000 @ 20% APR for 72 months
    // Formula: P = r*PV / (1 - (1+r)^-n) where r = 0.20/12 = 0.01667
    const payment = calculateMonthlyPayment(20000, 20, 72);
    expect(payment).toBeCloseTo(479.06, 0);
  });

  it('handles 0% APR correctly', () => {
    const payment = calculateMonthlyPayment(20000, 0, 72);
    expect(payment).toBeCloseTo(277.78, 0);
  });

  it('handles short term correctly', () => {
    const payment = calculateMonthlyPayment(20000, 10, 36);
    expect(payment).toBeCloseTo(645.34, 0);
  });
});

describe('runRehash eligibility filtering', () => {
  it('filters out lenders when mileage exceeds maxMiles', () => {
    const deal = baseDeal({ vehicleMileage: 160000 });
    const result = runRehash(deal);

    const lenderNames = [...new Set(result.allCandidates.map(c => c.lenderName))];
    expect(lenderNames).not.toContain('United Auto Credit'); // maxMiles: 140000
    expect(lenderNames).not.toContain('Westlake Financial'); // maxMiles: 150000
    expect(lenderNames).toContain('Western Funding'); // maxMiles: 180000
  });

  it('filters out all lenders when mileage exceeds all maxMiles', () => {
    const deal = baseDeal({ vehicleMileage: 200000 });
    const result = runRehash(deal);
    expect(result.allCandidates.length).toBe(0);
    expect(result.bestDeal).toBeNull();
  });

  it('filters out lenders when vehicle age exceeds maxVehicleAgeYears', () => {
    // Current year (2026) - 2008 = 18 years old
    // All lenders have maxVehicleAgeYears <= 15
    const deal = baseDeal({ vehicleYear: 2008 });
    const result = runRehash(deal);
    expect(result.allCandidates.length).toBe(0);
  });

  it('filters out candidates when LTV exceeds lender cap', () => {
    const deal = baseDeal({
      vehiclePrice: 10000,
      vehicleCost: 8000,
      downPayment: 0,
    });
    const result = runRehash(deal);

    result.allCandidates.forEach(candidate => {
      const lender = LENDERS.find(l => l.id === candidate.lenderId);
      const tierRow = lender?.pricingGrid.find(
        p => p.creditTier === deal.customerCreditTier
      );
      expect(candidate.ltv).toBeLessThanOrEqual(tierRow?.maxLtvPercent ?? 999);
    });
  });

  it('filters out candidates when amount financed below minimum', () => {
    const deal = baseDeal({
      vehiclePrice: 3000,
      vehicleCost: 2500,
      downPayment: 1000
    });
    const result = runRehash(deal);
    expect(result.allCandidates.length).toBe(0);
  });
});

describe('runRehash determinism', () => {
  it('returns identical results for identical inputs', () => {
    const deal = baseDeal();
    const result1 = runRehash(deal);
    const result2 = runRehash(deal);

    expect(result1.allCandidates.length).toBe(result2.allCandidates.length);
    expect(result1.bestDeal?.netCheckToDealer).toBe(result2.bestDeal?.netCheckToDealer);
    expect(result1.bestDeal?.payment).toBe(result2.bestDeal?.payment);
    expect(result1.bestDeal?.apr).toBe(result2.bestDeal?.apr);
  });

  it('returns different results for different credit tiers', () => {
    const dealPrime = baseDeal({ customerCreditTier: 'prime' });
    const dealSubprime = baseDeal({ customerCreditTier: 'subprime' });

    const resultPrime = runRehash(dealPrime);
    const resultSubprime = runRehash(dealSubprime);

    // Prime should have lower APR than subprime
    expect(resultPrime.bestDeal?.apr).toBeLessThan(resultSubprime.bestDeal?.apr ?? 0);
  });
});

describe('Golden Fixtures - 10 Test Deals', () => {
  const fixtures = [
    {
      name: 'Deal 1: Standard subprime, 50k miles',
      input: baseDeal(),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.allCandidates.length).toBeGreaterThan(0);
        expect(result.bestDeal).not.toBeNull();
      },
    },
    {
      name: 'Deal 2: High mileage 160k - only Western Funding',
      input: baseDeal({ vehicleMileage: 160000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.bestDeal?.lenderName).toBe('Western Funding');
        const uniqueLenders = [...new Set(result.allCandidates.map((c) => c.lenderName))];
        expect(uniqueLenders).toEqual(['Western Funding']);
      },
    },
    {
      name: 'Deal 3: Mileage 200k - no lenders eligible',
      input: baseDeal({ vehicleMileage: 200000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.allCandidates.length).toBe(0);
        expect(result.bestDeal).toBeNull();
      },
    },
    {
      name: 'Deal 4: Old vehicle 2008 - no lenders eligible',
      input: baseDeal({ vehicleYear: 2008 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.allCandidates.length).toBe(0);
      },
    },
    {
      name: 'Deal 5: Prime credit - lower APR',
      input: baseDeal({ customerCreditTier: 'prime' }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.bestDeal?.apr).toBeLessThan(15);
      },
    },
    {
      name: 'Deal 6: Deep subprime - higher APR',
      input: baseDeal({ customerCreditTier: 'deep_subprime' }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.bestDeal?.apr).toBeGreaterThan(20);
      },
    },
    {
      name: 'Deal 7: High down payment $8000',
      input: baseDeal({ downPayment: 8000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.bestDeal?.ltv).toBeLessThan(100);
      },
    },
    {
      name: 'Deal 8: Trade-in with $3000 equity',
      input: baseDeal({ tradeAllowance: 5000, tradePayoff: 2000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        expect(result.bestDeal?.totalDown).toBeGreaterThan(3000);
      },
    },
    {
      name: 'Deal 9: Trade-in with negative equity',
      input: baseDeal({ tradeAllowance: 2000, tradePayoff: 5000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        // With negative equity, amount financed should be higher than a standard deal
        const standardDeal = baseDeal();
        const standardResult = runRehash(standardDeal);
        expect(result.bestDeal?.amountFinanced).toBeGreaterThan(
          standardResult.bestDeal?.amountFinanced ?? 0
        );
      },
    },
    {
      name: 'Deal 10: Mileage exactly at UAC limit (140000)',
      input: baseDeal({ vehicleMileage: 140000 }),
      assertions: (result: ReturnType<typeof runRehash>) => {
        const lenderNames = [...new Set(result.allCandidates.map((c) => c.lenderName))];
        expect(lenderNames).toContain('United Auto Credit');
      },
    },
  ];

  fixtures.forEach((fixture) => {
    it(fixture.name, () => {
      const result = runRehash(fixture.input);
      fixture.assertions(result);
    });
  });
});

describe('State-specific tax credit', () => {
  it('applies trade-in tax credit in Texas', () => {
    const dealTX = baseDeal({
      state: 'TX',
      tradeAllowance: 5000,
      tradePayoff: 0
    });
    const dealCA = baseDeal({
      state: 'CA',
      tradeAllowance: 5000,
      tradePayoff: 0
    });

    const resultTX = runRehash(dealTX);
    const resultCA = runRehash(dealCA);

    // TX has trade-in tax credit, so amount financed should be lower
    expect(resultTX.bestDeal?.amountFinanced).toBeLessThan(
      resultCA.bestDeal?.amountFinanced ?? 0
    );
  });

  it('applies trade-in tax credit in Florida', () => {
    const dealFL = baseDeal({
      state: 'FL',
      tradeAllowance: 5000,
      tradePayoff: 0
    });
    const dealNV = baseDeal({
      state: 'NV',
      tradeAllowance: 5000,
      tradePayoff: 0
    });

    const resultFL = runRehash(dealFL);
    const resultNV = runRehash(dealNV);

    // FL has trade-in tax credit, NV does not
    expect(resultFL.bestDeal?.amountFinanced).toBeLessThan(
      resultNV.bestDeal?.amountFinanced ?? 0
    );
  });

  it('does not apply tax credit when trade-in has negative equity', () => {
    const dealTX = baseDeal({
      state: 'TX',
      tradeAllowance: 2000,
      tradePayoff: 5000
    });
    const dealCA = baseDeal({
      state: 'CA',
      tradeAllowance: 2000,
      tradePayoff: 5000
    });

    const resultTX = runRehash(dealTX);
    const resultCA = runRehash(dealCA);

    // With negative equity, no tax credit applies - amounts should be equal
    expect(resultTX.bestDeal?.amountFinanced).toBe(resultCA.bestDeal?.amountFinanced);
  });
});

describe('APR and Reserve calculation', () => {
  it('contract rate is between buy rate and max markup', () => {
    const deal = baseDeal();
    const result = runRehash(deal);

    // Contract APR should be reasonable (between buy rate and max)
    // For subprime, buy rates are around 16-18%, max markup is 3%
    expect(result.bestDeal?.apr).toBeGreaterThan(15);
    expect(result.bestDeal?.apr).toBeLessThan(25);
  });

  it('includes buy rate info in adjustments', () => {
    const deal = baseDeal();
    const result = runRehash(deal);

    // Check that adjustments include buy rate information
    const hasRateInfo = result.bestDeal?.adjustments.some(
      adj => adj.includes('buy rate:')
    );
    expect(hasRateInfo).toBe(true);
  });

  it('includes dealer reserve in adjustments', () => {
    const deal = baseDeal();
    const result = runRehash(deal);

    // Check that adjustments include dealer reserve
    const hasReserve = result.bestDeal?.adjustments.some(
      adj => adj.includes('Dealer reserve:')
    );
    expect(hasReserve).toBe(true);
  });

  it('prime credit gets lower APR than deep subprime', () => {
    const dealPrime = baseDeal({ customerCreditTier: 'prime' });
    const dealDeep = baseDeal({ customerCreditTier: 'deep_subprime' });

    const resultPrime = runRehash(dealPrime);
    const resultDeep = runRehash(dealDeep);

    expect(resultPrime.bestDeal?.apr).toBeLessThan(resultDeep.bestDeal?.apr ?? 0);
  });
});
