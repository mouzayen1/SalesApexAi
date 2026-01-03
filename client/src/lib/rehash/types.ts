export type CreditTier = "prime" | "near_prime" | "subprime" | "deep_subprime";

export type DealInputs = {
  // Vehicle
  vehicleYear: number;
  vehicleMileage: number;
  vehiclePrice: number;
  vehicleLabel?: string;

  // Customer / deal structure
  downPayment: number;
  tradeValue: number;  // set 0 if none
  tradePayoff: number; // set 0 if none
  taxRate: number;     // e.g. 0.09
  fees: number;        // doc/title/etc

  // Optional product placeholders (demo)
  includeGAP: boolean;
  gapPrice: number;
  includeVSC: boolean;
  vscPrice: number;

  // Budget target (optional)
  targetMonthly?: number;     // e.g. 400
  monthlyTolerance?: number;  // e.g. 25

  // Credit assumptions
  creditTier: CreditTier;
  aprOverride?: number; // if provided, ignore lender tier APR
};

export type LenderRulePack = {
  id: string;
  name: string;
  updatedAt: string;

  // APR defaults by tier (editable later)
  aprByTier: Record<CreditTier, number>;

  // Terms the optimizer will try (shortest-first)
  termOptions: number[];

  // Demo constraints (editable later)
  // max term depends on age/miles bands
  maxTermRules: Array<{
    maxVehicleAgeYears?: number; // e.g. 8
    maxMileage?: number;         // e.g. 120000
    maxTerm: number;             // e.g. 72
  }>;

  // Optional "proxy" LTV guardrails (demo; can be replaced later by real advance rules)
  // Uses (amountFinanced / vehiclePrice) as a proxy if no book values exist.
  maxProxyLtvByTier?: Partial<Record<CreditTier, number>>; // e.g. subprime: 1.35

  // Optional backend caps (demo placeholders)
  backendCaps?: {
    gapMax?: number;
    vscMax?: number;
    totalMax?: number;
  };

  notes?: string[];
  disclaimer?: string;
};

export type PaymentBreakdown = {
  amountFinanced: number;
  monthlyPayment: number;
  totalTax: number;
  totalPaid: number;
  totalInterest: number;
};

export type Scenario = {
  lenderId: string;
  lenderName: string;
  termMonths: number;
  apr: number;
  includeGAP: boolean;
  includeVSC: boolean;
  downPayment: number;
};

export type ScenarioResult = {
  lenderId: string;
  lenderName: string;
  termMonths: number;
  apr: number;
  payment: PaymentBreakdown;

  // rule evaluation
  isValid: boolean;
  reasons: string[];     // why invalid OR notable flags
  score: number;         // for ranking
};
