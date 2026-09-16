"use client";

import { mealCalories, mealMacros, store } from "@/lib/store";
import type { Meal, Workout } from "@/lib/types";
import { useState } from "react";

const WORKOUT_ICON: Record<Workout["type"], string> = {
  walk: "🚶",
  run: "🏃",
  strength: "🏋️",
  cycle: "🚴",
  swim: "🏊",
  other: "💪",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MealList({ meals, editable = true }: { meals: Meal[]; editable?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (meals.length === 0) return <p className="muted small">No meals logged yet.</p>;
  return (
    <ul className="list">
      {meals.map((m) => {
        const macros = mealMacros(m);
        const open = openId === m.id;
        return (
          <li key={m.id} style={{ flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", width: "100%" }} onClick={() => setOpenId(open ? null : m.id)}>
              {m.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={m.thumbnail} alt="" />
              ) : (
                <div className="thumb">🍽️</div>
              )}
              <div className="grow">
                <div className="title">{m.name}</div>
                <div className="sub">
                  {fmtTime(m.loggedAt)} · P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · F{" "}
                  {Math.round(macros.fat)}g
                </div>
              </div>
              <div className="kcal">{mealCalories(m)}</div>
            </div>
            {open && (
              <div style={{ width: "100%", paddingLeft: 68 }} className="small">
                <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                  {m.items.map((it, i) => (
                    <li key={i} style={{ display: "list-item", border: 0, padding: "2px 0" }}>
                      {it.name} <span className="muted">({it.portion})</span> · {Math.round(it.calories)} kcal
                    </li>
                  ))}
                </ul>
                {m.notes && <p className="muted" style={{ margin: "4px 0" }}>{m.notes}</p>}
                {m.userNote && <p className="muted" style={{ margin: "4px 0" }}>Your note: {m.userNote}</p>}
                {editable && (
                  <button className="btn small danger" onClick={() => store.removeMeal(m.id)}>
                    Delete meal
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function WorkoutList({ workouts, editable = true }: { workouts: Workout[]; editable?: boolean }) {
  if (workouts.length === 0) return <p className="muted small">No workouts logged yet.</p>;
  return (
    <ul className="list">
      {workouts.map((w) => (
        <li key={w.id}>
          <div className="thumb">{WORKOUT_ICON[w.type]}</div>
          <div className="grow">
            <div className="title" style={{ textTransform: "capitalize" }}>
              {w.type} · {w.minutes} min
            </div>
            <div className="sub">
              {fmtTime(w.loggedAt)}
              {w.note ? ` · ${w.note}` : ""}
            </div>
          </div>
          <div className="kcal">-{w.caloriesBurned}</div>
          {editable && (
            <button className="btn small danger" onClick={() => store.removeWorkout(w.id)} aria-label="Delete">
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
