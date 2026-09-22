"use client";

import { useSyncExternalStore } from "react";
import { AppDataSchema } from "./schema";
import type { AppData, Meal, Settings, Workout, WeightEntry } from "./types";

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
  addMeal(meal: Meal) {
    const d = read();
    write({ ...d, meals: [meal, ...d.meals] });
  },
  updateMeal(meal: Meal) {
    const d = read();
    write({ ...d, meals: d.meals.map((m) => (m.id === meal.id ? meal : m)) });
  },
  removeMeal(id: string) {
    const d = read();
    write({ ...d, meals: d.meals.filter((m) => m.id !== id) });
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

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function mealCalories(m: Meal): number {
  return Math.round(m.items.reduce((s, i) => s + (i.calories || 0), 0));
}

export function mealMacros(m: Meal) {
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
