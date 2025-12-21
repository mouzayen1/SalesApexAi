export type NormalizedFilters = {
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxMiles?: number;

  make?: string[];        // always arrays
  model?: string[];
  bodyStyle?: string[];
  drivetrain?: string[];
  transmission?: string[];
  fuel?: string[];
  color?: string[];

  features?: string[];    // always arrays
  seats?: number;         // optional numeric
};

function toStringArray(v: unknown): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) {
    const out = v
      .filter(Boolean)
      .map(x => String(x).trim())
      .filter(Boolean);
    return out.length ? out : undefined;
  }
  const s = String(v).trim();
  return s ? [s] : undefined;
}

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeFilters(raw: any): NormalizedFilters {
  const f = raw ?? {};

  return {
    minPrice: toNumber(f.minPrice),
    maxPrice: toNumber(f.maxPrice),
    minYear: toNumber(f.minYear),
    maxYear: toNumber(f.maxYear),
    maxMiles: toNumber(f.maxMiles),

    make: toStringArray(f.make),
    model: toStringArray(f.model),
    bodyStyle: toStringArray(f.bodyStyle),
    drivetrain: toStringArray(f.drivetrain),
    transmission: toStringArray(f.transmission),
    fuel: toStringArray(f.fuel),
    color: toStringArray(f.color),

    features: toStringArray(f.features),

    seats: toNumber(f.seats),
  };
}
