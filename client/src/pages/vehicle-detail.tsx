import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCars } from '../lib/api';

import type { Car } from '@shared/schema';

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();


  const { data, isLoading, error } = useQuery({
    queryKey: ['car', id],
    queryFn: async () => {
      const cars = await fetchCars({});
      return cars.find((c: Car) => String(c.id) === String(id));
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-slate-600">Loading vehicle...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-red-600">Vehicle not found.</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          ← Back to search
        </Link>
      </div>
    );
  }

  const car = data as Car;

  
      const handleRehashClick = () => {
    navigate('/rehash-optimizer', { state: { vehicle: car } });
  };
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800">
        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to results
      </Link>
      
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          {car.year} {car.make} {car.model}
        </h1>
        
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Price</h2>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              ${car.price.toLocaleString()}
            </p>
          </div>
          
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Mileage</h2>
            <p className="mt-1 text-xl text-slate-900">
              {car.mileage?.toLocaleString() || 'N/A'} mi
            </p>
          </div>
          
          {car.trim && (
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Trim</h2>
              <p className="mt-1 text-xl text-slate-900">{car.trim}</p>
            </div>
          )}
          
          {car.drivetrain && (
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Drivetrain</h2>
              <p className="mt-1 text-xl text-slate-900">{car.drivetrain}</p>
            </div>
          )}
          
          {car.fuelType && (
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Fuel Type</h2>
              <p className="mt-1 text-xl text-slate-900">{car.fuelType}</p>
            </div>
          )}
          
          {car.color && (
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Color</h2>
              <p className="mt-1 text-xl text-slate-900">{car.color}</p>
            </div>
          )}
        </div>
        
        <div className="mt-8">
          <button
            onClick={handleRehashClick}
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Optimize Deal / Rehash
          </button>
        </div>
      </div>
    </div>
  );
}
