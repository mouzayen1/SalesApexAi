// client/src/components/rehash/RehashResults.tsx
// Modular results display component for rehash optimizer

import { useState } from "react";
import {
  Calculator,
  XCircle,
  Award,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DealCandidate } from "../../../../shared/deals";
import type { AiInsight, SmartDecision } from "../../../../shared/deal-insights";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

interface DealCardProps {
  deal: DealCandidate;
  isBest?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  smartDecision?: SmartDecision;
}

function DealCard({ deal, isBest, isSelected, onSelect, smartDecision }: DealCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all",
        isBest && "border-green-500 bg-green-500/5",
        isSelected && !isBest && "border-primary bg-primary/5",
        !isBest && !isSelected && "hover:border-muted-foreground/30"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isBest && <Award className="h-5 w-5 text-green-500" />}
            <span className="font-semibold">{deal.lenderName}</span>
          </div>
          <div className="flex items-center gap-2">
            {isBest && (
              <Badge className="bg-green-500 text-white">Best Deal</Badge>
            )}
            {/* Product Chips for Best Deal */}
            {isBest && smartDecision && smartDecision.products.length > 0 && (
              <>
                {smartDecision.products.map((product, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-blue-50 border-blue-500 text-blue-700"
                    title={product.reason}
                  >
                    +{product.name}
                  </Badge>
                ))}
              </>
            )}
            {deal.withinGuidelines ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Declined
              </Badge>
            )}
          </div>
        </div>

        {/* Smart Decision Narrative for Best Deal */}
        {isBest && smartDecision && smartDecision.narrative && (
          <div className="mb-3 p-2 rounded bg-blue-50/50 border border-blue-100">
            <p className="text-xs">
              <span className="font-medium text-blue-700">Smart Decision:</span>{" "}
              <span className="text-muted-foreground">{smartDecision.narrative}</span>
            </p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Payment</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(deal.payment)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">APR</p>
            <p className="text-lg font-semibold">{deal.apr.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Term</p>
            <p className="text-lg font-semibold">{deal.termMonths} mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LTV</p>
            <p className="text-lg font-semibold">{deal.ltv.toFixed(0)}%</p>
          </div>
        </div>

        {/* Profit Metrics */}
        <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/50 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Net Check to Dealer</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(deal.netCheckToDealer)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Dealer Profit</p>
            <p className={cn(
              "text-xl font-bold",
              deal.dealerProfit >= 0 ? "text-primary" : "text-red-600"
            )}>
              {formatCurrency(deal.dealerProfit)}
            </p>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
        >
          {expanded ? (
            <>
              Hide Details <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show Details <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Financed</span>
              <span className="font-medium">{formatCurrency(deal.amountFinanced)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Down</span>
              <span className="font-medium">{formatCurrency(deal.totalDown)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend Total</span>
              <span className="font-medium">{formatCurrency(deal.backendTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Front Gross</span>
              <span className="font-medium">{formatCurrency(deal.dealerFrontGross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Back Gross</span>
              <span className="font-medium">{formatCurrency(deal.dealerBackEndGross)}</span>
            </div>
            {deal.adjustments && deal.adjustments.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-muted-foreground mb-1">Adjustments:</p>
                <ul className="text-xs space-y-1">
                  {deal.adjustments.map((adj, i) => (
                    <li key={i} className="text-muted-foreground">• {adj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface RehashResultsData {
  bestDeal: DealCandidate | null;
  allCandidates: DealCandidate[];
}

interface RehashResultsProps {
  results: RehashResultsData | null;
  isCalculating?: boolean;
  aiInsight?: AiInsight;
  smartDecision?: SmartDecision;
  selectedDeal?: DealCandidate | null;
  onSelectDeal?: (deal: DealCandidate) => void;
}

export function RehashResults({
  results,
  isCalculating = false,
  aiInsight,
  smartDecision,
  selectedDeal,
  onSelectDeal,
}: RehashResultsProps) {
  // No results yet
  if (!results && !isCalculating) {
    return (
      <Card className="p-8 text-center">
        <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Enter deal parameters and click "Find Best Lenders" to see results
        </p>
      </Card>
    );
  }

  // Loading state
  if (isCalculating) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
        <p className="text-muted-foreground">Calculating optimal structures...</p>
      </Card>
    );
  }

  // No matches found
  if (results && results.allCandidates.length === 0) {
    return (
      <Card className="p-8 text-center border-destructive bg-destructive/5">
        <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Valid Structures Found</h3>
        <p className="text-muted-foreground">
          Try adjusting down payment, credit tier, or vehicle parameters
        </p>
      </Card>
    );
  }

  // Results list
  return (
    <div className="space-y-4">
      {/* AI Insight Panel */}
      {aiInsight && (
        <Card className={cn(
          "p-4 border-l-4",
          aiInsight.status === 'realistic' && "border-l-green-500 bg-green-50/50",
          aiInsight.status === 'needs_adjustment' && "border-l-amber-500 bg-amber-50/50",
          aiInsight.status === 'challenging' && "border-l-red-500 bg-red-50/50"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-full",
              aiInsight.status === 'realistic' && "bg-green-100",
              aiInsight.status === 'needs_adjustment' && "bg-amber-100",
              aiInsight.status === 'challenging' && "bg-red-100"
            )}>
              <Lightbulb className={cn(
                "h-5 w-5",
                aiInsight.status === 'realistic' && "text-green-600",
                aiInsight.status === 'needs_adjustment' && "text-amber-600",
                aiInsight.status === 'challenging' && "text-red-600"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs font-medium">AI Insight</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-medium",
                    aiInsight.status === 'realistic' && "border-green-500 text-green-700",
                    aiInsight.status === 'needs_adjustment' && "border-amber-500 text-amber-700",
                    aiInsight.status === 'challenging' && "border-red-500 text-red-700"
                  )}
                >
                  {aiInsight.statusLabel}
                </Badge>
                {aiInsight.gap > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Gap: {formatCurrency(aiInsight.gap)}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {aiInsight.explanations.map((exp, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">{exp}</p>
                ))}
              </div>
              <p className="text-sm font-medium mt-2">
                <span className="text-muted-foreground">Strategy:</span> {aiInsight.strategy}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      {results && results.allCandidates.length > 0 && (
        <Card className="p-4 bg-muted/30">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Options Found</p>
              <p className="text-2xl font-bold">{results.allCandidates.length}</p>
            </div>
            {results.bestDeal && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Best Net Check</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(results.bestDeal.netCheckToDealer)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Best Payment</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(results.bestDeal.payment)}/mo
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Deal Cards */}
      {results && (
        <div className="space-y-3">
          {results.allCandidates.map((deal, index) => (
            <DealCard
              key={`${deal.lenderId}-${deal.termMonths}-${index}`}
              deal={deal}
              isBest={index === 0}
              isSelected={selectedDeal === deal}
              onSelect={() => onSelectDeal?.(deal)}
              smartDecision={index === 0 ? smartDecision : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RehashResults;
