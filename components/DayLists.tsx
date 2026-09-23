"use client";

import { errorMessage, fmtDay, mealCalories, mealMacros, photoFor, relogMeal, sameName, store, todayKey, useAppData } from "@/lib/store";
import { ItemsEditor } from "@/components/ItemsEditor";
import { PhotoThumb, PhotoViewer } from "@/components/PhotoViewer";
import { useTapOnly } from "@/lib/tap";
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

// `relogTo`: offer an "Add to <day>" button that logs a copy on that day.
export function MealList({ meals, editable = true, relogTo }: { meals: Meal[]; editable?: boolean; relogTo?: string }) {
  const data = useAppData();
  const { favorites } = data;
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relogged, setRelogged] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Meal | null>(null);
  if (meals.length === 0) return <p className="muted small">No meals logged yet.</p>;
  function run(fn: () => void, fallback: string) {
    try {
      fn();
      setError(null);
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }
  const remove = (id: string) => run(() => store.removeMeal(id), "Could not delete.");
  const isFavorite = (m: Meal) => favorites.some((f) => sameName(f.name, m.name));
  const toggleFavorite = (m: Meal) =>
    run(() => (isFavorite(m) ? store.removeFavorite(m.name) : store.addFavorite(m)), "Could not update favorites.");
  const relog = (m: Meal, day: string) =>
    run(() => {
      store.addMeal(relogMeal(m, day));
      setRelogged(m.id);
    }, "Could not add this meal.");
  return (
    <ul className="list">
      {error && (
        <li style={{ display: "block" }}>
          <p className="error" style={{ margin: 0 }}>{error}</p>
        </li>
      )}
      {meals.map((m) => {
        const macros = mealMacros(m);
        const open = openId === m.id;
        if (editingId === m.id) {
          return (
            <li key={m.id} style={{ display: "block" }}>
              <MealEditor meal={m} onDone={() => setEditingId(null)} />
            </li>
          );
        }
        return (
          <li key={m.id} style={{ flexWrap: "wrap" }}>
            <PhotoThumb src={m.thumbnail} name={m.name} onOpen={() => setViewing(m)} />
            <button
              type="button"
              className="disclosure"
              aria-expanded={open}
              aria-controls={`meal-${m.id}`}
              onClick={() => setOpenId(open ? null : m.id)}
            >
              <div className="grow">
                <div className="title">{m.name}</div>
                <div className="sub">
                  {fmtTime(m.loggedAt)} · P {Math.round(macros.protein)}g · C {Math.round(macros.carbs)}g · F{" "}
                  {Math.round(macros.fat)}g
                </div>
              </div>
              <div className="kcal">{mealCalories(m)}</div>
            </button>
            {open && (
              <div id={`meal-${m.id}`} style={{ width: "100%", paddingLeft: 68 }} className="small">
                <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
                  {m.items.map((it, i) => (
                    <li key={i} style={{ display: "list-item", border: 0, padding: "2px 0" }}>
                      {it.name} <span className="muted">({it.grams ? `${it.grams} g` : it.portion})</span> ·{" "}
                      {Math.round(it.calories)} kcal
                    </li>
                  ))}
                </ul>
                {m.notes && <p className="muted" style={{ margin: "4px 0" }}>{m.notes}</p>}
                {m.userNote && <p className="muted" style={{ margin: "4px 0" }}>Your note: {m.userNote}</p>}
                {editable && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="btn small" onClick={() => toggleFavorite(m)} aria-pressed={isFavorite(m)}>
                      {isFavorite(m) ? "★ Favorite" : "☆ Favorite"}
                    </button>
                    {relogTo && (
                      <RelogButton
                        label={relogged === m.id ? "Added ✓" : `Add to ${relogTo === todayKey() ? "today" : fmtDay(relogTo)}`}
                        disabled={relogged === m.id}
                        onTap={() => relog(m, relogTo)}
                      />
                    )}
                    <button className="btn small" onClick={() => setEditingId(m.id)}>
                      Edit ingredients
                    </button>
                    <button className="btn small danger" onClick={() => remove(m.id)}>
                      Delete meal
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
      {viewing && (
        <PhotoViewer
          src={photoFor(data, viewing)}
          alt={viewing.name}
          onClose={() => setViewing(null)}
        />
      )}
    </ul>
  );
}

export function WorkoutList({ workouts, editable = true }: { workouts: Workout[]; editable?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  if (workouts.length === 0) return <p className="muted small">No workouts logged yet.</p>;
  function remove(id: string) {
    try {
      store.removeWorkout(id);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Could not delete."));
    }
  }
  return (
    <ul className="list">
      {error && (
        <li style={{ display: "block" }}>
          <p className="error" style={{ margin: 0 }}>{error}</p>
        </li>
      )}
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
            <button className="btn small danger" onClick={() => remove(w.id)} aria-label="Delete workout">
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Logging a meal is a write, so it needs a deliberate tap (see useTapOnly).
function RelogButton({ label, disabled, onTap }: { label: string; disabled: boolean; onTap: () => void }) {
  const tap = useTapOnly(onTap);
  return (
    <button className="btn small" disabled={disabled} {...tap}>
      {label}
    </button>
  );
}

function MealEditor({ meal, onDone }: { meal: Meal; onDone: () => void }) {
  const [name, setName] = useState(meal.name);
  const [items, setItems] = useState(meal.items);
  const [error, setError] = useState<string | null>(null);
  function save() {
    try {
      store.updateMeal({ ...meal, name: name.trim() || "Meal", items: items.filter((i) => i.name.trim()) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not save."));
    }
  }
  return (
    <div>
      <div className="field">
        <label htmlFor={`edit-name-${meal.id}`}>Meal</label>
        <input id={`edit-name-${meal.id}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <ItemsEditor items={items} onChange={setItems} />
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onDone}>
          Cancel
        </button>
        <button className="btn primary" onClick={save}>
          Save changes
        </button>
      </div>
    </div>
  );
}
