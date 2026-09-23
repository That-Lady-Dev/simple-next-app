"use client";

import { useRef, useState } from "react";
import { Tabs } from "@/components/Tabs";
import { WeightForm } from "@/components/WeightForm";
import { errorMessage, findDuplicateMeals, latestWeight, store, useAppData } from "@/lib/store";
import { getAppKey, setAppKey } from "@/lib/auth";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const data = useAppData();
  const [msg, setMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kcal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      store.importJson(await file.text());
      setMsg("Backup restored.");
    } catch (err) {
      setMsg(errorMessage(err, "Could not import that file."));
    }
  }

  const duplicates = findDuplicateMeals(data.meals);

  function removeDuplicates() {
    const names = [...new Set(duplicates.map((m) => m.name))].join(", ");
    if (!window.confirm(`Delete ${duplicates.length} duplicate meal${duplicates.length === 1 ? "" : "s"} (${names})? One copy of each is kept.`)) return;
    try {
      store.removeMeals(duplicates.map((m) => m.id));
      setMsg(`Removed ${duplicates.length} duplicate meal${duplicates.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setMsg(errorMessage(err, "Could not remove duplicates."));
    }
  }

  function reset() {
    if (window.confirm("Delete all meals, workouts, and weights on this device? Export first if you want a copy.")) {
      try {
        store.reset();
        setMsg("All data cleared.");
      } catch (err) {
        setMsg(errorMessage(err, "Could not clear data."));
      }
    }
  }

  return (
    <main className="container">
      <div className="topbar">
        <h1>Settings</h1>
      </div>

      <section className="card">
        <h2>Weight</h2>
        {/* Keyed so the input picks up a restored backup or a newly saved weight. */}
        <WeightForm key={latestWeight(data)} current={latestWeight(data)} />
      </section>

      <AppPasswordForm />

      {/* Keyed on the stored values so the form re-initialises once localStorage has loaded. */}
      <TargetsForm key={JSON.stringify(data.settings)} settings={data.settings} />

      <section className="card">
        <h2>Data</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Everything is stored on this device only. Export a backup now and then, especially before switching phones.
        </p>
        <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
        <div className="row">
          <button className="btn" onClick={exportData}>
            Export backup
          </button>
          <button className="btn" onClick={() => importRef.current?.click()}>
            Import backup
          </button>
        </div>
        {duplicates.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button className="btn block" onClick={removeDuplicates}>
              🧹 Remove {duplicates.length} duplicate meal{duplicates.length === 1 ? "" : "s"}
            </button>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Meals logged more than once within the same minute. One copy of each is kept.
            </p>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <button className="btn danger block" onClick={reset}>
            Clear all data
          </button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
      </section>

      <Tabs />
    </main>
  );
}

function AppPasswordForm() {
  const [value, setValue] = useState(() => (typeof window === "undefined" ? "" : getAppKey()));
  const [saved, setSaved] = useState(false);
  function save() {
    setAppKey(value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <section className="card">
      <h2>App password</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Must match the APP_PASSWORD set on the server. It stops anyone else who finds the URL from using your
        Anthropic credits.
      </p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="appkey">Password</label>
          <input
            id="appkey"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={save}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </section>
  );
}

function TargetsForm({ settings }: { settings: Settings }) {
  const [limit, setLimit] = useState(String(settings.dailyCalorieLimit));
  const [goal, setGoal] = useState(String(settings.goalWeightKg));
  const [start, setStart] = useState(String(settings.startWeightKg));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    try {
      store.saveSettings({
        dailyCalorieLimit: Math.max(500, Number(limit) || 0),
        goalWeightKg: Number(goal) || settings.goalWeightKg,
        startWeightKg: Number(start) || settings.startWeightKg,
      });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Could not save."));
    }
  }

  return (
    <section className="card">
      <h2>Targets</h2>
      <div className="field">
        <label htmlFor="limit">Daily calorie limit (kcal)</label>
        <input id="limit" type="number" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="start">Starting weight (kg)</label>
          <input id="start" type="number" inputMode="decimal" step="0.1" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="goal">Goal weight (kg)</label>
          <input id="goal" type="number" inputMode="decimal" step="0.1" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        {saved ? "Saved ✓" : "Save targets"}
      </button>
    </section>
  );
}
