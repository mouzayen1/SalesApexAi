import type { Car } from '../../../shared/schema';
import type { Filters } from './extractFilters';

export interface FilterResult {
  results: Car[];
  debug: {
    reasonsByCarId: Record<string, string[]>;
    totalCars: number;
    matchedCars: number;
    appliedFilters: string[];
  };
}

function matchesPrice(car: Car, filters: Filters): boolean {
  if (filters.minPrice && car.price < filters.minPrice) return false;
  if (filters.maxPrice && car.price > filters.maxPrice) return false;
  return true;
}

function matchesYear(car: Car, filters: Filters): boolean {
  if (filters.minYear && car.year < filters.minYear) return false;
  if (filters.maxYear && car.year > filters.maxYear) return false;
  return true;
}

function matchesMileage(car: Car, filters: Filters): boolean {
  if (filters.minMiles && car.mileage < filters.minMiles) return false;
  if (filters.maxMiles && car.mileage > filters.maxMiles) return false;
  return true;
}

function matchesMake(car: Car, filters: Filters): boolean {
  if (!filters.make || filters.make.length === 0) return true;
  const carMake = car.make.toLowerCase();
  return filters.make.some(m => carMake.includes(m.toLowerCase()));
}

function matchesModel(car: Car, filters: Filters): boolean {
  if (!filters.model || filters.model.length === 0) return true;
  const carModel = car.model.toLowerCase();
  return filters.model.some(m => carModel.includes(m.toLowerCase()));
}

function matchesBodyStyle(car: Car, filters: Filters): boolean {
  if (!filters.bodyStyle || filters.bodyStyle.length === 0) return true;
  const carBodyStyle = car.body_style;
  return filters.bodyStyle.some(b => carBodyStyle.toLowerCase() === b.toLowerCase());
}

function matchesDrivetrain(car: Car, filters: Filters): boolean {
  if (!filters.drivetrain || filters.drivetrain.length === 0) return true;
  const carDrivetrain = car.drivetrain;
  return filters.drivetrain.some(d => carDrivetrain.toLowerCase() === d.toLowerCase());
}

function matchesFuel(car: Car, filters: Filters): boolean {
  if (!filters.fuel || filters.fuel.length === 0) return true;
  const carFuel = car.fuelType.toLowerCase();
  return filters.fuel.some(f => {
    if (f.toLowerCase() === 'ev') return carFuel === 'ev';
    return carFuel === f.toLowerCase();
  });
}

function matchesTransmission(car: Car, filters: Filters): boolean {
  if (!filters.transmission || filters.transmission.length === 0) return true;
  const carTransmission = car.transmission.toLowerCase();
  return filters.transmission.some(t => carTransmission.includes(t.toLowerCase()));
}

function matchesColor(car: Car, filters: Filters): boolean {
  if (!filters.color || filters.color.length === 0) return true;
  const carColor = car.color.toLowerCase();
  return filters.color.some(c => carColor.includes(c.toLowerCase()));
}

function matchesSeats(car: Car, filters: Filters): boolean {
  if (!filters.seats) return true;
  return car.seats >= filters.seats;
}

function matchesFeatures(car: Car, filters: Filters): boolean {
  if (!filters.features || filters.features.length === 0) return true;
  const carFeatures = car.features.toLowerCase();
  // ALL features must match (AND logic)
  return filters.features.every(feature => {
    const featureLower = feature.toLowerCase();
    return carFeatures.includes(featureLower);
  });
}

export function filterInventory(cars: Car[], filters: Filters): FilterResult {
  const reasonsByCarId: Record<string, string[]> = {};
  const appliedFilters: string[] = [];
  
  // Track applied filters
  if (filters.maxPrice) appliedFilters.push(`max price $${filters.maxPrice}`);
  if (filters.minPrice) appliedFilters.push(`min price $${filters.minPrice}`);
  if (filters.minYear) appliedFilters.push(`year >= ${filters.minYear}`);
  if (filters.maxYear) appliedFilters.push(`year <= ${filters.maxYear}`);
  if (filters.maxMiles) appliedFilters.push(`max miles ${filters.maxMiles}`);
  if (filters.bodyStyle && filters.bodyStyle.length > 0) appliedFilters.push(`body: ${filters.bodyStyle.join(', ')}`);
  if (filters.drivetrain && filters.drivetrain.length > 0) appliedFilters.push(`drivetrain: ${filters.drivetrain.join(', ')}`);
  if (filters.fuel && filters.fuel.length > 0) appliedFilters.push(`fuel: ${filters.fuel.join(', ')}`);
  if (filters.features && filters.features.length > 0) appliedFilters.push(`features: ${filters.features.join(', ')}`);
  
  // Filter cars
  const filtered = cars.filter(car => {
    const reasons: string[] = [];
    
    if (!matchesPrice(car, filters)) {
      reasons.push('price out of range');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesYear(car, filters)) {
      reasons.push('year out of range');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesMileage(car, filters)) {
      reasons.push('mileage out of range');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesMake(car, filters)) {
      reasons.push('make not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesModel(car, filters)) {
      reasons.push('model not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesBodyStyle(car, filters)) {
      reasons.push('body style not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesDrivetrain(car, filters)) {
      reasons.push('drivetrain not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesFuel(car, filters)) {
      reasons.push('fuel type not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesTransmission(car, filters)) {
      reasons.push('transmission not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesColor(car, filters)) {
      reasons.push('color not matched');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesSeats(car, filters)) {
      reasons.push('not enough seats');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    if (!matchesFeatures(car, filters)) {
      reasons.push('missing required features');
      reasonsByCarId[car.id] = reasons;
      return false;
    }
    
    reasonsByCarId[car.id] = ['matched'];
    return true;
  });
  
  // Sort results
  let sorted = [...filtered];
  
  if (filters.sort === 'price_asc') {
    sorted.sort((a, b) => a.price - b.price);
  } else if (filters.sort === 'price_desc') {
    sorted.sort((a, b) => b.price - a.price);
  } else if (filters.sort === 'year_desc') {
    sorted.sort((a, b) => b.year - a.year);
  } else if (filters.sort === 'miles_asc') {
    sorted.sort((a, b) => a.mileage - b.mileage);
  } else {
    // Default: best match (newer year, lower miles, closer to max price)
    sorted.sort((a, b) => {
      // Prioritize newer year
      if (b.year !== a.year) return b.year - a.year;
      // Then lower mileage
      if (a.mileage !== b.mileage) return a.mileage - b.mileage;
      // Then price (if max price is set, prefer cars closer to it)
      if (filters.maxPrice) {
        const aDiff = Math.abs(filters.maxPrice - a.price);
        const bDiff = Math.abs(filters.maxPrice - b.price);
        return aDiff - bDiff;
      }
      return 0;
    });
  }
  
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
