"use client";

import { useState } from "react";
import { errorMessage, mealCalories, photoFor, relogMeal, sameName, store, useAppData } from "@/lib/store";
import { PhotoThumb, PhotoViewer } from "@/components/PhotoViewer";
import type { Favorite, Meal } from "@/lib/types";

const RECENT_LIMIT = 5;

// One-tap re-logging of favorites and recent meals onto `day`, no photo needed.
export function QuickAdd({ day }: { day: string }) {
  const data = useAppData();
  const [added, setAdded] = useState<Meal | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Favorite | Meal | null>(null);
  // Collapsed by default: an open list of past meals reads as if they were
  // already logged on this day.
  const [open, setOpen] = useState(false);

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
      setOpen(false);
    }, "Could not add this meal.");
  }
  function undo() {
    if (!added) return;
    run(() => {
      store.removeMeal(added.id);
      setAdded(null);
    }, "Could not undo.");
  }

  const count = favorites.length + recent.length;

  return (
    <div className="quickadd">
      <button className="btn block" aria-expanded={open} onClick={() => setOpen(!open)}>
        🔁 Add a meal you&apos;ve had before ({count})
      </button>
      {added && (
        <p className="quickadd-done" role="status">
          <span>✓ Logged {added.name}</span>
          <button className="btn small" onClick={undo}>
            Undo
          </button>
        </p>
      )}
      {open && favorites.length > 0 && (
        <>
          <div className="quickadd-head">
            <h3>★ Favorites · tap to add</h3>
            <button className="linkish small" onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <ul className="list">
            {favorites.map((f) => (
              <Row key={f.id} meal={f} onAdd={() => add(f)} onView={() => setViewing(f)}>
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
      {open && recent.length > 0 && (
        <>
          <div className="quickadd-head">
            <h3>Recent · tap to add</h3>
          </div>
          <ul className="list">
            {recent.map((m) => (
              <Row key={m.id} meal={m} onAdd={() => add(m)} onView={() => setViewing(m)} />
            ))}
          </ul>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {viewing && (
        <PhotoViewer src={photoFor(data, viewing)} alt={viewing.name} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function Row({
  meal,
  onAdd,
  onView,
  children,
}: {
  meal: Favorite | Meal;
  onAdd: () => void;
  onView: () => void;
  children?: React.ReactNode;
}) {
  const kcal = mealCalories(meal);
  // Only the + button logs a meal. Tapping the photo or the name opens the
  // photo, so browsing this list can never log something by accident.
  return (
    <li className="quickadd-row">
      <PhotoThumb src={meal.thumbnail} name={meal.name} onOpen={onView} />
      <button type="button" className="disclosure" onClick={onView} aria-label={`View ${meal.name}`}>
        <div className="grow">
          <div className="title">{meal.name}</div>
          <div className="sub">{kcal} kcal</div>
        </div>
      </button>
      <button type="button" className="quickadd-plus" onClick={onAdd} aria-label={`Log ${meal.name}, ${kcal} kcal`}>
        +
      </button>
      {children}
    </li>
  );
}
