"use client";

import { useState } from "react";
import { errorMessage, newId, store, todayKey } from "@/lib/store";

export function WeightForm({ current }: { current: number }) {
  const [kg, setKg] = useState(String(current));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const v = Number(kg);
    if (!v || v < 20 || v > 400) {
      setError("Enter a weight between 20 and 400 kg.");
      return;
    }
    try {
      store.addWeight({ id: newId(), date: todayKey(), kg: Math.round(v * 10) / 10 });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Could not save."));
    }
  }

  return (
    <>
    <div className="row" style={{ alignItems: "flex-end" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="kg">Today&apos;s weight (kg)</label>
        <input id="kg" type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} />
      </div>
      <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={save}>
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
    {error && <p className="error">{error}</p>}
    </>
  );
}
