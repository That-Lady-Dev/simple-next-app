"use client";

import { useState } from "react";
import { errorMessage, estimateBurn, fmtDay, loggedAtFor, newId, store, todayKey } from "@/lib/store";
import type { WorkoutType } from "@/lib/types";

const TYPES: { value: WorkoutType; label: string }[] = [
  { value: "walk", label: "Walk" },
  { value: "run", label: "Run" },
  { value: "strength", label: "Strength / gym" },
  { value: "cycle", label: "Cycling" },
  { value: "swim", label: "Swim" },
  { value: "other", label: "Other" },
];

export function WorkoutForm({ weightKg, date = todayKey() }: { weightKg: number; date?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<WorkoutType>("walk");
  const [minutes, setMinutes] = useState("30");
  const [burn, setBurn] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mins = Number(minutes) || 0;
  const suggested = estimateBurn(type, mins, weightKg);

  function save() {
    if (mins <= 0) return;
    try {
      store.addWorkout({
        id: newId(),
        date,
        loggedAt: loggedAtFor(date),
        type,
        minutes: mins,
        caloriesBurned: burn === "" ? suggested : Number(burn) || 0,
        note: note.trim(),
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save."));
      return;
    }
    setError(null);
    setOpen(false);
    setMinutes("30");
    setBurn("");
    setNote("");
  }

  if (!open) {
    return (
      <button className="btn block" onClick={() => setOpen(true)}>
        🏃 Log a workout
      </button>
    );
  }

  return (
    <div className="card">
      <h2>{date === todayKey() ? "Log a workout" : `Log a workout for ${fmtDay(date)}`}</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="wtype">Type</label>
          <select id="wtype" value={type} onChange={(e) => setType(e.target.value as WorkoutType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wmin">Minutes</label>
          <input
            id="wmin"
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wburn">Calories burned (from your watch, or leave blank for an estimate of {suggested})</label>
        <input
          id="wburn"
          type="number"
          inputMode="numeric"
          placeholder={String(suggested)}
          value={burn}
          onChange={(e) => setBurn(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="wnote">Note (optional)</label>
        <input id="wnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. walk along the river" />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={mins <= 0}>
          Save
        </button>
      </div>
    </div>
  );
}
