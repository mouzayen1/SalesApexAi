// shared/rehash.ts
import type { DealInput, DealCandidate, BackendProducts } from './deals';
import { LENDERS, LenderConfig } from './lenders';

// Constants for backend product costs
const GAP_COST = 895;
const VSC_COST = 1800;
const MILEAGE_THRESHOLD = 50000;
const VEHICLE_AGE_THRESHOLD = 4;
const PAYMENT_OVERAGE_THRESHOLD = 50;

export interface SmartProductDecision {
  gap: boolean;
  vsc: boolean;
  gapReason: string | null;
  vscReason: string | null;
}

export interface OptimizationMetadata {
  smartProducts: SmartProductDecision;
  budgetSaverApplied: boolean;
  productsRemoved: string[];
  optimizationNotes: string[];
  attemptNumber: number; // 1 = full smart, 2 = removed VSC, 3 = removed GAP
}

export interface RehashResult {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
  optimization: OptimizationMetadata;
}

export function calculateMonthlyPayment(
  amountFinanced: number,
  apr: number,
  termMonths: number
): number {
  const r = apr / 100 / 12;
  if (r === 0) return amountFinanced / termMonths;
  const num = r * amountFinanced;
  const den = 1 - Math.pow(1 + r, -termMonths);
  return num / den;
}

function pickApr(lender: LenderConfig, creditTier: DealInput['customerCreditTier']): number | null {
  const row = lender.pricingGrid.find(p => p.creditTier === creditTier);
  if (!row) return null;
  return (row.minApr + row.maxApr) / 2;
}

function computeAmountFinanced(deal: DealInput, backendTotal: number): number {
  const taxableBase = deal.vehiclePrice;
  const tax = taxableBase * deal.taxRate;
  const gross = taxableBase + tax + deal.fees + backendTotal;
  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  return Math.max(gross - totalDown, 0);
}

function getVehicleBookValue(deal: DealInput): number {
  return deal.vehicleBookValue ?? deal.vehicleCost * 1.20;
}

function getVehicleAge(deal: DealInput): number {
  return new Date().getFullYear() - deal.vehicleYear;
}

/**
 * Determines smart backend products based on risk factors.
 * - Auto-Add GAP: If LTV > 100% (Amount Financed > Book Value)
 * - Auto-Add VSC: If Mileage > 50,000 OR Vehicle Age > 4 years
 */
export function determineSmartProducts(deal: DealInput): SmartProductDecision {
  const bookValue = getVehicleBookValue(deal);
  const vehicleAge = getVehicleAge(deal);

  // Calculate estimated amount financed without backend to check LTV
  const baseAmountFinanced = computeAmountFinanced(deal, 0);
  const estimatedLtv = bookValue > 0 ? (baseAmountFinanced / bookValue) * 100 : 999;

  // GAP decision: LTV > 100% means customer is upside down
  const shouldAddGap = estimatedLtv > 100;
  const gapReason = shouldAddGap
    ? `LTV ${estimatedLtv.toFixed(0)}% > 100% - customer is upside down, GAP essential`
    : null;

  // VSC decision: High mileage or older vehicle
  const highMileage = deal.vehicleMileage > MILEAGE_THRESHOLD;
  const olderVehicle = vehicleAge > VEHICLE_AGE_THRESHOLD;
  const shouldAddVsc = highMileage || olderVehicle;

  let vscReason: string | null = null;
  if (shouldAddVsc) {
    if (highMileage && olderVehicle) {
      vscReason = `High mileage (${deal.vehicleMileage.toLocaleString()} mi) and older vehicle (${vehicleAge} years) - factory warranty expired`;
    } else if (highMileage) {
      vscReason = `High mileage (${deal.vehicleMileage.toLocaleString()} mi) - extended coverage recommended`;
    } else {
      vscReason = `Vehicle age (${vehicleAge} years) exceeds ${VEHICLE_AGE_THRESHOLD} years - factory warranty expired`;
    }
  }

  return {
    gap: shouldAddGap,
    vsc: shouldAddVsc,
    gapReason,
    vscReason,
  };
}

function estimateNetCheckAndProfit(
  deal: DealInput,
  lender: LenderConfig,
  tierRow: { baseAdvancePercent: number; maxAdvancePercent: number; maxLtvPercent: number },
  amountFinanced: number,
  backendTotal: number
): {
  netCheckToDealer: number;
  dealerFrontGross: number;
  dealerBackEndGross: number;
  dealerProfit: number;
  totalDown: number;
  ltv: number;
} {
  const vehicleValue = deal.vehiclePrice;
  const ltv = vehicleValue > 0 ? (amountFinanced / vehicleValue) * 100 : 999;

  const baseAdvance = (tierRow.baseAdvancePercent / 100) * deal.vehicleCost;
  const maxAdvanceByCost = (tierRow.maxAdvancePercent / 100) * deal.vehicleCost;
  const maxAdvanceByLtv = (tierRow.maxLtvPercent / 100) * vehicleValue;

  const grossAdvance = Math.min(amountFinanced, maxAdvanceByCost, maxAdvanceByLtv);

  const lenderFee = (lender.lenderFeePercent / 100) * amountFinanced;
  const netCheck = Math.max(grossAdvance - lenderFee - deal.tradePayoff, 0);

  const totalDown = deal.downPayment + deal.tradeAllowance - deal.tradePayoff;
  const frontGross = deal.vehiclePrice - deal.vehicleCost;
  const backGross = backendTotal;

  const dealerProfit = netCheck + totalDown - deal.vehicleCost - deal.fees;

  return {
    netCheckToDealer: netCheck,
    dealerFrontGross: frontGross,
    dealerBackEndGross: backGross,
    dealerProfit,
    totalDown,
    ltv,
  };
}

interface BackendProfile {
  gap: boolean;
  vsc: boolean;
  total: number;
}

function calculateBackendTotal(
  profile: BackendProfile,
  otherProductsTotal: number,
  maxBackendTotal: number
): number {
  const gapValue = profile.gap ? GAP_COST : 0;
  const vscValue = profile.vsc ? VSC_COST : 0;
  return Math.min(gapValue + vscValue + otherProductsTotal, maxBackendTotal);
}

/**
 * Core rehash logic that runs with a specific backend profile.
 * Returns candidates and the best deal for that profile.
 */
function runRehashWithProfile(
  deal: DealInput,
  backendProfile: BackendProfile,
  lenders: LenderConfig[]
): { bestDeal: DealCandidate | null; allCandidates: DealCandidate[] } {
  const candidates: DealCandidate[] = [];
  const activeLenders = lenders.filter(l => l.active);

  activeLenders.forEach(lender => {
    const vehicleAge = getVehicleAge(deal);
    if (vehicleAge > lender.maxVehicleAgeYears) return;
    if (deal.vehicleMileage > lender.maxMiles) return;

    const tierRow = lender.pricingGrid.find(p => p.creditTier === deal.customerCreditTier);
    if (!tierRow) return;

    const apr = pickApr(lender, deal.customerCreditTier);
    if (apr == null) return;

    const terms = lender.allowedTerms;

    // Calculate backend scenarios based on the profile
    const backendScenarios = [
      { label: 'No backend', value: 0 },
      {
        label: 'Smart Backend',
        value: calculateBackendTotal(
          backendProfile,
          deal.backendProducts.otherProductsTotal,
          lender.maxBackendTotal
        ),
      },
    ];

    const downOptions = [deal.downPayment, deal.downPayment + 500, deal.downPayment + 1000];

    terms.forEach(term => {
      downOptions.forEach(down => {
        backendScenarios.forEach(scenario => {
          const modifiedDeal: DealInput = { ...deal, downPayment: down };
          const amountFinanced = computeAmountFinanced(modifiedDeal, scenario.value);

          if (
            amountFinanced < lender.minAmountFinanced ||
            amountFinanced > lender.maxAmountFinanced
          )
            return;

          const backendPct = amountFinanced > 0 ? (scenario.value / amountFinanced) * 100 : 999;
          if (backendPct > lender.maxBackendPercentOfAmount) return;

          const check = lender.validateDeal(modifiedDeal, amountFinanced);
          if (!check.isValid) return;

          const ltv =
            deal.vehiclePrice > 0 ? (amountFinanced / deal.vehiclePrice) * 100 : 999;
          if (ltv > tierRow.maxLtvPercent) return;

          const payment = calculateMonthlyPayment(amountFinanced, apr, term);

          const {
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            ltv: finalLtv,
          } = estimateNetCheckAndProfit(
            modifiedDeal,
            lender,
            tierRow,
            amountFinanced,
            scenario.value
          );

          const adjustments: string[] = [];
          adjustments.push(`${lender.name}: ${term} months @ ${apr.toFixed(2)}% APR`);
          if (down !== deal.downPayment) {
            adjustments.push(
              `Increased down from $${deal.downPayment.toFixed(0)} to $${down.toFixed(0)}`
            );
          }
          if (scenario.value === 0) {
            adjustments.push('No backend products to maximize net check');
          } else {
            const products: string[] = [];
            if (backendProfile.gap) products.push('GAP');
            if (backendProfile.vsc) products.push('VSC');
            if (deal.backendProducts.otherProductsTotal > 0) products.push('Other');
            adjustments.push(
              `Included backend products (${products.join(' + ')}): $${scenario.value.toFixed(0)}`
            );
          }

          const candidate: DealCandidate = {
            lenderId: lender.id,
            lenderName: lender.name,
            termMonths: term,
            apr,
            amountFinanced,
            payment,
            netCheckToDealer,
            dealerFrontGross,
            dealerBackEndGross,
            dealerProfit,
            totalDown,
            backendTotal: scenario.value,
            ltv: finalLtv,
            withinGuidelines: true,
            reasons: check.reasons,
            adjustments,
          };

          candidates.push(candidate);
        });
      });
    });
  });

  const targetLow = deal.targetPayment - deal.paymentTolerance;
  const targetHigh = deal.targetPayment + deal.paymentTolerance;
  const withinPayment = candidates.filter(c => c.payment >= targetLow && c.payment <= targetHigh);

  const pool = withinPayment.length > 0 ? withinPayment : candidates;

  const sorted = pool.sort((a, b) => {
    if (b.netCheckToDealer !== a.netCheckToDealer) {
      return b.netCheckToDealer - a.netCheckToDealer;
    }
    const aGap = Math.abs(a.payment - deal.targetPayment);
    const bGap = Math.abs(b.payment - deal.targetPayment);
    return aGap - bGap;
  });

  const bestDeal = sorted.length > 0 ? sorted[0] : null;
  return { bestDeal, allCandidates: sorted };
}

/**
 * Check if the result meets budget requirements.
 * Returns true if deal is acceptable, false if budget saver should be tried.
 */
function meetsbudgetRequirements(
  result: { bestDeal: DealCandidate | null },
  deal: DealInput
): boolean {
  if (!result.bestDeal) return false;

  const maxAcceptablePayment = deal.targetPayment + deal.paymentTolerance + PAYMENT_OVERAGE_THRESHOLD;
  return result.bestDeal.payment <= maxAcceptablePayment;
}

/**
 * Main rehash function with smart logic and budget saver loop.
 *
 * Flow:
 * 1. Determine smart products based on risk factors
 * 2. Run rehash with full smart backend
 * 3. If payment too high or declined, remove VSC and retry
 * 4. If still failing, remove GAP and retry
 * 5. Return best fitting version
 */
export function runRehash(deal: DealInput, lenders: LenderConfig[] = LENDERS): RehashResult {
  // Step 1: Determine smart products
  const smartProducts = determineSmartProducts(deal);

  const optimizationNotes: string[] = [];
  const productsRemoved: string[] = [];

  // Build initial smart backend profile
  const initialProfile: BackendProfile = {
    gap: smartProducts.gap,
    vsc: smartProducts.vsc,
    total: (smartProducts.gap ? GAP_COST : 0) + (smartProducts.vsc ? VSC_COST : 0),
  };

  // Add optimization notes for auto-added products
  if (smartProducts.gap && smartProducts.gapReason) {
    optimizationNotes.push(`Auto-added GAP: ${smartProducts.gapReason}`);
  }
  if (smartProducts.vsc && smartProducts.vscReason) {
    optimizationNotes.push(`Auto-added VSC: ${smartProducts.vscReason}`);
  }
  if (!smartProducts.gap && !smartProducts.vsc) {
    optimizationNotes.push('No backend products auto-added: vehicle meets standard risk criteria');
  }

  // Step 2: Run with full smart backend
  let result = runRehashWithProfile(deal, initialProfile, lenders);
  let attemptNumber = 1;
  let finalProfile = initialProfile;

  // Step 3: Budget Saver Loop
  // If payment is >$50 over target OR no valid deals, try removing products

  if (!meetsbudgetRequirements(result, deal) && initialProfile.vsc) {
    // Retry 1: Remove VSC (save ~$1,800)
    const profileWithoutVsc: BackendProfile = {
      gap: initialProfile.gap,
      vsc: false,
      total: initialProfile.gap ? GAP_COST : 0,
    };

    const resultWithoutVsc = runRehashWithProfile(deal, profileWithoutVsc, lenders);

    if (meetsbudgetRequirements(resultWithoutVsc, deal) ||
        (!result.bestDeal && resultWithoutVsc.bestDeal)) {
      result = resultWithoutVsc;
      finalProfile = profileWithoutVsc;
      attemptNumber = 2;
      productsRemoved.push('VSC');
      optimizationNotes.push('Budget Saver: Removed VSC to fit payment target (saved ~$1,800)');
    }
  }

  if (!meetsbudgetRequirements(result, deal) && finalProfile.gap) {
    // Retry 2: Remove GAP as well (save ~$895)
    const profileNoBackend: BackendProfile = {
      gap: false,
      vsc: false,
      total: 0,
    };

    const resultNoBackend = runRehashWithProfile(deal, profileNoBackend, lenders);

    if (meetsbudgetRequirements(resultNoBackend, deal) ||
        (!result.bestDeal && resultNoBackend.bestDeal)) {
      result = resultNoBackend;
      finalProfile = profileNoBackend;
      attemptNumber = 3;
      if (!productsRemoved.includes('VSC') && initialProfile.vsc) {
        productsRemoved.push('VSC');
      }
      productsRemoved.push('GAP');
      optimizationNotes.push('Budget Saver: Removed GAP to fit payment target (saved ~$895)');
    }
  }

  // Update smart products to reflect final state after budget saver
  const finalSmartProducts: SmartProductDecision = {
    gap: finalProfile.gap,
    vsc: finalProfile.vsc,
    gapReason: finalProfile.gap ? smartProducts.gapReason : null,
    vscReason: finalProfile.vsc ? smartProducts.vscReason : null,
  };

  return {
    bestDeal: result.bestDeal,
    allCandidates: result.allCandidates,
    optimization: {
      smartProducts: finalSmartProducts,
      budgetSaverApplied: attemptNumber > 1,
      productsRemoved,
      optimizationNotes,
      attemptNumber,
    },
  };
}
