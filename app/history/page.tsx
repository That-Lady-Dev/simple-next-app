"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/Tabs";
import { MealList, WorkoutList } from "@/components/DayLists";
import { dayHref } from "@/components/DayNav";
import { fmtDay, isDayKey, mealCalories, mealMacros, shiftDay, todayKey, useAppData } from "@/lib/store";

export default function HistoryPage() {
  const data = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const today = todayKey();
  const [pick, setPick] = useState(() => shiftDay(today, -1));

  const days = new Set<string>();
  data.meals.forEach((m) => days.add(m.date));
  data.workouts.forEach((w) => days.add(w.date));
  const sorted = [...days].sort((a, b) => (a < b ? 1 : -1));

  const weights = [...data.weights].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <main className="container">
      <div className="topbar">
        <h1>History</h1>
      </div>

      <section className="card">
        <h2>Weight</h2>
        {weights.length < 2 ? (
          <p className="muted small">Log your weight on the Settings tab. A chart appears once you have two entries.</p>
        ) : (
          <WeightChart points={weights.map((w) => w.kg)} goal={data.settings.goalWeightKg} />
        )}
        {weights.length > 0 && (
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            Start {data.settings.startWeightKg} kg · Now {weights[weights.length - 1].kg} kg · Goal {data.settings.goalWeightKg} kg
          </p>
        )}
      </section>

      <section className="card">
        <h2>Forgot to log a day?</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Pick the date, then add meals or workouts to it as usual.
        </p>
        <div className="row">
          <div className="field" style={{ marginBottom: 0 }}>
            <input
              type="date"
              aria-label="Day to add food to"
              value={pick}
              max={today}
              onChange={(e) => setPick(e.target.value)}
            />
          </div>
          <button
            className="btn primary"
            style={{ flex: "0 0 auto" }}
            disabled={!isDayKey(pick) || pick > today}
            onClick={() => router.push(dayHref(pick))}
          >
            Add food
          </button>
        </div>
      </section>

      {sorted.length === 0 && <p className="muted">Nothing logged yet.</p>}

      {sorted.map((day) => {
        const meals = data.meals.filter((m) => m.date === day).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
        const workouts = data.workouts.filter((w) => w.date === day).sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
        const eaten = meals.reduce((s, m) => s + mealCalories(m), 0);
        const macros = meals.reduce(
          (acc, m) => {
            const mm = mealMacros(m);
            return { protein: acc.protein + mm.protein, carbs: acc.carbs + mm.carbs, fat: acc.fat + mm.fat };
          },
          { protein: 0, carbs: 0, fat: 0 },
        );
        const burned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
        const over = eaten > data.settings.dailyCalorieLimit;
        const isOpen = open === day;
        return (
          <section className="card" key={day}>
            <button
              type="button"
              className="disclosure"
              aria-expanded={isOpen}
              aria-controls={`day-${day}`}
              onClick={() => setOpen(isOpen ? null : day)}
            >
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{fmtDay(day)}</div>
                <div className="muted small">
                  {meals.length} meal{meals.length === 1 ? "" : "s"} · {workouts.length} workout{workouts.length === 1 ? "" : "s"} · burned {burned}
                </div>
              </div>
              <div className="kcal" style={{ color: over ? "var(--danger)" : "var(--accent)" }}>
                {eaten}
              </div>
            </button>
            {isOpen && (
              <div id={`day-${day}`} style={{ marginTop: 12 }}>
                <div className="macros" style={{ marginTop: 0, marginBottom: 8 }}>
                  <span className="macro">
                    Protein <b>{Math.round(macros.protein)}g</b>
                  </span>
                  <span className="macro">
                    Carbs <b>{Math.round(macros.carbs)}g</b>
                  </span>
                  <span className="macro">
                    Fat <b>{Math.round(macros.fat)}g</b>
                  </span>
                </div>
                <MealList meals={meals} />
                {workouts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <WorkoutList workouts={workouts} />
                  </div>
                )}
                <Link className="btn block" style={{ marginTop: 12 }} href={dayHref(day)}>
                  ➕ Add food to {day === today ? "today" : fmtDay(day)}
                </Link>
              </div>
            )}
          </section>
        );
      })}

      <Tabs />
    </main>
  );
}

function WeightChart({ points, goal }: { points: number[]; goal: number }) {
  const w = 320;
  const h = 160;
  const pad = 12;
  const all = [...points, goal];
  const min = Math.min(...all) - 1;
  const max = Math.max(...all) + 1;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1={pad} x2={w - pad} y1={y(goal)} y2={y(goal)} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p)} r="3" fill="var(--accent)" />
      ))}
    </svg>
  );
}
