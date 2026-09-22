"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { DayNav } from "@/components/DayNav";
import { Ring } from "@/components/Ring";
import { MealCapture } from "@/components/MealCapture";
import { WorkoutForm } from "@/components/WorkoutForm";
import { MealList, WorkoutList } from "@/components/DayLists";
import { fmtDay, isDayKey, latestWeight, mealCalories, mealMacros, shiftDay, todayKey, useAppData, useTodayLabel } from "@/lib/store";

// useSearchParams needs a Suspense boundary so the page can still prerender.
export default function DayPage() {
  return (
    <Suspense>
      <DayView />
    </Suspense>
  );
}

function DayView() {
  const data = useAppData();
  const todayLabel = useTodayLabel();
  const today = todayKey();
  const param = useSearchParams().get("date");
  // Future days aren't loggable, so ?date= in the future falls back to today.
  const day = isDayKey(param) && param <= today ? param : today;
  const isToday = day === today;
  const title = isToday ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : fmtDay(day);

  const byTime = (a: { loggedAt: string }, b: { loggedAt: string }) => (a.loggedAt < b.loggedAt ? 1 : -1);
  const meals = data.meals.filter((m) => m.date === day).sort(byTime);
  const workouts = data.workouts.filter((w) => w.date === day).sort(byTime);

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
        <h1>{title}</h1>
        {isToday && <span className="date">{todayLabel}</span>}
      </div>

      <DayNav day={day} />

      {!isToday && (
        <p className="backfill small">
          You&apos;re viewing a past day. Anything you log here is saved to {fmtDay(day)}.
        </p>
      )}

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

      <MealCapture key={day} date={day} />

      <section className="card">
        <h2>Meals</h2>
        <MealList meals={meals} />
      </section>

      <div style={{ marginBottom: 12 }}>
        <WorkoutForm key={day} weightKg={weight} date={day} />
      </div>

      <section className="card">
        <h2>Workouts</h2>
        <WorkoutList workouts={workouts} />
      </section>

      <Tabs />
    </main>
  );
}
