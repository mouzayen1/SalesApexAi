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
    {
    id: "car-009",
    make: "Nissan",
    model: "Altima",
    year: 2024,
    price: 27250,
    mileage: 5400,
    color: "Gun Metallic",
    fuelType: "Gasoline",
    transmission: "CVT",
    drivetrain: "FWD",
    mpgCity: 28,
    mpgHighway: 39,
    features: ["ProPILOT Assist", "Safety Shield 360", "NissanConnect", "Dual-Zone Climate", "Power Moonroof"],
    description: "The Nissan Altima delivers refined comfort with advanced safety features. Spacious cabin with excellent fuel economy.",
    imageUrl: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80",
    isAvailable: true,
  },
  {
    id: "car-010",
    make: "Subaru",
    model: "Outback",
    year: 2024,
    price: 35000,
    mileage: 6200,
    color: "Wilderness Green",
    fuelType: "Gasoline",
    transmission: "CVT",
    drivetrain: "AWD",
    mpgCity: 26,
    mpgHighway: 33,
    features: ["EyeSight System", "X-Mode", "Roof Rails", "Harman Kardon Audio", "STARLINK"],
    description: "The Subaru Outback offers go-anywhere capability with impressive cargo space. Perfect for outdoor adventures.",
    imageUrl: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80",
    isAvailable: true,
  },
  { id: "car-011", make: "Audi", model: "Q5", year: 2024, price: 48900, mileage: 3800, color: "Navarra Blue", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "Quattro", mpgCity: 23, mpgHighway: 28, features: ["Virtual Cockpit", "MMI Navigation", "Bang & Olufsen Audio", "Adaptive Cruise", "Matrix LED Headlights"], description: "Luxury meets performance in the Audi Q5. Premium interior with advanced technology.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-012", make: "Kia", model: "Sportage", year: 2024, price: 29990, mileage: 5100, color: "Dawning Red", fuelType: "Hybrid", transmission: "Automatic", drivetrain: "AWD", mpgCity: 43, mpgHighway: 43, features: ["Dual Panoramic Display", "Highway Driving Assist 2", "Smart Park", "Bose Premium Audio", "Wireless Charging"], description: "Bold design with hybrid efficiency. The Kia Sportage offers premium features at an accessible price.", imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80", isAvailable: true },
  { id: "car-013", make: "Jeep", model: "Grand Cherokee", year: 2023, price: 51500, mileage: 12400, color: "Diamond Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 19, mpgHighway: 26, features: ["Quadra-Drive II", "Uconnect 5", "McIntosh Audio", "Rear Seat Entertainment", "Air Suspension"], description: "Legendary capability meets modern luxury. The Grand Cherokee tackles any terrain with style.", imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80", isAvailable: true },
  { id: "car-014", make: "Mercedes-Benz", model: "GLE", year: 2024, price: 72300, mileage: 2900, color: "Obsidian Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4MATIC", mpgCity: 20, mpgHighway: 26, features: ["MBUX System", "Burmester Audio", "Active Multicontour Seats", "Airmatic Suspension", "360 Camera"], description: "Three-pointed star luxury at its finest. The GLE delivers exceptional comfort and cutting-edge technology.", imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80", isAvailable: true },
  { id: "car-015", make: "Volkswagen", model: "Tiguan", year: 2024, price: 32650, mileage: 4700, color: "Pure White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 22, mpgHighway: 29, features: ["Digital Cockpit", "App-Connect", "Adaptive Cruise", "Panoramic Sunroof", "Fender Audio"], description: "German engineering meets practicality. The Tiguan offers three rows and refined driving dynamics.", imageUrl: "https://images.unsplash.com/photo-1619682817661-c2b9f0ff3f56?w=800&q=80", isAvailable: true },
  { id: "car-016", make: "Lexus", model: "RX 350", year: 2024, price: 53700, mileage: 3200, color: "Atomic Silver", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 21, mpgHighway: 28, features: ["Mark Levinson Audio", "Panoramic View Monitor", "Safety System+ 3.0", "Heated/Ventilated Seats", "Wireless Charging"], description: "Luxury redefined with legendary Lexus reliability. Exceptional build quality and refined comfort.", imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80", isAvailable: true },
  { id: "car-017", make: "Acura", model: "MDX", year: 2024, price: 51995, mileage: 5600, color: "Majestic Black Pearl", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "SH-AWD", mpgCity: 19, mpgHighway: 26, features: ["True Touchpad Interface", "ELS Studio 3D Audio", "AcuraWatch", "Hands-Free Power Liftgate", "Precision All-Wheel Steer"], description: "Precision crafted performance with three-row versatility. The MDX delivers engaging driving dynamics.", imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80", isAvailable: true },
  { id: "car-018", make: "Volvo", model: "XC90", year: 2024, price: 60200, mileage: 2800, color: "Thunder Grey", fuelType: "Hybrid", transmission: "Automatic", drivetrain: "AWD", mpgCity: 27, mpgHighway: 29, features: ["Pilot Assist", "Bowers & Wilkins Audio", "Air Suspension", "Panoramic Roof", "City Safety"], description: "Swedish luxury with plug-in hybrid efficiency. Elegant Scandinavian design meets advanced safety.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-019", make: "Ram", model: "1500", year: 2024, price: 49870, mileage: 8200, color: "Flame Red", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 17, mpgHighway: 23, features: ["12-inch Uconnect", "Multifunction Tailgate", "Active-Level Four-Corner Air Suspension", "360-Degree Camera", "Harman Kardon Audio"], description: "Best-in-class ride quality meets powerful capability. The Ram 1500 redefines what a truck can be.", imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80", isAvailable: true },
  { id: "car-020", make: "GMC", model: "Sierra 1500", year: 2024, price: 54300, mileage: 6700, color: "Onyx Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 16, mpgHighway: 20, features: ["MultiPro Tailgate", "CarbonPro Bed", "Head-Up Display", "Super Cruise", "Bose Audio"], description: "Professional grade truck with premium features. The Sierra delivers capability with refinement.", imageUrl: "https://images.unsplash.com/photo-1590656364826-5f13b8e5c7e0?w=800&q=80", isAvailable: true },
  { id: "car-021", make: "Lincoln", model: "Aviator", year: 2024, price: 62500, mileage: 3400, color: "Infinite Black", fuelType: "Hybrid", transmission: "Automatic", drivetrain: "AWD", mpgCity: 23, mpgHighway: 26, features: ["Revel Ultima Audio", "Perfect Position Seats", "Phone As A Key", "Co-Pilot360", "Head-Up Display"], description: "American luxury redefined with plug-in hybrid technology. Sanctuary on wheels with exceptional comfort.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-022", make: "Genesis", model: "GV70", year: 2024, price: 47250, mileage: 2100, color: "Uyuni White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 22, mpgHighway: 28, features: ["14.5-inch Display", "Lexicon Audio", "Highway Driving Assist 2", "Remote Smart Parking", "3D Digital Cluster"], description: "Korean luxury that rivals the best. The GV70 offers stunning design and advanced technology.", imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80", isAvailable: true },
  { id: "car-023", make: "Toyota", model: "RAV4", year: 2023, price: 32400, mileage: 18200, color: "Blueprint", fuelType: "Hybrid", transmission: "CVT", drivetrain: "AWD", mpgCity: 41, mpgHighway: 38, features: ["Toyota Safety Sense 2.5+", "Wireless Phone Charger", "Power Liftgate", "JBL Audio", "Dynamic Navigation"], description: "Best-selling SUV with hybrid efficiency. Proven reliability meets modern technology.", imageUrl: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80", isAvailable: true },
  { id: "car-024", make: "Porsche", model: "Cayenne", year: 2024, price: 78550, mileage: 1900, color: "Carrara White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 18, mpgHighway: 23, features: ["PCM with Navigation", "Bose Surround Sound", "Adaptive Air Suspension", "Sport Chrono Package", "Panoramic Roof"], description: "Sports car DNA in SUV form. The Cayenne delivers exhilarating performance with luxury refinement.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-025", make: "Dodge", model: "Durango", year: 2023, price: 42900, mileage: 16700, color: "DB Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 19, mpgHighway: 26, features: ["Uconnect 10.1", "Alpine Audio", "Trailer Tow Group", "Heated Second Row", "Blind Spot Monitoring"], description: "Three-row SUV with muscle car attitude. Powerful V6 engine with spacious interior.", imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80", isAvailable: true },
  { id: "car-026", make: "Rivian", model: "R1T", year: 2024, price: 73000, mileage: 1200, color: "Compass Yellow", fuelType: "Electric", transmission: "Single Speed", drivetrain: "AWD", mpgCity: 70, mpgHighway: 66, features: ["Gear Tunnel", "Camp Kitchen", "Underbody Storage", "Quad Motor AWD", "Large Pack Battery"], description: "Adventure-ready electric truck with innovative storage. 314 miles of range with impressive off-road capability.", imageUrl: "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800&q=80", isAvailable: true },
  { id: "car-027", make: "Cadillac", model: "XT5", year: 2024, price: 51490, mileage: 4100, color: "Crystal White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 20, mpgHighway: 27, features: ["Super Cruise", "AKG Studio Audio", "Rear Camera Mirror", "Enhanced Night Vision", "Wireless Charging"], description: "American luxury with advanced technology. The XT5 combines elegant design with semi-autonomous driving.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-028", make: "Infiniti", model: "QX60", year: 2024, price: 52550, mileage: 3900, color: "Majestic White", fuelType: "Gasoline", transmission: "CVT", drivetrain: "AWD", mpgCity: 21, mpgHighway: 26, features: ["ProPILOT Assist", "Bose Performance Audio", "Quilted Semi-Aniline Leather", "Motion Activated Liftgate", "Tri-Zone Climate"], description: "Japanese luxury with three-row versatility. Refined craftsmanship meets modern convenience.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-029", make: "Chevrolet", model: "Silverado 1500", year: 2023, price: 48900, mileage: 21500, color: "Silver Ice", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 16, mpgHighway: 20, features: ["13.4-inch Infotainment", "Bose Audio", "Multi-Flex Tailgate", "Trailering Package", "Bed View Camera"], description: "America's workhorse with modern technology. Strong capability meets comfortable daily driving.", imageUrl: "https://images.unsplash.com/photo-1590656364826-5f13b8e5c7e0?w=800&q=80", isAvailable: true },
  { id: "car-030", make: "Alfa Romeo", model: "Stelvio", year: 2024, price: 52495, mileage: 2600, color: "Vulcano Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 22, mpgHighway: 29, features: ["8.8-inch Display", "Harman Kardon Audio", "Adaptive Cruise", "Forward Collision Warning", "Leather Sport Seats"], description: "Italian passion in SUV form. The Stelvio delivers spirited driving with distinctive styling.", imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80", isAvailable: true },
  { id: "car-031", make: "Buick", model: "Enclave", year: 2024, price: 46495, mileage: 5300, color: "Summit White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 18, mpgHighway: 26, features: ["Quiet Tuning", "Bose Premium Audio", "Surround Vision", "Heated/Ventilated Seats", "Tri-Zone Climate"], description: "Refined three-row SUV with premium comfort. QuietTuning technology delivers library-quiet cabin.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-032", make: "Mitsubishi", model: "Outlander", year: 2024, price: 31895, mileage: 6400, color: "Red Diamond", fuelType: "Hybrid", transmission: "CVT", drivetrain: "AWD", mpgCity: 35, mpgHighway: 36, features: ["MI-PILOT Assist", "Bose Premium Audio", "Power Panoramic Sunroof", "Wireless Phone Charger", "7 Seats"], description: "Value-packed three-row PHEV SUV. Impressive fuel economy with versatile seating.", imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80", isAvailable: true },
  { id: "car-033", make: "Toyota", model: "Highlander", year: 2023, price: 41200, mileage: 14800, color: "Celestial Silver", fuelType: "Hybrid", transmission: "CVT", drivetrain: "AWD", mpgCity: 36, mpgHighway: 35, features: ["Toyota Safety Sense 2.5+", "JBL Audio", "Panoramic Moonroof", "Digital Rearview Mirror", "Wireless Charging"], description: "Family favorite with hybrid efficiency. Proven reliability and spacious three-row seating.", imageUrl: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80", isAvailable: true },
  { id: "car-034", make: "Land Rover", model: "Range Rover Sport", year: 2024, price: 95900, mileage: 1400, color: "Santorini Black", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 17, mpgHighway: 23, features: ["Pivi Pro", "Meridian Signature Audio", "Active Rear Differential", "Air Suspension", "Matrix LED Headlights"], description: "British luxury meets go-anywhere capability. Refined on-road with legendary off-road prowess.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-035", make: "Mazda", model: "CX-9", year: 2023, price: 38450, mileage: 19200, color: "Machine Gray", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "AWD", mpgCity: 20, mpgHighway: 26, features: ["10.25-inch Display", "Bose Audio", "i-ACTIVSENSE", "Power Liftgate", "Leather Seats"], description: "Upscale three-row SUV with engaging dynamics. Premium feel at a mainstream price.", imageUrl: "https://images.unsplash.com/photo-1612825173281-9a193378527e?w=800&q=80", isAvailable: true },
  { id: "car-036", make: "Honda", model: "Accord", year: 2024, price: 30895, mileage: 7100, color: "Platinum White", fuelType: "Hybrid", transmission: "CVT", drivetrain: "FWD", mpgCity: 51, mpgHighway: 44, features: ["Honda Sensing", "Wireless Apple CarPlay", "Bose Premium Audio", "Wireless Charging", "Hands-Free Power Trunk"], description: "Midsize sedan excellence with hybrid efficiency. Spacious cabin and engaging driving dynamics.", imageUrl: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80", isAvailable: true },
  { id: "car-037", make: "Chrysler", model: "Pacifica", year: 2024, price: 52585, mileage: 8900, color: "Velvet Red", fuelType: "Hybrid", transmission: "Automatic", drivetrain: "FWD", mpgCity: 30, mpgHighway: 28, features: ["Stow 'n Go Seating", "Uconnect Theater", "Tri-Pane Panoramic Sunroof", "Harman Kardon Audio", "360-Degree Camera"], description: "Most innovative minivan with plug-in hybrid option. Family hauler with luxury amenities.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-038", make: "Audi", model: "e-tron", year: 2024, price: 72400, mileage: 2400, color: "Mythos Black", fuelType: "Electric", transmission: "Single Speed", drivetrain: "Quattro", mpgCity: 78, mpgHighway: 77, features: ["Virtual Cockpit Plus", "Bang & Olufsen 3D Audio", "Matrix LED Headlights", "Adaptive Air Suspension", "MMI Navigation Plus"], description: "Premium electric SUV with Audi refinement. 226 miles of range with quattro all-wheel drive.", imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80", isAvailable: true },
  { id: "car-039", make: "Nissan", model: "Frontier", year: 2024, price: 39990, mileage: 9800, color: "Boulder Gray", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "4WD", mpgCity: 18, mpgHighway: 24, features: ["Pro-4X Off-Road Package", "Zero Gravity Seats", "Around View Monitor", "Fender Audio", "Bed Utility System"], description: "Rugged midsize truck with proven reliability. Off-road ready with comfortable daily driving.", imageUrl: "https://images.unsplash.com/photo-1590656364826-5f13b8e5c7e0?w=800&q=80", isAvailable: true },
  { id: "car-040", make: "Kia", model: "Carnival", year: 2024, price: 44490, mileage: 6700, color: "Glacial White", fuelType: "Gasoline", transmission: "Automatic", drivetrain: "FWD", mpgCity: 19, mpgHighway: 26, features: ["Dual 12.3-inch Displays", "VIP Lounge Seating", "Bose Premium Audio", "Highway Driving Assist 2", "Wireless Charging"], description: "Redefining the minivan with SUV styling. Luxurious interior with cutting-edge technology.", imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80", isAvailable: true }
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
