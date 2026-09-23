"use client";

import { useState } from "react";
import { errorMessage, mealCalories, relogMeal, sameName, store, useAppData } from "@/lib/store";
import type { Favorite, Meal } from "@/lib/types";

const RECENT_LIMIT = 5;

// One-tap re-logging of favorites and recent meals onto `day`, no photo needed.
export function QuickAdd({ day }: { day: string }) {
  const data = useAppData();
  const [added, setAdded] = useState<Meal | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const favorites = data.favorites;
  const recent: Meal[] = [];
  for (const m of [...data.meals].sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1))) {
    if (recent.length >= RECENT_LIMIT) break;
    if (m.date === day) continue;
    if (favorites.some((f) => sameName(f.name, m.name)) || recent.some((r) => sameName(r.name, m.name))) continue;
    recent.push(m);
  }
  if (favorites.length === 0 && recent.length === 0 && !added) return null;

  function run(fn: () => void, fallback: string) {
    try {
      fn();
      setError(null);
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }
  function add(src: Favorite | Meal) {
    const meal = relogMeal(src, day);
    run(() => {
      store.addMeal(meal);
      setAdded(meal);
    }, "Could not add this meal.");
  }
  function undo() {
    if (!added) return;
    run(() => {
      store.removeMeal(added.id);
      setAdded(null);
    }, "Could not undo.");
  }

  return (
    <div className="quickadd">
      {added && (
        <p className="quickadd-done small">
          Added {added.name}.{" "}
          <button className="linkish" onClick={undo}>
            Undo
          </button>
        </p>
      )}
      {favorites.length > 0 && (
        <>
          <div className="quickadd-head">
            <h3>★ Favorites</h3>
            <button className="linkish small" onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <ul className="list">
            {favorites.map((f) => (
              <Row key={f.id} meal={f} onAdd={() => add(f)}>
                {editing && (
                  <button
                    className="btn small danger"
                    aria-label={`Remove ${f.name} from favorites`}
                    onClick={() => run(() => store.removeFavorite(f.name), "Could not update favorites.")}
                  >
                    ✕
                  </button>
                )}
              </Row>
            ))}
          </ul>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="quickadd-head">
            <h3>Recent</h3>
          </div>
          <ul className="list">
            {recent.map((m) => (
              <Row key={m.id} meal={m} onAdd={() => add(m)} />
            ))}
          </ul>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Row({ meal, onAdd, children }: { meal: Favorite | Meal; onAdd: () => void; children?: React.ReactNode }) {
  const kcal = mealCalories(meal);
  return (
    <li>
      <button type="button" className="disclosure" onClick={onAdd} aria-label={`Add ${meal.name}, ${kcal} kcal`}>
        {meal.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="thumb" src={meal.thumbnail} alt="" />
        ) : (
          <div className="thumb">🍽️</div>
        )}
        <div className="grow">
          <div className="title">{meal.name}</div>
          <div className="sub">{kcal} kcal</div>
        </div>
        <span className="quickadd-plus" aria-hidden>
          +
        </span>
      </button>
      {children}
    </li>
  );
}
