import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sampleCars } from '../cars';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Vehicle ID is required' });
    }

    // Find the car by ID (IDs are strings like "1", "2", etc.)
    const car = sampleCars.find((c) => String(c.id) === String(id));

    if (!car) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    return res.status(200).json(car);
  } catch (error) {
    console.error('Error fetching car:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
