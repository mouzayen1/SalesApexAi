import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cars = await storage.getAllCars();
    return response.status(200).json(cars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    return response.status(500).json({ error: 'Failed to fetch cars' });
  }
}
