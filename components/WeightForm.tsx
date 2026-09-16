"use client";

import { useState } from "react";
import { newId, store, todayKey } from "@/lib/store";

export function WeightForm({ current }: { current: number }) {
  const [kg, setKg] = useState(String(current));
  const [saved, setSaved] = useState(false);

  function save() {
    const v = Number(kg);
    if (!v || v < 20 || v > 400) return;
    store.addWeight({ id: newId(), date: todayKey(), kg: Math.round(v * 10) / 10 });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="row" style={{ alignItems: "flex-end" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="kg">Today&apos;s weight (kg)</label>
        <input id="kg" type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} />
      </div>
      <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={save}>
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
