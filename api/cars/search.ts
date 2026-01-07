import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory storage - import cars from parent cars.ts
import { sampleCars } from '../cars.js';
interface SearchParams {
  make?: string;
  minPrice?: number;
  maxPrice?: number;
  year?: number;
  color?: string;
  fuelType?: string;
}

function searchCars(params: SearchParams) {
  let filtered = [...sampleCars];

  if (params.make) {
    const makeLower = params.make.toLowerCase();
    filtered = filtered.filter((car) =>
      car.make.toLowerCase().includes(makeLower)
    );
  }

  if (params.minPrice !== undefined) {
    filtered = filtered.filter((car) => car.price >= params.minPrice!);
  }

  if (params.maxPrice !== undefined) {
    filtered = filtered.filter((car) => car.price <= params.maxPrice!);
  }

  if (params.year !== undefined) {
    filtered = filtered.filter((car) => car.year === params.year);
  }

  if (params.color) {
    const colorLower = params.color.toLowerCase();
    filtered = filtered.filter((car) =>
      car.color.toLowerCase().includes(colorLower)
    );
  }

  if (params.fuelType) {
    const fuelLower = params.fuelType.toLowerCase();
    filtered = filtered.filter((car) =>
      car.fuelType.toLowerCase().includes(fuelLower)
    );
  }

  return filtered;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { make, minPrice, maxPrice, year, color, fuelType } = req.query;

    const cars = searchCars({
      make: make as string | undefined,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      color: color as string | undefined,
      fuelType: fuelType as string | undefined,
    });

    return res.status(200).json(cars);
  } catch (error) {
    console.error('Error searching cars:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
