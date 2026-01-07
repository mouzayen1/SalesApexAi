# Rehash Optimizer: Config-Driven Rules Engine Architecture

## Executive Summary

This document outlines a comprehensive, production-ready architecture for the Rehash Optimizer module. The design follows domain-driven principles with a config-driven rules engine that evaluates candidate deal structures against lender constraints and scores them by net check and approval likelihood.

## Key Design Principles

1. **Config-Driven**: Lender rules stored as editable JSON config
2. **Deterministic**: Rules engine with explainable logic
3. **Testable**: Pure functions, single responsibility
4. **Extensible**: Easy to add new lenders, rules, scoring criteria
5. **SaaS-Ready**: Externalized config for multi-tenant use

## Folder Structure

```
client/src/lib/
├── domain/
│   ├── deal/
│   │   ├── dealTypes.ts          # Core deal data models
│   │   ├── paymentMath.ts        # Payment calculations
│   │   └── dealGenerators.ts     # Generate candidate deals
│   ├── lenders/
│   │   ├── lenderTypes.ts        # Lender config schema
│   │   ├── lenderConfigs.ts      # Default lender rules
│   │   ├── lenderRules.ts        # Constraint evaluation
│   │   └── lenderScoring.ts      # Net check & approval scoring
│   └── rehash/
│       ├── rehashEngine.ts       # Optimization orchestrator
│       └── rehashExplainer.ts    # Human-readable explanations
└── components/
    ├── RehashForm.tsx             # Deal input form
    ├── RehashResults.tsx          # Results table/cards
    └── LenderConfigEditor.tsx     # Admin UI for lender rules
```

## Data Models

### Deal Types (`domain/deal/dealTypes.ts`)

```typescript
export type CreditTier = 'deep_subprime' | 'subprime' | 'near_prime' | 'prime';

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  bodyStyle: string;
  salePrice: number;
  dealerCost: number;
}

export interface BackendProducts {
  gap: boolean;
  vsc: boolean;
  otherProductsTotal: number;
}

export interface DealInputs {
  vehicle: Vehicle;
  customerCashDown: number;
  tradeAllowance: number;
  tradePayoff: number;
  taxesAndFees: number;
  backend: BackendProducts;
  desiredPayment: number;
  creditTier: CreditTier;
  state: string;
}

export interface DealStructure {
  lenderId: string;
  apr: number;
  termMonths: number;
  amountFinanced: number;
  salePrice: number;
  totalBackend: number;
  customerCashDown: number;
  tradeAllowance: number;
  tradePayoff: number;
}

export interface DealResult {
  structure: DealStructure;
  monthlyPayment: number;
  bankAdvance: number;
  netCheck: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  approvalScore: number;
  isWithinGuidelines: boolean;
  reasons: string[];
  tweaks: string[];
}
```

### Lender Types (`domain/lenders/lenderTypes.ts`)

```typescript
export interface LenderTierApr {
  creditTier: CreditTier;
  minApr: number;
  maxApr: number;
}

export interface LenderConstraints {
  minTerm: number;
  maxTerm: number;
  allowedTerms: number[];
  maxMiles: number;
  maxVehicleAgeYears: number;
  maxLtvPercent: number;
  maxBackendPercentOfAmount: number;
  minAmountFinanced: number;
  maxAmountFinanced: number;
}

export interface LenderAdvancePolicy {
  baseAdvancePercent: number;
  maxAdvancePercent: number;
  backendAddOnPercent: number;
}

export interface LenderConfig {
  id: string;
  displayName: string;
  programType: 'subprime' | 'near_prime' | 'prime_mixed';
  tierAprTable: LenderTierApr[];
  constraints: LenderConstraints;
  advancePolicy: LenderAdvancePolicy;
  notes?: string;
}
```

## Implementation Files

### 1. Payment Math (`domain/deal/paymentMath.ts`)

```typescript
export function calcMonthlyPayment(
  principal: number,
  apr: number,
  termMonths: number
): number {
  const r = apr / 12 / 100;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}
```

### 2. Lender Configs (`domain/lenders/lenderConfigs.ts`)

See full implementation in task description with WESTLAKE, WESTERN_FUNDING, and UNITED_AUTO_CREDIT configs.

### 3. Lender Rules (`domain/lenders/lenderRules.ts`)

```typescript
export function pickAprForTier(
  lender: LenderConfig,
  creditTier: CreditTier
): number {
  const row = lender.tierAprTable.find(r => r.creditTier === creditTier);
  if (!row) return lender.tierAprTable[0].maxApr;
  return (row.minApr + row.maxApr) / 2;
}

export function isVehicleEligible(
  lender: LenderConfig,
  deal: DealInputs,
  today: Date = new Date()
): boolean {
  const age = today.getFullYear() - deal.vehicle.year;
  if (age > lender.constraints.maxVehicleAgeYears) return false;
  if (deal.vehicle.mileage > lender.constraints.maxMiles) return false;
  return true;
}

export function isStructureWithinConstraints(
  lender: LenderConfig,
  deal: DealInputs,
  structure: DealStructure
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const { constraints } = lender;

  if (!constraints.allowedTerms.includes(structure.termMonths)) {
    reasons.push(`Term ${structure.termMonths} not allowed`);
  }
  if (structure.amountFinanced < constraints.minAmountFinanced) {
    reasons.push('Amount financed below minimum');
  }
  if (structure.amountFinanced > constraints.maxAmountFinanced) {
    reasons.push('Amount financed above maximum');
  }

  const vehicleValue = deal.vehicle.salePrice;
  const ltv = (structure.amountFinanced / vehicleValue) * 100;
  if (ltv > constraints.maxLtvPercent) {
    reasons.push(`LTV ${ltv.toFixed(1)}% exceeds max`);
  }

  const backendPct = (structure.totalBackend / structure.amountFinanced) * 100;
  if (backendPct > constraints.maxBackendPercentOfAmount) {
    reasons.push(`Backend ${backendPct.toFixed(1)}% exceeds max`);
  }

  return { ok: reasons.length === 0, reasons };
}
```

### 4. Rehash Engine (`domain/rehash/rehashEngine.ts`)

Complete search over candidate parameters:
- Terms: [48, 60, 72, 84]
- Down payment adjustments: base, +$500, +$1000
- Backend options: none, GAP only, GAP + VSC

Ranks results by net check and payment proximity.

## UI Components

### RehashForm
- Vehicle pre-fill from route state
- Credit tier dropdown
- Down payment, trade values
- Tax rate, fees
- Target monthly payment
- Backend product toggles

### RehashResults
- Best deal card (highlighted)
- Comparison table (lender, term, payment, net check)
- Explanation bullets
- "Within Guidelines" badges

### LenderConfigEditor (Admin)
- JSON editor with schema validation
- Save to localStorage or API
- Preview rule changes

## Integration Points

1. **Inventory → Rehash**
   ```typescript
   navigate('/rehash-optimizer', { state: { car } })
   ```

2. **Rehash Page**
   ```typescript
   const location = useLocation();
   const car = location.state?.car;
   // Pre-fill form with car.price, car.year, etc.
   ```

3. **Query Params (Better)**
   ```
   /rehash-optimizer?carId=17
   ```
   Fetch car by ID, enables shareable links.

## Next Steps

1. ✅ Create domain/deal/dealTypes.ts
2. ✅ Create domain/deal/paymentMath.ts
3. ✅ Create domain/lenders/lenderTypes.ts
4. ✅ Create domain/lenders/lenderConfigs.ts
5. ✅ Create domain/lenders/lenderRules.ts
6. ✅ Create domain/lenders/lenderScoring.ts
7. ✅ Create domain/rehash/rehashEngine.ts
8. ✅ Create domain/rehash/rehashExplainer.ts
9. ⬜ Create components/RehashForm.tsx
10. ⬜ Create components/RehashResults.tsx
11. ⬜ Wire up route and navigation
12. ⬜ Test end-to-end with sample deals

## Benefits

- **Demo-Ready**: Works without AI/API costs
- **Explainable**: Every recommendation has reasoning
- **Configurable**: Lender rules editable via UI
- **Scalable**: Add new lenders by config
- **SaaS-Ready**: Externalized config for multi-tenant

---

**Status**: Architecture defined. Ready for implementation.
**Estimated Effort**: 10-15 files, ~2000 LOC
**Testing Strategy**: Unit test pure functions, integration test full flow
