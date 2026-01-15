import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterValues {
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  make?: string[];
  minYear?: number;
  maxYear?: number;
  maxMiles?: number;
  bodyStyle?: string[];
  drivetrain?: string[];
  fuel?: string[];
  transmission?: string[];
  color?: string[];
}

interface FiltersPanelProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  onClear: () => void;
  availableMakes?: string[];
}

const DEFAULT_MAKES = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler",
  "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jeep", "Kia",
  "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Nissan", "Ram", "Subaru",
  "Tesla", "Toyota", "Volkswagen", "Volvo"
];

const BODY_STYLES = ["Sedan", "SUV", "Truck", "Coupe", "Hatchback", "Van", "Wagon", "Convertible"];
const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"];
const FUEL_TYPES = ["Gasoline", "Diesel", "Electric", "Hybrid", "Plug-in Hybrid"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const COLORS = ["Black", "White", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Gold", "Orange"];

const PRICE_RANGES = [
  { label: "Under $15,000", min: 0, max: 15000 },
  { label: "$15,000 - $25,000", min: 15000, max: 25000 },
  { label: "$25,000 - $35,000", min: 25000, max: 35000 },
  { label: "$35,000 - $50,000", min: 35000, max: 50000 },
  { label: "Over $50,000", min: 50000, max: undefined },
];

const YEAR_RANGES = [
  { label: "2023 or newer", min: 2023 },
  { label: "2020 - 2022", min: 2020, max: 2022 },
  { label: "2017 - 2019", min: 2017, max: 2019 },
  { label: "2014 - 2016", min: 2014, max: 2016 },
  { label: "2013 or older", max: 2013 },
];

const MILEAGE_RANGES = [
  { label: "Under 25,000", max: 25000 },
  { label: "Under 50,000", max: 50000 },
  { label: "Under 75,000", max: 75000 },
  { label: "Under 100,000", max: 100000 },
  { label: "Any mileage", max: undefined },
];

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border py-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-sm font-medium"
      >
        {title}
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          isOpen ? "grid-rows-[1fr] mt-3 opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

interface CheckboxGroupProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  columns?: number;
}

function CheckboxGroup({ options, selected, onChange, columns = 2 }: CheckboxGroupProps) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggleOption(option)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
          />
          <span className="text-foreground">{option}</span>
        </label>
      ))}
    </div>
  );
}

export function FiltersPanel({ filters, onChange, onClear, availableMakes = [] }: FiltersPanelProps) {
  const allMakes = [...new Set([...DEFAULT_MAKES, ...availableMakes])].sort();

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const updateFilter = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 pb-3 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filters</h2>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-primary">
              <X className="h-4 w-4 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Sort */}
      <FilterSection title="Sort By">
        <select
          value={filters.sort || ""}
          onChange={(e) => updateFilter("sort", e.target.value || undefined)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Best Match</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="year_desc">Year: Newest First</option>
          <option value="mileage_asc">Mileage: Lowest First</option>
        </select>
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Price">
        <div className="space-y-2">
          {PRICE_RANGES.map((range) => (
            <label key={range.label} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="priceRange"
                checked={filters.minPrice === range.min && filters.maxPrice === range.max}
                onChange={() => {
                  updateFilter("minPrice", range.min);
                  updateFilter("maxPrice", range.max);
                }}
                className="h-4 w-4 border-input text-primary focus:ring-primary"
              />
              <span>{range.label}</span>
            </label>
          ))}
          <div className="flex items-center gap-2 mt-3">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ""}
              onChange={(e) => updateFilter("minPrice", e.target.value ? Number(e.target.value) : undefined)}
              className="h-8"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ""}
              onChange={(e) => updateFilter("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
              className="h-8"
            />
          </div>
        </div>
      </FilterSection>

      {/* Make */}
      <FilterSection title="Make">
        <div className="max-h-48 overflow-y-auto space-y-2">
          {allMakes.slice(0, 20).map((make) => (
            <label key={make} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filters.make?.includes(make) || false}
                onChange={() => {
                  const current = filters.make || [];
                  if (current.includes(make)) {
                    updateFilter("make", current.filter((m) => m !== make));
                  } else {
                    updateFilter("make", [...current, make]);
                  }
                }}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span>{make}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Year */}
      <FilterSection title="Year">
        <div className="space-y-2">
          {YEAR_RANGES.map((range) => (
            <label key={range.label} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="yearRange"
                checked={filters.minYear === range.min && filters.maxYear === range.max}
                onChange={() => {
                  updateFilter("minYear", range.min);
                  updateFilter("maxYear", range.max);
                }}
                className="h-4 w-4 border-input text-primary focus:ring-primary"
              />
              <span>{range.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Mileage */}
      <FilterSection title="Mileage">
        <div className="space-y-2">
          {MILEAGE_RANGES.map((range) => (
            <label key={range.label} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="mileageRange"
                checked={filters.maxMiles === range.max}
                onChange={() => updateFilter("maxMiles", range.max)}
                className="h-4 w-4 border-input text-primary focus:ring-primary"
              />
              <span>{range.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Body Style */}
      <FilterSection title="Body Style">
        <CheckboxGroup
          options={BODY_STYLES}
          selected={filters.bodyStyle || []}
          onChange={(selected) => updateFilter("bodyStyle", selected)}
        />
      </FilterSection>

      {/* Drivetrain */}
      <FilterSection title="Drivetrain">
        <CheckboxGroup
          options={DRIVETRAINS}
          selected={filters.drivetrain || []}
          onChange={(selected) => updateFilter("drivetrain", selected)}
        />
      </FilterSection>

      {/* Fuel Type */}
      <FilterSection title="Fuel Type">
        <CheckboxGroup
          options={FUEL_TYPES}
          selected={filters.fuel || []}
          onChange={(selected) => updateFilter("fuel", selected)}
          columns={1}
        />
      </FilterSection>

      {/* Transmission */}
      <FilterSection title="Transmission">
        <CheckboxGroup
          options={TRANSMISSIONS}
          selected={filters.transmission || []}
          onChange={(selected) => updateFilter("transmission", selected)}
        />
      </FilterSection>

      {/* Color */}
      <FilterSection title="Color" defaultOpen={false}>
        <CheckboxGroup
          options={COLORS}
          selected={filters.color || []}
          onChange={(selected) => updateFilter("color", selected)}
        />
      </FilterSection>
    </div>
  );
}
