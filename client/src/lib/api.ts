import type { Car } from "@shared/schema";

export interface CarsSearchParams {
  maxPrice?: number;
  minPrice?: number;
  make?: string;
  year?: number;
  color?: string;
  fuelType?: string;
  q?: string; // free-text from mic
}

export async function fetchCars(params: CarsSearchParams = {}): Promise<Car[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const res = await fetch(`/api/cars/search?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cars: ${res.status}`);
  }
  const data = await res.json();
  return data; // API returns Car[] directly
}

export async function fetchCarById(id: string): Promise<Car | null> {
  const res = await fetch(`/api/cars/${encodeURIComponent(id)}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch car: ${res.status}`);
  }
  return res.json();
}
