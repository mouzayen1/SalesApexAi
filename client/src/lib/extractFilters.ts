import type { Car } from '../../../shared/schema';

export interface Filters {
  maxPrice?: number;
  minPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxMiles?: number;
  minMiles?: number;
  make?: string[];
  model?: string[];
  bodyStyle?: string[];
  drivetrain?: string[];
  fuel?: string[];
  transmission?: string[];
  color?: string[];
  seats?: number;
  features?: string[];
  sort?: 'price_asc' | 'price_desc' | 'year_desc' | 'miles_asc';
}

const FEATURE_SYNONYMS: Record<string, string> = {
  'carplay': 'carplay', 'apple carplay': 'carplay',
  'android auto': 'android auto',
  'heated seats': 'heated seats', 'seat warmers': 'heated seats',
  'leather': 'leather', 'leather seats': 'leather',
  'sunroof': 'sunroof', 'moonroof': 'sunroof',
  'navigation': 'navigation', 'nav': 'navigation',
  'backup camera': 'backup camera', 'rear camera': 'backup camera', 'rearview camera': 'backup camera',
  'blind spot': 'blind spot', 'blind spot monitor': 'blind spot',
  'third row': '3rd row', '3rd row': '3rd row', '7 seater': '3rd row', 'seven seater': '3rd row',
  'tow package': 'tow package', 'towing': 'tow package',
};

const BODY_STYLE_SYNONYMS: Record<string, string> = {
  'crossover': 'SUV', 'suv': 'SUV',
  'pickup': 'Truck', 'truck': 'Truck',
  'sedan': 'Sedan',
  'coupe': 'Coupe',
  'hatchback': 'Hatchback',
  'minivan': 'Van', 'van': 'Van',
};

const DRIVETRAIN_SYNONYMS: Record<string, string> = {
  'all wheel drive': 'AWD', 'awd': 'AWD',
  'four wheel drive': '4WD', '4wd': '4WD', '4x4': '4WD',
  'rear wheel drive': 'RWD', 'rwd': 'RWD',
  'front wheel drive': 'FWD', 'fwd': 'FWD',
};

const FUEL_SYNONYMS: Record<string, string> = {
  'electric': 'EV', 'ev': 'EV', 'tesla': 'EV',
  'hybrid': 'hybrid',
  'diesel': 'diesel',
  'gas': 'gas', 'gasoline': 'gas',
};

const TRANSMISSION_SYNONYMS: Record<string, string> = {
  'manual': 'manual', 'stick': 'manual', 'stick shift': 'manual',
  'automatic': 'automatic', 'auto': 'automatic',
};

const COLORS = ['black', 'white', 'silver', 'gray', 'grey', 'red', 'blue', 'green', 'orange', 'yellow', 'brown', 'gold', 'tan', 'beige'];

const KNOWN_MAKES = [
  'toyota', 'honda', 'ford', 'chevrolet', 'chevy', 'nissan', 'mazda', 'subaru', 'hyundai', 'kia',
  'volkswagen', 'vw', 'jeep', 'bmw', 'mercedes', 'mercedes-benz', 'audi', 'lexus', 'tesla'
];

function parseNumber(text: string): number | null {
  const kMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s?k/i);
  if (kMatch) return parseFloat(kMatch[1].replace(/,/g, '')) * 1000;
  
  const plainMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (plainMatch) return parseFloat(plainMatch[1].replace(/,/g, ''));
  
  return null;
}

function extractPriceFilters(text: string): { minPrice?: number; maxPrice?: number } {
  const lower = text.toLowerCase();
  const result: { minPrice?: number; maxPrice?: number } = {};
  
  const underMatch = lower.match(/(?:under|below|less than|max)\s+(?:price\s+)?(?:\$)?([\d,\.]+\s?k?)/i);
  if (underMatch) {
    const num = parseNumber(underMatch[1]);
    if (num) result.maxPrice = num;
  }
  
  const overMatch = lower.match(/(?:over|above|at least|min)\s+(?:price\s+)?(?:\$)?([\d,\.]+\s?k?)/i);
  if (overMatch) {
    const num = parseNumber(overMatch[1]);
    if (num) result.minPrice = num;
  }
  
  const betweenMatch = lower.match(/between\s+(?:\$)?([\d,\.]+\s?k?)\s+and\s+(?:\$)?([\d,\.]+\s?k?)/i);
  if (betweenMatch) {
    const num1 = parseNumber(betweenMatch[1]);
    const num2 = parseNumber(betweenMatch[2]);
    if (num1 && num2) {
      result.minPrice = Math.min(num1, num2);
      result.maxPrice = Math.max(num1, num2);
    }
  }
  
  return result;
}

function extractYearFilters(text: string): { minYear?: number; maxYear?: number } {
  const result: { minYear?: number; maxYear?: number } = {};
  
  const newerMatch = text.match(/(\d{4})\s+or\s+newer/i);
  if (newerMatch) {
    result.minYear = parseInt(newerMatch[1]);
  }
  
  const olderMatch = text.match(/(\d{4})\s+or\s+older/i);
  if (olderMatch) {
    result.maxYear = parseInt(olderMatch[1]);
  }
  
  const betweenMatch = text.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
  if (betweenMatch) {
    result.minYear = Math.min(parseInt(betweenMatch[1]), parseInt(betweenMatch[2]));
    result.maxYear = Math.max(parseInt(betweenMatch[1]), parseInt(betweenMatch[2]));
  }
  
  const newerThanMatch = text.match(/newer\s+than\s+(\d{4})/i);
  if (newerThanMatch) {
    result.minYear = parseInt(newerThanMatch[1]) + 1;
  }
  
  return result;
}

function extractMileageFilters(text: string): { minMiles?: number; maxMiles?: number } {
  const result: { minMiles?: number; maxMiles?: number } = {};
  
  const underMatch = text.match(/(?:under|below|less than)\s+([\d,\.]+\s?k?)\s+(?:thousand\s+)?miles?/i);
  if (underMatch) {
    const num = parseNumber(underMatch[1]);
    if (num) result.maxMiles = num;
  }
  
  const overMatch = text.match(/(?:over|above|at least)\s+([\d,\.]+\s?k?)\s+(?:thousand\s+)?miles?/i);
  if (overMatch) {
    const num = parseNumber(overMatch[1]);
    if (num) result.minMiles = num;
  }
  
  return result;
}

function normalizeFeature(feature: string): string | null {
  const lower = feature.toLowerCase().trim();
  return FEATURE_SYNONYMS[lower] || null;
}

function normalizeSynonym(text: string, synonyms: Record<string, string>): string | null {
  const lower = text.toLowerCase().trim();
  return synonyms[lower] || null;
}

export function extractFilters(transcript: string, cars?: Car[]): Filters {
  const filters: Filters = {};
  const lower = transcript.toLowerCase();
  
  // Extract price
  const priceFilters = extractPriceFilters(transcript);
  if (priceFilters.minPrice) filters.minPrice = priceFilters.minPrice;
  if (priceFilters.maxPrice) filters.maxPrice = priceFilters.maxPrice;
  
  // Extract year
  const yearFilters = extractYearFilters(transcript);
  if (yearFilters.minYear) filters.minYear = yearFilters.minYear;
  if (yearFilters.maxYear) filters.maxYear = yearFilters.maxYear;
  
  // Extract mileage
  const mileageFilters = extractMileageFilters(transcript);
  if (mileageFilters.minMiles) filters.minMiles = mileageFilters.minMiles;
  if (mileageFilters.maxMiles) filters.maxMiles = mileageFilters.maxMiles;
  
  // Body style
  const bodyStyles: string[] = [];
  Object.keys(BODY_STYLE_SYNONYMS).forEach(key => {
    if (lower.includes(key)) {
      const normalized = BODY_STYLE_SYNONYMS[key];
      if (normalized && !bodyStyles.includes(normalized)) {
        bodyStyles.push(normalized);
      }
    }
  });
  if (bodyStyles.length > 0) filters.bodyStyle = bodyStyles;
  
  // Drivetrain
  const drivetrains: string[] = [];
  Object.keys(DRIVETRAIN_SYNONYMS).forEach(key => {
    if (lower.includes(key)) {
      const normalized = DRIVETRAIN_SYNONYMS[key];
      if (normalized && !drivetrains.includes(normalized)) {
        drivetrains.push(normalized);
      }
    }
  });
  if (drivetrains.length > 0) filters.drivetrain = drivetrains;
  
  // Fuel type
  const fuelTypes: string[] = [];
  Object.keys(FUEL_SYNONYMS).forEach(key => {
    if (lower.includes(key)) {
      const normalized = FUEL_SYNONYMS[key];
      if (normalized && !fuelTypes.includes(normalized)) {
        fuelTypes.push(normalized);
      }
    }
  });
  if (fuelTypes.length > 0) filters.fuel = fuelTypes;
  
  // Transmission
  const transmissions: string[] = [];
  Object.keys(TRANSMISSION_SYNONYMS).forEach(key => {
    if (lower.includes(key)) {
      const normalized = TRANSMISSION_SYNONYMS[key];
      if (normalized && !transmissions.includes(normalized)) {
        transmissions.push(normalized);
      }
    }
  });
  if (transmissions.length > 0) filters.transmission = transmissions;
  
  // Colors
  const colors: string[] = [];
  COLORS.forEach(color => {
    if (lower.includes(color)) {
      colors.push(color);
    }
  });
  if (colors.length > 0) filters.color = colors;
  
  // Features
  const features: string[] = [];
  Object.keys(FEATURE_SYNONYMS).forEach(key => {
    if (lower.includes(key)) {
      const normalized = FEATURE_SYNONYMS[key];
      if (normalized && !features.includes(normalized)) {
        features.push(normalized);
      }
    }
  });
  
  // Handle third row + seats
  if (features.includes('3rd row') || lower.includes('7 seater') || lower.includes('seven seater')) {
    if (!features.includes('3rd row')) features.push('3rd row');
    filters.seats = 7;
  }
  
  if (features.length > 0) filters.features = features;
  
  // Make and model
  const makes: string[] = [];
  KNOWN_MAKES.forEach(make => {
    if (lower.includes(make)) {
      // Normalize chevrolet/chevy
      const normalized = make === 'chevy' ? 'chevrolet' : make === 'vw' ? 'volkswagen' : make;
      if (!makes.includes(normalized)) makes.push(normalized);
    }
  });
  if (makes.length > 0) filters.make = makes;
  
  // Extract models from inventory if available
  const models: string[] = [];
  if (cars) {
    const uniqueModels = Array.from(new Set(cars.map(c => c.model.toLowerCase())));
    uniqueModels.forEach(model => {
      if (lower.includes(model)) {
        models.push(model);
      }
    });
  }
  if (models.length > 0) filters.model = models;
  
  // Sorting
  if (lower.includes('cheapest') || lower.includes('lowest price')) {
    filters.sort = 'price_asc';
  } else if (lower.includes('most expensive') || lower.includes('highest price')) {
    filters.sort = 'price_desc';
  } else if (lower.includes('newest') || lower.includes('latest')) {
    filters.sort = 'year_desc';
  } else if (lower.includes('lowest miles') || lower.includes('least miles')) {
    filters.sort = 'miles_asc';
  }
  
  return filters;
}
