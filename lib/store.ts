"use client";

import { useSyncExternalStore } from "react";
import { AppDataSchema, type FoodItem } from "./schema";
import type { AppData, Favorite, Meal, Settings, Workout, WeightEntry } from "./types";

const KEY = "kcal:data:v1";

export const DEFAULT_SETTINGS: Settings = {
  dailyCalorieLimit: 1800,
  goalWeightKg: 85,
  startWeightKg: 102,
};

const EMPTY: AppData = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  meals: [],
  workouts: [],
  weights: [],
  favorites: [],
};

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

let cache: AppData | null = null;
const listeners = new Set<() => void>();

function read(): AppData {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      cache = EMPTY;
    } else {
      const parsed = AppDataSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        cache = parsed.data;
      } else {
        console.error("Stored data is invalid; starting empty. Export was not touched.", parsed.error);
        cache = EMPTY;
      }
    }
  } catch (err) {
    console.error("Could not read stored data.", err);
    cache = EMPTY;
  }
  return cache;
}

// Persist first; only update memory and notify once the write succeeded, so
// the UI never shows data that will vanish on reload.
function write(next: AppData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Could not save.", err);
    throw new StorageError(
      "Could not save: this device's storage is full. Export a backup, then delete some old meals.",
    );
  }
  cache = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const MIN_DAY = "2000-01-01";

// Only real calendar days from MIN_DAY on: rejects 2026-02-31, and the
// partial years (0002-, 0202-) a date input emits while the year is typed.
export function isDayKey(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= MIN_DAY && todayKey(parseDayKey(s)) === s;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, m - 1, d); // new Date(y, ...) maps years 0-99 to 1900s
  return date;
}

export function shiftDay(key: string, days: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export function fmtDay(key: string): string {
  const d = parseDayKey(key);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

// Timestamp for an entry logged on `day`: now for today, otherwise the current
// clock time on that day, so backfilled entries sort sensibly within it.
export function loggedAtFor(day: string): string {
  const now = new Date();
  if (day === todayKey(now)) return now.toISOString();
  const d = parseDayKey(day);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return d.toISOString();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Every mutation throws StorageError if the device cannot persist it.
export const store = {
  // `favorite` saves it as a favorite in the same write, so a full device
  // can't store the meal but fail on the favorite (and invite a double save).
  addMeal(meal: Meal, { favorite = false } = {}) {
    const d = read();
    const meals = prunePhotos(d.meals);
    const favorites = favorite
      ? [toFavorite(meal), ...d.favorites.filter((f) => !sameName(f.name, meal.name))]
      : d.favorites;
    write({ ...d, meals: [meal, ...meals], favorites });
  },
  updateMeal(meal: Meal) {
    const d = read();
    write({ ...d, meals: d.meals.map((m) => (m.id === meal.id ? meal : m)) });
  },
  removeMeal(id: string) {
    const d = read();
    write({ ...d, meals: d.meals.filter((m) => m.id !== id) });
  },
  removeMeals(ids: string[]) {
    const d = read();
    const drop = new Set(ids);
    write({ ...d, meals: d.meals.filter((m) => !drop.has(m.id)) });
  },
  // Favorites are matched by meal name, so re-favoriting a meal replaces it.
  addFavorite(meal: Meal) {
    const d = read();
    write({ ...d, favorites: [toFavorite(meal), ...d.favorites.filter((f) => !sameName(f.name, meal.name))] });
  },
  removeFavorite(name: string) {
    const d = read();
    write({ ...d, favorites: d.favorites.filter((f) => !sameName(f.name, name)) });
  },
  addWorkout(w: Workout) {
    const d = read();
    write({ ...d, workouts: [w, ...d.workouts] });
  },
  removeWorkout(id: string) {
    const d = read();
    write({ ...d, workouts: d.workouts.filter((w) => w.id !== id) });
  },
  addWeight(entry: WeightEntry) {
    const d = read();
    // One entry per day: replace if the day already has one.
    const others = d.weights.filter((w) => w.date !== entry.date);
    write({ ...d, weights: [entry, ...others].sort((a, b) => (a.date < b.date ? 1 : -1)) });
  },
  removeWeight(id: string) {
    const d = read();
    write({ ...d, weights: d.weights.filter((w) => w.id !== id) });
  },
  saveSettings(settings: Settings) {
    const d = read();
    write({ ...d, settings });
  },
  exportJson(): string {
    return JSON.stringify(read(), null, 2);
  },
  importJson(json: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    const parsed = AppDataSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const where = first?.path.length ? ` (${first.path.join(".")})` : "";
      throw new Error(`Not a valid kcal backup${where}.`);
    }
    write(parsed.data);
  },
  reset() {
    write(EMPTY);
  },
};

// Re-logged meals and favorites keep only a thumbnail, so fall back to the
// photo of the most recent meal with the same name.
export function photoFor(data: AppData, src: { name: string; photo?: string; thumbnail?: string }): string {
  if (src.photo) return src.photo;
  return data.meals.find((m) => m.photo && sameName(m.name, src.name))?.photo ?? src.thumbnail ?? "";
}

// Accidental double-taps log the same meal several times within moments of
// each other. Two entries count as duplicates only when the meal, the day, the
// calories AND the minute all match, so genuinely eating the same thing twice
// in a day is never touched.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export function findDuplicateMeals(meals: Meal[]): Meal[] {
  const kept: Meal[] = [];
  const dupes: Meal[] = [];
  for (const m of [...meals].sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1))) {
    const match = kept.find(
      (k) =>
        k.date === m.date &&
        sameName(k.name, m.name) &&
        mealCalories(k) === mealCalories(m) &&
        Math.abs(new Date(m.loggedAt).getTime() - new Date(k.loggedAt).getTime()) <= DUPLICATE_WINDOW_MS,
    );
    if (match) dupes.push(m);
    else kept.push(m);
  }
  return dupes;
}

export const PHOTO_KEEP_DAYS = 30;

// Full-size photos are the bulk of stored data, so drop them once a meal is
// older than PHOTO_KEEP_DAYS. Thumbnails and all nutrition data are untouched.
function prunePhotos(meals: Meal[]): Meal[] {
  const cutoff = shiftDay(todayKey(), -PHOTO_KEEP_DAYS);
  let pruned = false;
  const next = meals.map((m) => {
    if (!m.photo || m.date >= cutoff) return m;
    pruned = true;
    return { ...m, photo: undefined };
  });
  return pruned ? next : meals;
}

function toFavorite(meal: Meal): Favorite {
  return {
    id: newId(),
    name: meal.name,
    items: meal.items,
    confidence: meal.confidence,
    notes: meal.notes,
    thumbnail: meal.thumbnail,
  };
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// A fresh copy of a past meal or favorite, logged on `day`.
export function relogMeal(src: Pick<Meal, "name" | "items" | "confidence" | "notes" | "thumbnail">, day: string): Meal {
  return {
    id: newId(),
    date: day,
    loggedAt: loggedAtFor(day),
    name: src.name,
    items: src.items.map((i) => ({ ...i })),
    confidence: src.confidence,
    notes: src.notes,
    userNote: "",
    thumbnail: src.thumbnail,
  };
}

// Rescale an item's calories and macros to a new weight, keeping its density.
// Always scales from the item's scaleBase (its values before the first
// rescale), so repeated edits never compound rounding.
export function scaleItem(item: FoodItem, grams: number): FoodItem {
  const base = item.scaleBase ?? {
    grams: item.grams ?? 0,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    fiber_g: item.fiber_g,
  };
  if (base.grams <= 0) return { ...item, grams, scaleBase: undefined };
  const f = grams / base.grams;
  const r1 = (n: number) => Math.round(n * f * 10) / 10;
  return {
    ...item,
    grams,
    calories: Math.round(base.calories * f),
    protein_g: r1(base.protein_g),
    carbs_g: r1(base.carbs_g),
    fat_g: r1(base.fat_g),
    fiber_g: r1(base.fiber_g),
    scaleBase: base,
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function mealCalories(m: Pick<Meal, "items">): number {
  return Math.round(m.items.reduce((s, i) => s + (i.calories || 0), 0));
}

export function mealMacros(m: Pick<Meal, "items">) {
  return m.items.reduce(
    (acc, i) => ({
      protein: acc.protein + (i.protein_g || 0),
      carbs: acc.carbs + (i.carbs_g || 0),
      fat: acc.fat + (i.fat_g || 0),
      fiber: acc.fiber + (i.fiber_g || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

// Rough MET values; kcal = MET x kg x hours.
export const WORKOUT_MET: Record<Workout["type"], number> = {
  walk: 3.5,
  run: 9,
  strength: 5,
  cycle: 7,
  swim: 7,
  other: 5,
};

export function estimateBurn(type: Workout["type"], minutes: number, weightKg: number): number {
  return Math.round(WORKOUT_MET[type] * weightKg * (minutes / 60));
}

export function latestWeight(data: AppData): number {
  return data.weights[0]?.kg ?? data.settings.startWeightKg;
}

const noopSubscribe = () => () => {};

// Hydration-safe today key: empty during prerender, the device's date once mounted.
export function useTodayKey(): string {
  return useSyncExternalStore(noopSubscribe, () => todayKey(), () => "");
}

// Hydration-safe "today" label: empty during prerender, the device's local
// date once mounted, so server and client never disagree.
export function useTodayLabel(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
    () => "",
  );
}
