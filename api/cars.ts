import type { VercelRequest, VercelResponse } from '@vercel/node';

// Comprehensive car inventory data (20 vehicles)
const sampleCars = [
  {
    id: '1',
    vin: '1HGCM82633A001001',
    year: 2021,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    price: 28995,
    mileage: 42000,
    body_style: 'SUV',
    color: 'White',
    drivetrain: 'AWD',
    fuelType: 'Gas',
    transmission: 'Automatic',
    seats: 5,
    mpgCity: 27,
    mpgHighway: 35,
    features: 'carplay;android auto;backup camera;blind spot',
    description: '2021 Toyota RAV4 XLE with AWD and excellent features.',
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
    isAvailable: true
  },
  {
    id: '2',
    vin: '1HGCM82633A001002',
    year: 2020,
    make: 'Honda',
    model: 'CR-V',
    trim: 'EX',
    price: 25995,
    mileage: 51000,
    body_style: 'SUV',
    color: 'Black',
    drivetrain: 'FWD',
    fuelType: 'Gas',
    transmission: 'Automatic',
    seats: 5,
    mpgCity: 28,
    mpgHighway: 34,
    features: 'carplay;heated seats;backup camera',
    description: '2020 Honda CR-V EX in excellent condition.',
    imageUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6',
    isAvailable: true
  },
  {
    id: '3',
    vin: '1HGCM82633A001003',
    year: 2022,
    make: 'Tesla',
    model: 'Model 3',
    trim: 'Long Range',
    price: 35995,
    mileage: 22000,
    body_style: 'Sedan',
    color: 'Blue',
    drivetrain: 'AWD',
    fuelType: 'EV',
    transmission: 'Automatic',
    seats: 5,
    mpgCity: 0,
    mpgHighway: 0,
    features: 'carplay;navigation;blind spot',
    description: '2022 Tesla Model 3 Long Range with AWD.',
    imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89',
    isAvailable: true
  },
  {
    id: '4',
    vin: '1HGCM82633A001004',
    year: 2019,
    make: 'Ford',
    model: 'F-150',
    trim: 'XLT',
    price: 31995,
    mileage: 68000,
    body_style: 'Truck',
    color: 'Gray',
    drivetrain: '4WD',
    fuelType: 'Gas',
    transmission: 'Automatic',
    seats: 5,
    mpgCity: 19,
    mpgHighway: 25,
    features: 'backup camera;tow package',
    description: '2019 Ford F-150 XLT with 4WD and tow package.',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf',
    isAvailable: true
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    return res.status(200).json(sampleCars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
