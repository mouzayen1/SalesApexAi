import { type User, type InsertUser, type Car, type InsertCar } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllCars(): Promise<Car[]>;
  getCarById(id: string): Promise<Car | undefined>;
  getCarsByMake(make: string): Promise<Car[]>;
  searchCars(query: {
    make?: string;
    minPrice?: number;
    maxPrice?: number;
    year?: number;
    color?: string;
    fuelType?: string;
  }): Promise<Car[]>;
}

const sampleCars: Car[] = [
  {
    id: "car-001",
    make: "Toyota",
    model: "Camry",
    year: 2024,
    price: 28999,
    mileage: 5200,
    color: "Pearl White",
    fuelType: "Hybrid",
    transmission: "Automatic",
    drivetrain: "FWD",
    mpgCity: 51,
    mpgHighway: 53,
    features: ["Apple CarPlay", "Android Auto", "Adaptive Cruise Control", "Lane Departure Warning", "Heated Seats"],
    description: "The 2024 Toyota Camry Hybrid offers exceptional fuel economy with a refined driving experience. This vehicle combines reliability with modern technology.",
    imageUrl: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-002",
    make: "Honda",
    model: "CR-V",
    year: 2024,
    price: 34500,
    mileage: 8900,
    color: "Sonic Gray",
    fuelType: "Gasoline",
    transmission: "CVT",
    drivetrain: "AWD",
    mpgCity: 28,
    mpgHighway: 34,
    features: ["Panoramic Sunroof", "Wireless Charging", "Blind Spot Monitoring", "Remote Start", "Power Liftgate"],
    description: "The Honda CR-V is a versatile compact SUV perfect for families. Spacious interior with excellent safety ratings.",
    imageUrl: "https://images.unsplash.com/photo-1568844293986-8c7a5f451121?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-003",
    make: "Tesla",
    model: "Model 3",
    year: 2024,
    price: 42990,
    mileage: 2100,
    color: "Midnight Silver",
    fuelType: "Electric",
    transmission: "Single Speed",
    drivetrain: "RWD",
    mpgCity: 138,
    mpgHighway: 126,
    features: ["Autopilot", "15-inch Touchscreen", "Glass Roof", "Premium Audio", "Full Self-Driving Capable"],
    description: "Experience the future of driving with the Tesla Model 3. Zero emissions, instant acceleration, and cutting-edge technology.",
    imageUrl: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-004",
    make: "Ford",
    model: "F-150",
    year: 2023,
    price: 52999,
    mileage: 15600,
    color: "Rapid Red",
    fuelType: "Gasoline",
    transmission: "Automatic",
    drivetrain: "4WD",
    mpgCity: 20,
    mpgHighway: 24,
    features: ["Pro Power Onboard", "360-Degree Camera", "Trailer Backup Assist", "SYNC 4", "B&O Sound System"],
    description: "America's best-selling truck. The Ford F-150 combines power, capability, and modern technology for work or play.",
    imageUrl: "https://images.unsplash.com/photo-1590656364826-5f13b8e5c7e0?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-005",
    make: "BMW",
    model: "X5",
    year: 2024,
    price: 67500,
    mileage: 4300,
    color: "Alpine White",
    fuelType: "Gasoline",
    transmission: "Automatic",
    drivetrain: "xDrive",
    mpgCity: 21,
    mpgHighway: 26,
    features: ["Gesture Control", "Harman Kardon Audio", "Soft-Close Doors", "Head-Up Display", "Parking Assistant Plus"],
    description: "The BMW X5 delivers driving pleasure with commanding presence. Luxurious interior with advanced driver assistance systems.",
    imageUrl: "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-006",
    make: "Chevrolet",
    model: "Bolt EV",
    year: 2024,
    price: 27495,
    mileage: 3200,
    color: "Bright Blue",
    fuelType: "Electric",
    transmission: "Single Speed",
    drivetrain: "FWD",
    mpgCity: 131,
    mpgHighway: 109,
    features: ["One Pedal Driving", "DC Fast Charging", "Regen on Demand", "10.2-inch Display", "Teen Driver Mode"],
    description: "Affordable electric driving with 259 miles of range. The Chevrolet Bolt EV makes going electric easy and practical.",
    imageUrl: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-007",
    make: "Mazda",
    model: "CX-5",
    year: 2024,
    price: 31150,
    mileage: 6800,
    color: "Soul Red Crystal",
    fuelType: "Gasoline",
    transmission: "Automatic",
    drivetrain: "AWD",
    mpgCity: 24,
    mpgHighway: 30,
    features: ["Bose Audio", "Heads-Up Display", "Traffic Sign Recognition", "Ventilated Seats", "Adaptive Headlights"],
    description: "The Mazda CX-5 offers premium feel at a mainstream price. Sporty handling with upscale interior craftsmanship.",
    imageUrl: "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-008",
    make: "Hyundai",
    model: "Tucson",
    year: 2024,
    price: 29750,
    mileage: 7500,
    color: "Amazon Gray",
    fuelType: "Hybrid",
    transmission: "Automatic",
    drivetrain: "AWD",
    mpgCity: 38,
    mpgHighway: 38,
    features: ["Digital Key", "Remote Smart Parking", "Highway Drive Assist", "BlueLink Connected", "Wireless Apple CarPlay"],
    description: "The Hyundai Tucson Hybrid offers excellent fuel economy in a stylish package. Loaded with technology and comfort features.",
    imageUrl: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80",
    isAvailable: true,
  },
];

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cars: Map<string, Car>;

  constructor() {
    this.users = new Map();
    this.cars = new Map();
    
    sampleCars.forEach((car) => {
      this.cars.set(car.id, car);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllCars(): Promise<Car[]> {
    return Array.from(this.cars.values());
  }

  async getCarById(id: string): Promise<Car | undefined> {
    return this.cars.get(id);
  }

  async getCarsByMake(make: string): Promise<Car[]> {
    return Array.from(this.cars.values()).filter(
      (car) => car.make.toLowerCase() === make.toLowerCase()
    );
  }

  async searchCars(query: {
    make?: string;
    minPrice?: number;
    maxPrice?: number;
    year?: number;
    color?: string;
    fuelType?: string;
  }): Promise<Car[]> {
    return Array.from(this.cars.values()).filter((car) => {
      if (query.make && !car.make.toLowerCase().includes(query.make.toLowerCase())) {
        return false;
      }
      if (query.minPrice && car.price < query.minPrice) {
        return false;
      }
      if (query.maxPrice && car.price > query.maxPrice) {
        return false;
      }
      if (query.year && car.year !== query.year) {
        return false;
      }
      if (query.color && !car.color.toLowerCase().includes(query.color.toLowerCase())) {
        return false;
      }
      if (query.fuelType && !car.fuelType.toLowerCase().includes(query.fuelType.toLowerCase())) {
        return false;
      }
      return true;
    });
  }
}

export const storage = new MemStorage();
