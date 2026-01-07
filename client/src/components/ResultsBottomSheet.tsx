import React, { useEffect, useState, useMemo } from "react";
import { Link } from 'react-router-dom';
import type { Car } from "@shared/schema";
import type { Filters } from "../lib/extractFilters";
import type { FilterResult } from "../lib/filterInventory";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type SortMode = "best" | "price_asc" | "miles_asc" | "year_desc";

export default function ResultsBottomSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  results: FilterResult | null;
    budgetMatches?: Record<string, {payment: number; termMonths: number}>;
  budgetSummary?: string;
    carPayments?: Record<string, number>;
  paymentTermMonths?: number;
  paymentApr?: number;
  paymentDown?: number;
}) {
  const { open, onOpenChange, title, subtitle, results, budgetMatches = {}, budgetSummary = "", carPayments = {}, paymentTermMonths, paymentApr, paymentDown } = props;
  // Safe defaults
  const safeMatches = Array.isArray(results?.results) ? results.results : [];
  const safeFilters = (results?.filters ?? {}) as Filters;
  const safeTitle = title ?? "Results";
  const safeSubtitle = subtitle ?? "";

  useLockBodyScroll(open);

  const [sortMode, setSortMode] = useState<SortMode>("best");

  const sortedMatches = useMemo(() => {
    const arr = [...safeMatches];
    if (sortMode === "price_asc") arr.sort((a, b) => a.price - b.price);
    else if (sortMode === "miles_asc") arr.sort((a, b) => a.mileage - b.mileage);
    else if (sortMode === "year_desc") arr.sort((a, b) => b.year - a.year);
    return arr;
  }, [safeMatches, sortMode]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">{safeTitle}</h2>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{safeSubtitle}</p>
          <div className="flex gap-2 mt-3">
            <Button
              variant={sortMode === "best" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortMode("best")}
            >
              Best Match
            </Button>
            <Button
              variant={sortMode === "price_asc" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortMode("price_asc")}
            >
              Price ↑
            </Button>
            <Button
              variant={sortMode === "miles_asc" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortMode("miles_asc")}
            >
              Miles ↑
            </Button>
            <Button
              variant={sortMode === "year_desc" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortMode("year_desc")}
            >
              Year ↓
            </Button>
          </div>
        </div>
                {budgetSummary && (
          <div className="px-4 py-3 bg-blue-500/10 border-l-4 border-blue-500 text-sm">
            <p className="text-blue-100">{budgetSummary}</p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMatches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No vehicles match your criteria</p>
          ) : (
            sortedMatches.map((car) => (
  <Link to={`/vehicles/${car.id}`} className="block">
              <Card key={car.id} className="p-4">
                    {budgetMatches?.[car.id] && (
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1 text-sm border border-green-500/30">
                    <span className="font-semibold text-green-100">
                      ${Math.round(budgetMatches[car.id].payment)}/mo
                    </span>
                    <span className="text-green-200/60">@ {budgetMatches[car.id].termMonths} mo</span>
                  </div>
                )}
                    {carPayments[car.id] != null && paymentTermMonths && paymentApr != null && paymentDown != null && (
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm border border-white/20">
                    <span className="font-semibold text-white">
                      ${Math.round(carPayments[car.id])}/mo
                    </span>
                    <span className="text-white/60">
                      @ {paymentTermMonths} mo • {paymentApr}% • ${paymentDown.toLocaleString()} down
                    </span>
                  </div>
                )}
    {/* IMAGE */}
    <div className="w-full h-44 mb-3 overflow-hidden rounded-lg bg-muted">
      <img
        src={car.imageUrl || car.image_url || ""}
        alt={`${car.year} ${car.make} ${car.model}`}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          // fallback placeholder if URL breaks
          (e.currentTarget as HTMLImageElement).src =
            "https://placehold.co/800x450?text=No+Image";
        }}
      />
    </div>

    {/* TITLE */}
    <h3 className="font-semibold">
      {car.year} {car.make} {car.model}
    </h3>

    {/* PRICE + MILES */}
    <p className="text-sm text-muted-foreground mb-2">
      ${car.price.toLocaleString()} • {car.mileage.toLocaleString()} mi
    </p>

    {/* TAGS */}
    <div className="flex flex-wrap gap-2">
      {car.drivetrain && (
        <span className="text-xs bg-muted px-2 py-1 rounded">
          {String(car.drivetrain).toUpperCase()}
        </span>
      )}

      {/* Support BOTH naming styles */}
      {(car.fuelType || car.fuel_type) && (
        <span className="text-xs bg-muted px-2 py-1 rounded">
          {car.fuelType || car.fuel_type}
        </span>
      )}
    </div>
  </Card>
                </Link>
))

          )}
        </div>
      </div>
    </>
  );
}
