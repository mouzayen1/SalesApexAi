# Rehash Optimizer Accuracy Documentation

This document describes the calculation methodology, testing approach, and configuration management for the rehash optimizer engine.

## Overview

The rehash optimizer calculates deal structures across multiple lenders to find optimal financing options. The engine prioritizes:

1. **Determinism** - Identical inputs always produce identical outputs
2. **Accuracy** - Calculations match Excel/financial calculator standards
3. **Transparency** - All calculation steps can be traced and audited
4. **Maintainability** - Lender rules are data-driven, not hardcoded

## LTV Calculation

### Definition

**LTV (Loan-to-Value)** = (Amount Financed / Book Value) × 100

### Important: Book Value vs Retail Price

LTV should be calculated using **book/wholesale value**, NOT retail selling price. This is the industry standard because:

1. Book value represents the lender's collateral recovery value
2. If the borrower defaults, the lender recovers book value, not retail
3. Using retail price would understate the lender's risk

### Example

```
Retail Price: $20,000 (what customer pays)
Book Value:   $16,000 (wholesale/auction value)
Amount Financed: $18,000

LTV using book value: 112.5% (correct - shows lender risk)
LTV using retail: 90% (incorrect - understates risk)
```

### Book Value Estimation

The system uses a deterministic estimation algorithm when external book values aren't provided:

1. **Base calculation**: Uses retail price and vehicle age to estimate original MSRP
2. **Depreciation curve**: Standard curve adjusted per year:
   - Year 1: 20%
   - Year 2: 15%
   - Year 3: 12%
   - Years 4-5: 10%/year
   - Years 6-10: 8%/year
   - Years 11+: 5%/year

3. **Make adjustment**: Different makes have different residual strengths:
   - Toyota, Honda, Lexus: Strong residual (+5-15%)
   - Domestic trucks: Average
   - Chrysler, Mitsubishi: Weaker residual (-5-15%)

4. **Wholesale ratio**: Book = Retail × wholesale_percent
   - Newer vehicles (≤3 years): 88%
   - 4-6 years: 85%
   - 7-10 years: 82%
   - Older: 78%

### Integration with External Sources

The engine supports injecting book values from external sources:

```typescript
const bookValue: BookValueInput = {
  source: 'black_book',
  wholesaleValue: 16500,
  retailValue: 19500,
  adjustedValue: 16200,
  asOfDate: '2025-01-13'
};

const result = calculateLtv(amountFinanced, vehicle, bookValue);
```

## Payment Calculation

### PMT Formula

The engine uses the standard PMT formula matching Excel behavior:

```
payment = (r × principal) / (1 - (1 + r)^(-n))

Where:
- r = monthly interest rate (APR / 12 / 100)
- principal = amount financed
- n = term in months
```

### Rounding Strategy

All monetary values are rounded using "half away from zero" (standard commercial rounding):

- $333.665 → $333.67
- $333.664 → $333.66
- $-333.665 → $-333.67

Payments are always rounded to cents (2 decimal places).

### Verification

The payment tests include regression cases verified against Excel PMT:

```typescript
// Excel: =PMT(0.12/12, 60, -15000) = 333.67
calculatePayment(15000, 12, 60) // Returns 333.67
```

## Lender Configuration

### Schema Structure

Lender rules are stored as JSON configuration files:

```
shared/underwriting/lenders/config/
├── westlake.json
├── westernFunding.json
└── uac.json
```

### Configuration Fields

```json
{
  "id": "westlake",
  "name": "Westlake Financial",
  "version": "1.0.0",
  "approved": true,
  "needsReview": false,

  "tiers": [
    {
      "creditTier": "subprime",
      "minApr": 18,
      "maxApr": 23,
      "minDownPercent": 10,
      "baseAdvancePercent": 115,
      "maxAdvancePercent": 140,
      "maxLtvPercent": 140
    }
  ],

  "vehicleRestrictions": {
    "maxAgeYears": 20,
    "maxMileage": 180000,
    "excludedMakes": ["Daewoo", "Ferrari"]
  },

  "vehicleRiskAdjustments": [
    {
      "make": "Kia",
      "multiplier": 0.90,
      "reason": "Theft Risk",
      "yearRange": { "start": 2011, "end": 2021 }
    }
  ]
}
```

### Approval Workflow

1. New configs have `approved: false` and `needsReview: true`
2. Human reviews and verifies against lender documentation
3. Set `approved: true` after verification
4. Only approved configs are used in production (unless `ALLOW_UNREVIEWED_LENDER_CONFIGS=true`)

## Running Tests

### Unit Tests

```bash
# Install vitest if not already installed
npm install -D vitest

# Run all tests
npx vitest

# Run specific test file
npx vitest tests/payment.test.ts
npx vitest tests/ltv.test.ts
npx vitest tests/engine_accuracy.test.ts
```

### Accuracy Test Suite

The 10-deal test suite validates end-to-end accuracy:

```bash
# Run accuracy tests with CSV output
npx tsx scripts/run_accuracy.ts

# Run with verbose output
npx tsx scripts/run_accuracy.ts --verbose

# Custom output file
npx tsx scripts/run_accuracy.ts --output my_results.csv
```

### Test Fixtures

Test deals are defined in `tests/fixtures/deals_10.json`. Each deal includes:

- Input parameters (vehicle, customer, deal structure)
- Expected outcomes (lender, payment range, risk recommendations)

## Updating Lender Configs

### Manual Update

1. Edit the JSON file in `shared/underwriting/lenders/config/`
2. Bump the version number
3. Update `lastUpdated` date
4. Set `needsReview: true` until verified
5. Run validation:

```bash
npx tsx -e "
import { validateLenderSchema } from './shared/underwriting/lenders/schema';
import config from './shared/underwriting/lenders/config/westlake.json';
console.log(validateLenderSchema(config));
"
```

### Groq-Assisted Extraction

Use the matrix extractor to convert rate sheets to our schema:

```bash
# Set API key
export GROQ_API_KEY=your_key_here

# Extract from text file
npx tsx scripts/extract_lender_matrix.ts \
  --input /path/to/rate_sheet.txt \
  --lender "New Lender Name"

# Output goes to shared/underwriting/lenders/config/new_lender_name.json
```

**Important**: Groq-extracted configs are marked `needsReview: true` and require human verification before production use.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_ENGINE_V2` | Use new calculation engine | `false` |
| `ALLOW_UNREVIEWED_LENDER_CONFIGS` | Allow unapproved configs | `false` |
| `GROQ_API_KEY` | API key for Groq extraction | Required for extraction |

## Debug Tracing

Enable calculation tracing for detailed diagnostics:

```typescript
import { runEngine } from './shared/underwriting/engine';

const result = runEngine(input, { enableTracing: true });

// Each candidate includes trace data:
result.bestDeal.trace = {
  bookValueUsed: 16500,
  bookValueSource: 'estimated',
  computedLtv: 112.5,
  lenderLtvCap: 140,
  ltvPassed: true,
  // ... more trace fields
};
```

## Architecture

```
shared/
├── deals.ts           # Type definitions
├── lenders.ts         # Legacy lender configs
├── rehash.ts          # Main entry point (V1 engine)
└── underwriting/
    ├── types.ts       # Core type definitions
    ├── money.ts       # Deterministic rounding
    ├── payment.ts     # PMT calculations
    ├── ltv.ts         # LTV calculations
    ├── bookValue.ts   # Book value estimation
    ├── engine.ts      # V2 calculation engine
    ├── adapter.ts     # V1/V2 bridge
    └── lenders/
        ├── schema.ts  # Config validation
        ├── loader.ts  # Config loading
        └── config/    # JSON configs
            ├── westlake.json
            ├── westernFunding.json
            └── uac.json

tests/
├── fixtures/
│   └── deals_10.json  # Test deal suite
├── payment.test.ts    # PMT tests
├── ltv.test.ts        # LTV tests
└── engine_accuracy.test.ts  # E2E tests

scripts/
├── run_accuracy.ts    # CLI test runner
└── extract_lender_matrix.ts  # Groq extractor
```

## Accuracy Goals

- Payment calculations: ±$0.01 vs Excel
- LTV calculations: ±0.1% using book value
- All 10 test deals pass without error
- Deterministic: Same inputs → same outputs 100%
- Scalable to 50+ deal test suite

## Future Enhancements

1. **Phase 2 Book Values**: Integration with Black Book / Finance Source APIs
2. **V2 Scoring**: Weighted scoring including approval probability
3. **Extended Test Suite**: Grow from 10 to 50+ deals
4. **Audit Logging**: Complete calculation audit trail
