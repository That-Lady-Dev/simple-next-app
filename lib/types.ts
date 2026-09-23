import type { Favorite, FoodItem } from "./schema";

export type { Favorite };

export type Confidence = "low" | "medium" | "high";

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD, local time
  loggedAt: string; // ISO timestamp
  name: string;
  items: FoodItem[];
  confidence: Confidence;
  notes: string;
  userNote: string;
  thumbnail?: string; // small JPEG data URL
}

export type WorkoutType = "walk" | "run" | "strength" | "cycle" | "swim" | "other";

export interface Workout {
  id: string;
  date: string;
  loggedAt: string;
  type: WorkoutType;
  minutes: number;
  caloriesBurned: number;
  note: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
}

export interface Settings {
  dailyCalorieLimit: number;
  goalWeightKg: number;
  startWeightKg: number;
}

export interface AppData {
  version: 1;
  settings: Settings;
  meals: Meal[];
  workouts: Workout[];
  weights: WeightEntry[];
  favorites: Favorite[];
}
