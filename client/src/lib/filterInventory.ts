import type { Car } from '../../../shared/schema';
import type { NormalizedFilters } from './normalizeFilters';

export interface FilterResult {
  results: Car[];
  debug: {
    reasonsByCarId: Record<string, string[]>;
    totalCars: number;
    matchedCars: number;
    appliedFilters: string[];
  };
}

// Helper: normalize string for comparison
function norm(s: string): string {
  return s.trim().toLowerCase();
}

// Safe matching for string fields against array of allowed values
function matchesAny(value: unknown, allowed?: string[]): boolean {
  if (!allowed?.length) return true;
  if (!value) return false;
  const v = norm(String(value));
  return allowed.some(a => v.includes(norm(a)));
}

// Safe feature matching (ALL required features must be present)
function carHasAllFeatures(carFeatures: unknown, required?: string[]): boolean {
  if (!required?.length) return true;
  const list = Array.isArray(carFeatures) 
    ? carFeatures.map(x => norm(String(x))) 
    : [];
  return required.every(r => list.some(f => f.includes(norm(r))));
}

export function filterInventory(cars: Car[], filters: NormalizedFilters): FilterResult {
  const reasonsByCarId: Record<string, string[]> = {};
  const appliedFilters: string[] = [];

  // Track applied filters for debug
  if (filters.maxPrice) appliedFilters.push(`max price $${filters.maxPrice}`);
  if (filters.minPrice) appliedFilters.push(`min price $${filters.minPrice}`);
  if (filters.minYear) appliedFilters.push(`year >= ${filters.minYear}`);
  if (filters.maxYear) appliedFilters.push(`year <= ${filters.maxYear}`);
  if (filters.maxMiles) appliedFilters.push(`max miles ${filters.maxMiles}`);
  if (filters.bodyStyle?.length) appliedFilters.push(`body: ${filters.bodyStyle.join(', ')}`);
  if (filters.drivetrain?.length) appliedFilters.push(`drivetrain: ${filters.drivetrain.join(', ')}`);
  if (filters.fuel?.length) appliedFilters.push(`fuel: ${filters.fuel.join(', ')}`);
  if (filters.features?.length) appliedFilters.push(`features: ${filters.features.join(', ')}`);

  // Filter cars with crash-proof logic
  const filtered = cars.filter(car => {
    const reasons: string[] = [];

    // Price filters
    if (filters.maxPrice !== undefined && car.price > filters.maxPrice) {
      reasons.push('price out of range');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (filters.minPrice !== undefined && car.price < filters.minPrice) {
      reasons.push('price too low');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    // Year filters
    if (filters.minYear !== undefined && car.year < filters.minYear) {
      reasons.push('year too old');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (filters.maxYear !== undefined && car.year > filters.maxYear) {
      reasons.push('year too new');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    // Mileage filter
    if (filters.maxMiles !== undefined && car.mileage > filters.maxMiles) {
      reasons.push('mileage too high');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    // String field filters (safe array matching)
    if (!matchesAny(car.make, filters.make)) {
      reasons.push('make not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.model, filters.model)) {
      reasons.push('model not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.body_style, filters.bodyStyle)) {
      reasons.push('body style not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.drivetrain, filters.drivetrain)) {
      reasons.push('drivetrain not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.transmission, filters.transmission)) {
      reasons.push('transmission not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.fuelType, filters.fuel)) {
      reasons.push('fuel type not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    if (!matchesAny(car.color, filters.color)) {
      reasons.push('color not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    // Seats filter
    if (filters.seats !== undefined && Number(car.seats) < filters.seats) {
      reasons.push('not enough seats');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    // Features filter (ALL must match)
    if (!carHasAllFeatures(car.features, filters.features)) {
      reasons.push('missing required features');
      reasonsByCarId[car.id] = reasons;
      return false;
    }

    reasonsByCarId[car.id] = ['matched'];
    return true;
  });

  // Sort: best match by default (newest year, lowest mileage)
  const sorted = [...filtered].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    if (a.mileage !== b.mileage) return a.mileage - b.mileage;
    if (filters.maxPrice) {
      const aDiff = Math.abs(filters.maxPrice - a.price);
      const bDiff = Math.abs(filters.maxPrice - b.price);
      return aDiff - bDiff;
    }
    return 0;
  });

  return {
    results: sorted,
    debug: {
      reasonsByCarId,
      totalCars: cars.length,
      matchedCars: sorted.length,
      appliedFilters,
    },
  };
}
