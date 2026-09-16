"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { MealList, WorkoutList } from "@/components/DayLists";
import { mealCalories, useAppData } from "@/lib/store";

function fmtDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export default function HistoryPage() {
  const data = useAppData();
  const [open, setOpen] = useState<string | null>(null);

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

      {sorted.length === 0 && <p className="muted">Nothing logged yet.</p>}

      {sorted.map((day) => {
        const meals = data.meals.filter((m) => m.date === day);
        const workouts = data.workouts.filter((w) => w.date === day);
        const eaten = meals.reduce((s, m) => s + mealCalories(m), 0);
        const burned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
        const over = eaten > data.settings.dailyCalorieLimit;
        const isOpen = open === day;
        return (
          <section className="card" key={day}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => setOpen(isOpen ? null : day)}>
              <div>
                <div style={{ fontWeight: 600 }}>{fmtDay(day)}</div>
                <div className="muted small">
                  {meals.length} meal{meals.length === 1 ? "" : "s"} · {workouts.length} workout{workouts.length === 1 ? "" : "s"} · burned {burned}
                </div>
              </div>
              <div className="kcal" style={{ color: over ? "var(--danger)" : "var(--accent)" }}>
                {eaten}
              </div>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12 }}>
                <MealList meals={meals} />
                {workouts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <WorkoutList workouts={workouts} />
                  </div>
                )}
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
