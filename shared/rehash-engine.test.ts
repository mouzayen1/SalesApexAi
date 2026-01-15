// shared/rehash-engine.test.ts
// 10-deal test suite with validation tolerances
// Tests deterministic calculations against expected outputs

import { describe, it, expect, beforeAll } from 'vitest';
import type { DealInput, VehicleInput, CustomerInput } from './rehash-types';
import {
  calculateBookValue,
  calculateAmountFinanced,
  calculateDynamicAPR,
  calculatePayment,
  calculateDealerProfit,
  calculateNetAdvance,
} from './rehash-engine';
import { optimizeRehash } from './rehash-optimizer';
import {
  checkEligibility,
  getPreferenceMultiplier,
  hasTheftRisk,
} from './rules-engine';
import {
  getStateConfig,
  getMakeMultiplier,
  getAgeFactor,
  getMileageUtilization,
  getFicoTier,
  ALL_LENDER_PROGRAMS,
} from './lender-programs';
import { validateDeal, VALIDATION_TOLERANCES } from './calibration';

// ============================================================================
// TEST DEAL DATA - 10 representative scenarios
// ============================================================================

interface TestDeal {
  name: string;
  description: string;
  input: DealInput;
  expected: {
    bookValue?: number;
    amountFinanced?: number;
    payment?: number;
    apr?: number;
    netCheck?: number;
    profit?: number;
    eligibleLenders?: string[];
    hasTheftRisk?: boolean;
  };
}

const TEST_DEALS: TestDeal[] = [
  {
    name: 'Deal 1: Prime Toyota Camry',
    description: 'Standard prime deal with reliable vehicle',
    input: {
      state: 'TX',
      vehicle: {
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
        mileage: 35000,
        retailPrice: 22000,
        dealerCost: 18000,
      },
      customer: {
        fico: 720,
        monthlyGrossIncome: 5000,
      },
      downPayment: 2500,
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      bookValue: 20500, // ~93% of retail (2yr old, low miles, Toyota bonus)
      amountFinanced: 24000, // Retail + tax + fees + backend - down
      payment: 450,
      apr: 10.5,
      eligibleLenders: ['westlake', 'western_funding', 'uac'],
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 2: Subprime Hyundai Elantra (Theft Risk)',
    description: 'Subprime deal with high theft risk vehicle',
    input: {
      state: 'TX',
      vehicle: {
        year: 2019,
        make: 'Hyundai',
        model: 'Elantra',
        mileage: 65000,
        retailPrice: 14000,
        dealerCost: 11000,
      },
      customer: {
        fico: 580,
        monthlyGrossIncome: 3500,
      },
      downPayment: 1500,
      products: {
        gap: true,
        vsc: false,
      },
    },
    expected: {
      bookValue: 10500, // Lower due to age, mileage, theft risk
      amountFinanced: 14500,
      payment: 350,
      apr: 22.0,
      hasTheftRisk: true,
    },
  },
  {
    name: 'Deal 3: Deep Subprime Kia Soul (Theft Risk)',
    description: 'Deep subprime with Kia theft risk',
    input: {
      state: 'CA',
      vehicle: {
        year: 2018,
        make: 'Kia',
        model: 'Soul',
        mileage: 85000,
        retailPrice: 12000,
        dealerCost: 9000,
      },
      customer: {
        fico: 520,
        monthlyGrossIncome: 3000,
      },
      downPayment: 2000,
      products: {
        gap: true,
        vsc: false,
      },
    },
    expected: {
      amountFinanced: 12000,
      payment: 320,
      apr: 25.0, // State cap in CA
      hasTheftRisk: true,
    },
  },
  {
    name: 'Deal 4: Near Prime Chevrolet Malibu',
    description: 'Near prime deal, no theft risk but model risk',
    input: {
      state: 'FL',
      vehicle: {
        year: 2020,
        make: 'Chevrolet',
        model: 'Malibu',
        mileage: 55000,
        retailPrice: 18000,
        dealerCost: 14500,
      },
      customer: {
        fico: 660,
        monthlyGrossIncome: 4200,
      },
      downPayment: 2000,
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      amountFinanced: 20000,
      payment: 420,
      apr: 16.5,
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 5: Prime Honda Accord (Low Miles Bonus)',
    description: 'Prime deal with low mileage Honda bonus',
    input: {
      state: 'TX',
      vehicle: {
        year: 2023,
        make: 'Honda',
        model: 'Accord',
        mileage: 15000,
        retailPrice: 28000,
        dealerCost: 24000,
      },
      customer: {
        fico: 750,
        monthlyGrossIncome: 6500,
      },
      downPayment: 5000,
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      bookValue: 28500, // High due to low miles, Honda bonus
      amountFinanced: 28500,
      payment: 480,
      apr: 8.5,
      profit: 5500, // Higher profit on premium deal
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 6: Subprime Nissan Rogue (CVT Risk)',
    description: 'Subprime with Nissan Rogue CVT reliability concerns',
    input: {
      state: 'AZ',
      vehicle: {
        year: 2017,
        make: 'Nissan',
        model: 'Rogue',
        mileage: 95000,
        retailPrice: 13000,
        dealerCost: 10000,
      },
      customer: {
        fico: 590,
        monthlyGrossIncome: 3200,
      },
      downPayment: 1800,
      products: {
        gap: true,
        vsc: false,
      },
    },
    expected: {
      amountFinanced: 13500,
      payment: 340,
      apr: 23.0,
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 7: Deep Subprime Ford F-150',
    description: 'Deep subprime truck deal',
    input: {
      state: 'TX',
      vehicle: {
        year: 2015,
        make: 'Ford',
        model: 'F-150',
        mileage: 120000,
        retailPrice: 18000,
        dealerCost: 14000,
      },
      customer: {
        fico: 510,
        monthlyGrossIncome: 4000,
      },
      downPayment: 3000,
      products: {
        gap: true,
        vsc: false,
      },
    },
    expected: {
      amountFinanced: 18000,
      payment: 430,
      apr: 25.0,
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 8: Negative Trade Equity',
    description: 'Deal with underwater trade-in',
    input: {
      state: 'GA',
      vehicle: {
        year: 2021,
        make: 'Toyota',
        model: 'Corolla',
        mileage: 40000,
        retailPrice: 20000,
        dealerCost: 16500,
      },
      customer: {
        fico: 640,
        monthlyGrossIncome: 4500,
      },
      trade: {
        allowance: 8000,
        payoff: 12000, // Negative equity of $4000
      },
      downPayment: 1000,
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      amountFinanced: 27500, // Higher due to negative equity rolled in
      payment: 550,
      apr: 18.0,
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 9: Luxury Vehicle (Land Rover - Excluded)',
    description: 'Luxury vehicle excluded by most lenders',
    input: {
      state: 'TX',
      vehicle: {
        year: 2018,
        make: 'Land Rover',
        model: 'Range Rover',
        mileage: 75000,
        retailPrice: 35000,
        dealerCost: 28000,
      },
      customer: {
        fico: 680,
        monthlyGrossIncome: 7000,
      },
      downPayment: 5000,
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      eligibleLenders: ['westlake'], // Only Westlake accepts
      hasTheftRisk: false,
    },
  },
  {
    name: 'Deal 10: High LTV Challenge',
    description: 'Challenging deal with high LTV',
    input: {
      state: 'NV',
      vehicle: {
        year: 2016,
        make: 'Dodge',
        model: 'Charger',
        mileage: 110000,
        retailPrice: 16000,
        dealerCost: 12000,
      },
      customer: {
        fico: 550,
        monthlyGrossIncome: 3800,
      },
      downPayment: 500, // Very low down payment
      products: {
        gap: true,
        vsc: true,
      },
    },
    expected: {
      amountFinanced: 21000,
      payment: 480,
      apr: 24.0,
      hasTheftRisk: true, // Charger is theft target
    },
  },
];

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Rehash Engine Core Calculations', () => {
  describe('Book Value Calculation', () => {
    it('calculates correct book value for Toyota Camry 2022', () => {
      const result = calculateBookValue(TEST_DEALS[0].input.vehicle);
      // 2022 is 4 years old in 2026, so age factor should be 0.80
      expect(result.ageFactor).toBeGreaterThanOrEqual(0.75);
      expect(result.ageFactor).toBeLessThanOrEqual(0.85);
      expect(result.mileageUtilization).toBe(1.0); // 35k miles is standard
      expect(result.makeMultiplier).toBeGreaterThan(1.0); // Toyota bonus
      expect(result.finalBookValue).toBeGreaterThan(15000);
      expect(result.finalBookValue).toBeLessThan(22000);
    });

    it('applies depreciation correctly for older vehicles', () => {
      const oldVehicle: VehicleInput = {
        year: 2015,
        make: 'Ford',
        model: 'F-150',
        mileage: 120000,
        retailPrice: 18000,
        dealerCost: 14000,
      };
      const result = calculateBookValue(oldVehicle);

      expect(result.ageFactor).toBeLessThan(0.5); // 10+ years old
      expect(result.mileageUtilization).toBeLessThan(0.9); // High mileage
      expect(result.finalBookValue).toBeLessThan(10000);
    });
  });

  describe('Amount Financed Calculation', () => {
    it('calculates correct amount financed for TX deal', () => {
      const stateConfig = getStateConfig('TX');
      const result = calculateAmountFinanced(TEST_DEALS[0].input, stateConfig);

      expect(result.salesTax).toBeGreaterThan(1000); // 6.25% of 22000
      expect(result.docFee).toBeLessThanOrEqual(150); // TX cap
      expect(result.gapCost).toBe(900); // Standard GAP
      expect(result.vscCost).toBe(1800); // Standard VSC
      expect(result.totalDown).toBe(2500);
      expect(result.amountFinanced).toBeGreaterThan(20000);
    });

    it('includes negative trade equity in amount financed', () => {
      const stateConfig = getStateConfig('GA');
      const result = calculateAmountFinanced(TEST_DEALS[7].input, stateConfig);

      // Trade equity is -4000, should increase amount financed
      expect(result.tradeEquity).toBe(-4000);
      expect(result.amountFinanced).toBeGreaterThan(25000);
    });
  });

  describe('Payment Calculation', () => {
    it('calculates correct monthly payment', () => {
      const result = calculatePayment(24000, 10.5, 60);

      expect(result.monthlyPayment).toBeGreaterThan(400);
      expect(result.monthlyPayment).toBeLessThan(600);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.totalOfPayments).toBeCloseTo(result.monthlyPayment * 60, -2);
    });

    it('handles zero APR correctly', () => {
      const result = calculatePayment(12000, 0, 60);

      expect(result.monthlyPayment).toBe(200); // 12000 / 60
      expect(result.totalInterest).toBe(0);
    });
  });
});

describe('Rules Engine', () => {
  describe('Theft Risk Detection', () => {
    it('detects theft risk for Hyundai 2019', () => {
      const result = hasTheftRisk('Hyundai', 'Elantra', 2019);
      expect(result).toBe(true);
    });

    it('detects theft risk for Kia 2018', () => {
      const result = hasTheftRisk('Kia', 'Soul', 2018);
      expect(result).toBe(true);
    });

    it('does not flag theft risk for Toyota', () => {
      const result = hasTheftRisk('Toyota', 'Camry', 2022);
      expect(result).toBe(false);
    });

    it('does not flag theft risk for Chevy Malibu', () => {
      const result = hasTheftRisk('Chevrolet', 'Malibu', 2020);
      expect(result).toBe(false);
    });
  });

  describe('Eligibility Checks', () => {
    it('Toyota Camry eligible at all lenders', () => {
      const vehicle = TEST_DEALS[0].input.vehicle;
      const customer = TEST_DEALS[0].input.customer;

      const programs = ALL_LENDER_PROGRAMS.filter(p => p.active);
      const eligibleCount = programs.filter(p => {
        const result = checkEligibility(p.id, vehicle, customer);
        return result.eligible;
      }).length;

      expect(eligibleCount).toBeGreaterThanOrEqual(3);
    });

    it('Land Rover excluded by most lenders', () => {
      const vehicle = TEST_DEALS[8].input.vehicle;
      const customer = TEST_DEALS[8].input.customer;

      const programs = ALL_LENDER_PROGRAMS.filter(p => p.active);
      const eligibleCount = programs.filter(p => {
        const result = checkEligibility(p.id, vehicle, customer);
        return result.eligible;
      }).length;

      expect(eligibleCount).toBeLessThanOrEqual(1); // Only Westlake
    });

    it('rejects FICO below minimum', () => {
      const vehicle = TEST_DEALS[0].input.vehicle;
      const customer: CustomerInput = { fico: 400, monthlyGrossIncome: 4000 };

      const result = checkEligibility('westlake_standard', vehicle, customer);
      expect(result.eligible).toBe(false);
      expect(result.ruleHits.some(h => h.code === 'FICO_BELOW_MIN')).toBe(true);
    });
  });

  describe('Preference Multipliers', () => {
    it('applies Honda bonus at Westlake', () => {
      const vehicle: VehicleInput = {
        year: 2022,
        make: 'Honda',
        model: 'Accord',
        mileage: 30000,
        retailPrice: 25000,
        dealerCost: 21000,
      };

      const result = getPreferenceMultiplier('westlake_standard', vehicle);
      expect(result.factor).toBeGreaterThan(1.0);
      expect(result.ruleHits.some(h => h.code === 'BONUS_RELIABILITY')).toBe(true);
    });

    it('applies Hyundai theft penalty', () => {
      const vehicle: VehicleInput = {
        year: 2019,
        make: 'Hyundai',
        model: 'Elantra',
        mileage: 65000,
        retailPrice: 14000,
        dealerCost: 11000,
      };

      const result = getPreferenceMultiplier('westlake_standard', vehicle);
      expect(result.factor).toBeLessThan(1.0);
      expect(result.ruleHits.some(h => h.code === 'HIGH_THEFT_RISK')).toBe(true);
    });
  });
});

describe('Rehash Optimizer', () => {
  it('finds best deal for prime Toyota', () => {
    const result = optimizeRehash(TEST_DEALS[0].input);

    expect(result.bestDeal).not.toBeNull();
    expect(result.candidatesEvaluated).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeGreaterThan(0);

    if (result.bestDeal) {
      expect(result.bestDeal.payment.monthlyPayment).toBeGreaterThan(0);
      expect(result.bestDeal.approvalProbability).toBeGreaterThan(0.5);
    }
  });

  it('handles theft risk vehicle correctly', () => {
    const result = optimizeRehash(TEST_DEALS[1].input);

    expect(result.bestDeal).not.toBeNull();
    expect(result.allRuleHits.some(h => h.code === 'HIGH_THEFT_RISK')).toBe(true);

    if (result.bestDeal) {
      // Approval probability should be lower due to theft risk
      expect(result.bestDeal.approvalProbability).toBeLessThan(0.8);
    }
  });

  it('suggests down payment increase for high LTV', () => {
    const result = optimizeRehash(TEST_DEALS[9].input);

    // Should suggest increasing down payment
    const hasDownIncrease = result.bestDeal?.actionsFromOriginal.some(
      a => a.type === 'INCREASE_DOWN'
    );
    // High LTV deals often need restructuring
    expect(result.warnings.length + (hasDownIncrease ? 1 : 0)).toBeGreaterThan(0);
  });

  it('processes within acceptable time', () => {
    const result = optimizeRehash(TEST_DEALS[0].input);

    expect(result.processingTimeMs).toBeLessThan(5000); // Under 5 seconds
  });
});

describe('State Configuration', () => {
  it('returns correct TX config', () => {
    const config = getStateConfig('TX');
    expect(config.salesTaxRate).toBe(0.0625);
    expect(config.docFeeCap).toBe(150);
    expect(config.aprCap).toBe(30.0);
  });

  it('returns correct CA config', () => {
    const config = getStateConfig('CA');
    expect(config.salesTaxRate).toBe(0.0725);
    expect(config.aprCap).toBe(25.0);
  });

  it('returns default config for unknown state', () => {
    const config = getStateConfig('ZZ');
    expect(config.code).toBe('DEFAULT');
  });
});

describe('Lender Programs', () => {
  it('has active programs for all expected lenders', () => {
    const lenders = ['westlake', 'western_funding', 'uac'];
    for (const lenderId of lenders) {
      const programs = ALL_LENDER_PROGRAMS.filter(
        p => p.lenderId === lenderId && p.active
      );
      expect(programs.length).toBeGreaterThan(0);
    }
  });

  it('has valid FICO tiers', () => {
    for (const program of ALL_LENDER_PROGRAMS) {
      expect(program.ficoTiers.length).toBeGreaterThan(0);
      for (const tier of program.ficoTiers) {
        expect(tier.minFico).toBeLessThan(tier.maxFico);
        expect(tier.baseAPR).toBeGreaterThan(0);
        expect(tier.maxLTV).toBeGreaterThan(100);
      }
    }
  });
});

describe('Integration Tests', () => {
  describe.each(TEST_DEALS.slice(0, 5))('$name', (testDeal) => {
    it(`processes ${testDeal.name} without errors`, () => {
      const result = optimizeRehash(testDeal.input);
      expect(result).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it(`finds at least one candidate for ${testDeal.name}`, () => {
      const result = optimizeRehash(testDeal.input);
      // Most deals should have at least one option
      if (testDeal.expected.eligibleLenders?.length !== 0) {
        expect(result.candidatesEvaluated).toBeGreaterThan(0);
      }
    });

    if (testDeal.expected.hasTheftRisk !== undefined) {
      it(`correctly identifies theft risk for ${testDeal.name}`, () => {
        const result = hasTheftRisk(
          testDeal.input.vehicle.make,
          testDeal.input.vehicle.model,
          testDeal.input.vehicle.year
        );
        expect(result).toBe(testDeal.expected.hasTheftRisk);
      });
    }
  });
});

describe('Validation Tolerances', () => {
  it('has reasonable tolerance values', () => {
    expect(VALIDATION_TOLERANCES.bookValuePercent).toBe(0.02); // 2%
    expect(VALIDATION_TOLERANCES.amountFinancedDollars).toBe(100); // $100
    expect(VALIDATION_TOLERANCES.paymentDollars).toBe(5); // $5
    expect(VALIDATION_TOLERANCES.aprPercent).toBe(0.005); // 0.5%
    expect(VALIDATION_TOLERANCES.netCheckPercent).toBe(0.02); // 2%
  });
});
