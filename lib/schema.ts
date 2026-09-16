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
