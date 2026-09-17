import { z } from "zod";

// Shared between the API route (structured output) and the client (validation).
export const FoodItemSchema = z.object({
  name: z.string().describe("Short dish or ingredient name, e.g. 'Phở bò' or 'White rice'"),
  portion: z
    .string()
    .describe("Estimated portion in plain words with a rough weight/volume, e.g. '1 large bowl (~500 g)'"),
  calories: z.number().describe("Estimated kcal for this portion"),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
});

export const AnalysisSchema = z.object({
  meal_name: z.string().describe("A 2-6 word name for the whole meal"),
  items: z.array(FoodItemSchema).describe("Every distinct food or drink visible, one entry each"),
  total_calories: z.number().describe("Sum of item calories"),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("How confident the calorie estimate is given what is visible"),
  notes: z
    .string()
    .describe(
      "One or two sentences: what drove the estimate, what is uncertain, and what detail from the user would tighten it",
    ),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

// ---- Request body for /api/analyze
export const AnalyzeRequestSchema = z.object({
  image: z.string().optional(),
  note: z.string().max(2000).optional(),
});

// ---- Persisted app data (validated on load and on backup import)
const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MealSchema = z.object({
  id: z.string(),
  date: DateKey,
  loggedAt: z.string(),
  name: z.string(),
  items: z.array(FoodItemSchema),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
  userNote: z.string(),
  thumbnail: z.string().optional(),
});

export const WorkoutSchema = z.object({
  id: z.string(),
  date: DateKey,
  loggedAt: z.string(),
  type: z.enum(["walk", "run", "strength", "cycle", "swim", "other"]),
  minutes: z.number().nonnegative(),
  caloriesBurned: z.number().nonnegative(),
  note: z.string(),
});

export const WeightEntrySchema = z.object({
  id: z.string(),
  date: DateKey,
  kg: z.number().positive(),
});

export const SettingsSchema = z.object({
  dailyCalorieLimit: z.number().positive(),
  goalWeightKg: z.number().positive(),
  startWeightKg: z.number().positive(),
});

export const AppDataSchema = z.object({
  version: z.literal(1),
  settings: SettingsSchema,
  meals: z.array(MealSchema),
  workouts: z.array(WorkoutSchema),
  weights: z.array(WeightEntrySchema),
});
