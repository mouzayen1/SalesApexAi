import { Link } from "react-router-dom";
import { Car as CarIcon, Fuel, Gauge, Settings2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Car } from "@shared/schema";
import { cn } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Car;
  estimatedPayment?: number;
  paymentTerm?: number;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatMileage(mileage: number): string {
  return new Intl.NumberFormat("en-US").format(mileage);
}

export function VehicleCard({ vehicle, estimatedPayment, paymentTerm }: VehicleCardProps) {
  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      className="group block"
    >
      <div className="bg-card border border-card-border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30">
        {/* Image */}
        <div className="relative aspect-[16/10] bg-muted overflow-hidden">
          {vehicle.imageUrl ? (
            <img
              src={vehicle.imageUrl}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <CarIcon className="w-16 h-16 text-muted-foreground/50" />
            </div>
          )}

          {/* Payment Badge */}
          {estimatedPayment && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-primary text-primary-foreground font-semibold">
                ~${Math.round(estimatedPayment)}/mo
              </Badge>
            </div>
          )}

          {/* Availability Badge */}
          <div className="absolute top-2 right-2">
            <Badge variant={vehicle.isAvailable ? "secondary" : "destructive"}>
              {vehicle.isAvailable ? "Available" : "Sold"}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title & Price */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              {vehicle.trim && (
                <p className="text-sm text-muted-foreground truncate">{vehicle.trim}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-primary">
                {formatPrice(vehicle.price)}
              </p>
            </div>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              <span>{formatMileage(vehicle.mileage)} mi</span>
            </div>
            <div className="flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5" />
              <span>{vehicle.fuelType}</span>
            </div>
            <div className="flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" />
              <span>{vehicle.transmission}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{vehicle.drivetrain}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {vehicle.body_style && (
              <Badge variant="outline" className="text-xs">
                {vehicle.body_style}
              </Badge>
            )}
            {vehicle.color && (
              <Badge variant="outline" className="text-xs">
                {vehicle.color}
              </Badge>
            )}
            {vehicle.mpgCity && vehicle.mpgHighway && (
              <Badge variant="outline" className="text-xs">
                {vehicle.mpgCity}/{vehicle.mpgHighway} MPG
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Skeleton loading state
export function VehicleCardSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-muted" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="h-5 bg-muted rounded w-3/4 mb-1" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
          <div className="h-6 bg-muted rounded w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 bg-muted rounded w-16" />
          <div className="h-5 bg-muted rounded w-12" />
        </div>
      </div>
    </div>
  );
}
