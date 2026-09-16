"use client";

import { Tabs } from "@/components/Tabs";
import { Ring } from "@/components/Ring";
import { MealCapture } from "@/components/MealCapture";
import { WorkoutForm } from "@/components/WorkoutForm";
import { MealList, WorkoutList } from "@/components/DayLists";
import { latestWeight, mealCalories, mealMacros, todayKey, useAppData } from "@/lib/store";

export default function TodayPage() {
  const data = useAppData();
  const today = todayKey();
  const meals = data.meals.filter((m) => m.date === today);
  const workouts = data.workouts.filter((w) => w.date === today);

  const eaten = meals.reduce((s, m) => s + mealCalories(m), 0);
  const burned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
  const limit = data.settings.dailyCalorieLimit;
  const macros = meals.reduce(
    (acc, m) => {
      const mm = mealMacros(m);
      return {
        protein: acc.protein + mm.protein,
        carbs: acc.carbs + mm.carbs,
        fat: acc.fat + mm.fat,
        fiber: acc.fiber + mm.fiber,
      };
    },
    { protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
  const weight = latestWeight(data);
  const toGo = Math.max(0, weight - data.settings.goalWeightKg);

  return (
    <main className="container">
      <div className="topbar">
        <h1>Today</h1>
        <span className="date">{new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</span>
      </div>

      <section className="card">
        <div className="summary">
          <Ring eaten={eaten} limit={limit} />
          <div className="stats">
            <div className="stat">
              <span>Eaten</span>
              <strong>{eaten}</strong>
            </div>
            <div className="stat">
              <span>Limit</span>
              <strong>{limit}</strong>
            </div>
            <div className="stat">
              <span>Burned</span>
              <strong>{burned}</strong>
            </div>
            <div className="stat">
              <span>Weight</span>
              <strong>
                {weight} <span className="muted small">kg · {toGo.toFixed(1)} to go</span>
              </strong>
            </div>
          </div>
        </div>
        <div className="macros">
          <span className="macro">
            Protein <b>{Math.round(macros.protein)}g</b>
          </span>
          <span className="macro">
            Carbs <b>{Math.round(macros.carbs)}g</b>
          </span>
          <span className="macro">
            Fat <b>{Math.round(macros.fat)}g</b>
          </span>
          <span className="macro">
            Fiber <b>{Math.round(macros.fiber)}g</b>
          </span>
        </div>
      </section>

      <MealCapture />

      <section className="card">
        <h2>Meals</h2>
        <MealList meals={meals} />
      </section>

      <div style={{ marginBottom: 12 }}>
        <WorkoutForm weightKg={weight} />
      </div>

      <section className="card">
        <h2>Workouts</h2>
        <WorkoutList workouts={workouts} />
      </section>

      <Tabs />
    </main>
  );
}
