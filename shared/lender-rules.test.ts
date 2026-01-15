// shared/lender-rules.test.ts
// Test cases for lender rules engine - Run with: npx tsx shared/lender-rules.test.ts

import {
  evaluateVehicleForLender,
  evaluateVehicleForAllLenders,
  hasTheftRisk,
  hasModelRisk,
  hasMileageRisk,
  type VehicleInfo,
  type LenderEvaluation,
} from './lender-rules';

// ============================================================================
// TEST VEHICLES (5 required examples)
// ============================================================================

const TEST_VEHICLES: VehicleInfo[] = [
  // 1. Hyundai 2019 - Should trigger theft risk for lenders where 2011-2022 applies
  {
    make: 'Hyundai',
    model: 'Elantra',
    year: 2019,
    mileage: 45000,
  },

  // 2. Kia 2021 - Same theft risk scenario
  {
    make: 'Kia',
    model: 'Forte',
    year: 2021,
    mileage: 28000,
  },

  // 3. Chevy Malibu 2019 - Should NOT trigger theft risk
  {
    make: 'Chevrolet',
    model: 'Malibu',
    year: 2019,
    mileage: 62000,
  },

  // 4. Nissan Rogue 2016 - Should trigger UAC MODEL_RISK penalty (0.95)
  {
    make: 'Nissan',
    model: 'Rogue',
    year: 2016,
    mileage: 78000,
  },

  // 5. Ford F150 2015 - Should trigger Westlake MODEL_RISK penalty (0.92)
  {
    make: 'Ford',
    model: 'F-150',
    year: 2015,
    mileage: 95000,
  },
];

// Additional test vehicles for comprehensive coverage
const ADDITIONAL_TEST_VEHICLES: VehicleInfo[] = [
  // Honda Civic (should get bonuses from multiple lenders)
  {
    make: 'Honda',
    model: 'Civic',
    year: 2022,
    mileage: 25000,
  },

  // Toyota Camry (should get Westlake bonus)
  {
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    mileage: 30000,
  },

  // Lexus low-mileage (Western Funding bonus)
  {
    make: 'Lexus',
    model: 'RX 350',
    year: 2022,
    mileage: 22000,
  },

  // Chevy Silverado high-mileage (Western Funding penalty)
  {
    make: 'Chevrolet',
    model: 'Silverado 1500',
    year: 2018,
    mileage: 115000,
  },

  // Land Rover (excluded by Western Funding and UAC)
  {
    make: 'Land Rover',
    model: 'Range Rover',
    year: 2020,
    mileage: 35000,
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

function formatEvaluation(eval_: LenderEvaluation): string {
  const lines: string[] = [];
  lines.push(`  Lender: ${eval_.lenderId}`);
  lines.push(`  Eligible: ${eval_.eligible}`);
  lines.push(`  Preference Factor: ${eval_.preferenceFactor.toFixed(3)}`);

  if (eval_.eligibilityReasons.length > 0) {
    lines.push(`  Eligibility Issues:`);
    eval_.eligibilityReasons.forEach(r => {
      lines.push(`    - [${r.code}] ${r.label}: ${r.details || ''}`);
    });
  }

  if (eval_.preferenceHits.length > 0) {
    lines.push(`  Preference Rules Applied:`);
    eval_.preferenceHits.forEach(h => {
      lines.push(`    - [${h.code}] ${h.label} (factor: ${h.factor})`);
    });
  }

  return lines.join('\n');
}

function runTest(vehicle: VehicleInfo, index: number): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST ${index + 1}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`Mileage: ${vehicle.mileage.toLocaleString()} miles`);
  console.log('='.repeat(70));

  const evaluations = evaluateVehicleForAllLenders(vehicle);

  // Check for specific risks across all lenders
  const allHits = evaluations.flatMap(e => e.allHits);
  const isTheftRisk = hasTheftRisk(allHits);
  const isModelRisk = hasModelRisk(allHits);
  const isMileageRisk = hasMileageRisk(allHits);

  console.log(`\nRisk Flags:`);
  console.log(`  Has Theft Risk: ${isTheftRisk ? 'YES' : 'NO'}`);
  console.log(`  Has Model Risk: ${isModelRisk ? 'YES' : 'NO'}`);
  console.log(`  Has Mileage Risk: ${isMileageRisk ? 'YES' : 'NO'}`);

  console.log(`\nLender Evaluations:`);
  evaluations.forEach(eval_ => {
    console.log('\n' + formatEvaluation(eval_));
  });
}

function runAllTests(): void {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║              LENDER RULES ENGINE - TEST RESULTS                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  console.log('\n### REQUIRED 5 EXAMPLE VEHICLES ###');
  TEST_VEHICLES.forEach((vehicle, index) => {
    runTest(vehicle, index);
  });

  console.log('\n\n### ADDITIONAL TEST VEHICLES ###');
  ADDITIONAL_TEST_VEHICLES.forEach((vehicle, index) => {
    runTest(vehicle, index + 5);
  });

  // Summary assertions
  console.log('\n\n' + '='.repeat(70));
  console.log('SUMMARY - Expected vs Actual Results');
  console.log('='.repeat(70));

  // Test 1: Hyundai 2019
  const hyundaiEval = evaluateVehicleForAllLenders(TEST_VEHICLES[0]);
  const hyundaiTheft = hasTheftRisk(hyundaiEval.flatMap(e => e.allHits));
  console.log(`\n1. Hyundai 2019 Theft Risk: ${hyundaiTheft ? '✓ PASS (has theft risk)' : '✗ FAIL (no theft risk)'}`);

  // Test 2: Kia 2021
  const kiaEval = evaluateVehicleForAllLenders(TEST_VEHICLES[1]);
  const kiaTheft = hasTheftRisk(kiaEval.flatMap(e => e.allHits));
  console.log(`2. Kia 2021 Theft Risk: ${kiaTheft ? '✓ PASS (has theft risk)' : '✗ FAIL (no theft risk)'}`);

  // Test 3: Chevy Malibu 2019 - NO theft risk
  const malibuEval = evaluateVehicleForAllLenders(TEST_VEHICLES[2]);
  const malibuTheft = hasTheftRisk(malibuEval.flatMap(e => e.allHits));
  console.log(`3. Chevy Malibu 2019 NO Theft Risk: ${!malibuTheft ? '✓ PASS (no theft risk)' : '✗ FAIL (has theft risk - WRONG!)'}`);

  // Test 4: Nissan Rogue 2016 - UAC penalty
  const rogueUacEval = evaluateVehicleForLender('uac', TEST_VEHICLES[3]);
  const rogueHasModelRisk = hasModelRisk(rogueUacEval.allHits);
  const rogueUacFactor = rogueUacEval.preferenceFactor;
  console.log(`4. Nissan Rogue 2016 UAC Penalty: ${rogueHasModelRisk && rogueUacFactor === 0.95 ? '✓ PASS (MODEL_RISK, 0.95)' : `✗ FAIL (factor: ${rogueUacFactor})`}`);

  // Test 5: Ford F150 2015 - Westlake penalty
  const f150WestlakeEval = evaluateVehicleForLender('westlake', TEST_VEHICLES[4]);
  const f150HasModelRisk = hasModelRisk(f150WestlakeEval.allHits);
  const f150WestlakeFactor = f150WestlakeEval.preferenceFactor;
  console.log(`5. Ford F150 2015 Westlake Penalty: ${f150HasModelRisk && f150WestlakeFactor === 0.92 ? '✓ PASS (MODEL_RISK, 0.92)' : `✗ FAIL (factor: ${f150WestlakeFactor})`}`);

  console.log('\n' + '='.repeat(70));
  console.log('Test run complete.\n');
}

// Run tests if this file is executed directly
runAllTests();
