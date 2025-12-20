import { pgTable, text, varchar, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Car inventory schema
export const cars = pgTable("cars", {
  id: varchar("id").primaryKey(),
  make: text("make").notNull(),
  model: text("model").notNull(),
    vin: text("vin").notNull(),
  trim: text("trim").notNull(),
  year: integer("year").notNull(),
  price: integer("price").notNull(),
  mileage: integer("mileage").notNull(),
    body_style: text("body_style").notNull(),
  seats: integer("seats").notNull(),
  color: text("color").notNull(),
  fuelType: text("fuel_type").notNull(),
  transmission: text("transmission").notNull(),
  drivetrain: text("drivetrain").notNull(),
  mpgCity: integer("mpg_city"),
  mpgHighway: integer("mpg_highway"),
  features: text("features").array(),
  description: text("description"),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true),
});

export const insertCarSchema = createInsertSchema(cars).omit({ id: true });
export type InsertCar = z.infer<typeof insertCarSchema>;
export type Car = typeof cars.$inferSelect;

// Conversation message schema
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
});

export type Message = z.infer<typeof messageSchema>;

// Conversation schema for API requests
export const conversationRequestSchema = z.object({
  messages: z.array(messageSchema),
  userMessage: z.string(),
});

export type ConversationRequest = z.infer<typeof conversationRequestSchema>;

// Voice transcription response
export const transcriptionResponseSchema = z.object({
  text: z.string(),
});

export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

// TTS request
export const ttsRequestSchema = z.object({
  text: z.string(),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
});

export type TTSRequest = z.infer<typeof ttsRequestSchema>;

// Users table (keeping existing)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
