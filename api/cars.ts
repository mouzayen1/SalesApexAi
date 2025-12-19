import type { VercelRequest, VercelResponse } from '@vercel/node';

// Sample car inventory data
const sampleCars = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Camry',
    year: 2023,
    price: 28500,
    mileage: 12000,
    color: 'Silver',
    fuelType: 'Hybrid',
    transmission: 'Automatic',
    drivetrain: 'FWD',
    mpgCity: 51,
    mpgHighway: 53,
    features: 'Leather Seats, Navigation, Backup Camera, Bluetooth',
    description: 'Well-maintained 2023 Toyota Camry Hybrid with excellent fuel economy.',
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
    isAvailable: true
  },
  {
    id: '2',
    make: 'Honda',
    model: 'CR-V',
    year: 2022,
    price: 32000,
    mileage: 18500,
    color: 'Blue',
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    drivetrain: 'AWD',
    mpgCity: 28,
    mpgHighway: 34,
    features: 'Sunroof, Apple CarPlay, Lane Assist, Heated Seats',
    description: 'Spacious SUV perfect for families with AWD capability.',
    imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b',
    isAvailable: true
  },
  {
    id: '3',
    make: 'Ford',
    model: 'F-150',
    year: 2023,
    price: 45000,
    mileage: 8000,
    color: 'Red',
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    drivetrain: '4WD',
    mpgCity: 20,
    mpgHighway: 26,
    features: 'Tow Package, Bed Liner, Crew Cab, Premium Sound',
    description: 'Powerful truck with towing capacity and modern features.',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf',
    isAvailable: true
  },
  {
    id: '4',
    make: 'Tesla',
    model: 'Model 3',
    year: 2023,
    price: 42000,
    mileage: 5000,
    color: 'White',
    fuelType: 'Electric',
    transmission: 'Automatic',
    drivetrain: 'AWD',
    mpgCity: 0,
    mpgHighway: 0,
    features: 'Autopilot, Premium Interior, Glass Roof, 358 mile range',
    description: 'Nearly new electric vehicle with cutting-edge technology.',
    imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89',
    isAvailable: true
  },
  {
    id: '5',
    make: 'Chevrolet',
    model: 'Malibu',
    year: 2021,
    price: 22000,
    mileage: 28000,
    color: 'Black',
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    drivetrain: 'FWD',
    mpgCity: 29,
    mpgHighway: 36,
    features: 'Touchscreen, Backup Camera, Cruise Control, Bluetooth',
    description: 'Reliable sedan with great fuel economy and modern tech.',
    imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d',
    isAvailable: true
  }
];

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return response.status(200).json(sampleCars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    return response.status(500).json({ error: 'Failed to fetch cars' });
  }
}
