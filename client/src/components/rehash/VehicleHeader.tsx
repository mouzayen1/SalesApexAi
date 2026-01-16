// client/src/components/rehash/VehicleHeader.tsx
// Header component displaying selected vehicle info and badges

import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Car as CarType } from "@shared/schema";
import type { VehicleBadge } from "../../../../shared/deal-insights";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMileage(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

interface VehicleHeaderProps {
  vehicle?: CarType | null;
  badges?: VehicleBadge[];
}

export function VehicleHeader({ vehicle, badges = [] }: VehicleHeaderProps) {
  if (!vehicle) {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deal Optimizer</h1>
        <p className="text-muted-foreground">
          Find the best lender structure to maximize dealer profit
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Badge variant="outline">Selected Vehicle</Badge>
      </div>
      <h1 className="text-2xl font-bold">
        {vehicle.year} {vehicle.make} {vehicle.model}
        {vehicle.trim && (
          <span className="text-muted-foreground font-normal"> {vehicle.trim}</span>
        )}
      </h1>
      <p className="text-muted-foreground">
        {formatCurrency(vehicle.price)} • {formatMileage(vehicle.mileage)} miles •{" "}
        {vehicle.color}
      </p>

      {/* Vehicle Badges/Warnings */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {badges.map((badge, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className={cn(
                "text-xs font-medium",
                badge.type === "danger" &&
                  "border-red-500 text-red-600 bg-red-50",
                badge.type === "warning" &&
                  "border-amber-500 text-amber-600 bg-amber-50",
                badge.type === "info" &&
                  "border-blue-500 text-blue-600 bg-blue-50"
              )}
              title={badge.detail}
            >
              {badge.type === "danger" && <ShieldAlert className="h-3 w-3 mr-1" />}
              {badge.type === "warning" && <AlertCircle className="h-3 w-3 mr-1" />}
              {badge.type === "info" && <Info className="h-3 w-3 mr-1" />}
              {badge.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default VehicleHeader;
