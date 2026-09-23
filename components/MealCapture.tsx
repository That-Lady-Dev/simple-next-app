"use client";

import { useRef, useState } from "react";
import { prepareImage } from "@/lib/image";
import { errorMessage, fmtDay, loggedAtFor, newId, store, todayKey } from "@/lib/store";
import { getAppKey } from "@/lib/auth";
import { ItemsEditor } from "@/components/ItemsEditor";
import { QuickAdd } from "@/components/QuickAdd";
import type { Analysis, FoodItem } from "@/lib/schema";
import type { Meal } from "@/lib/types";

type Photo = { dataUrl: string; thumbnail: string } | null;

// The analysis as the user edits it: hand-added ingredients may have no weight.
type Draft = Omit<Analysis, "items"> & { items: FoodItem[] };

type Stage =
  | { kind: "idle" }
  | { kind: "photo"; photo: NonNullable<Photo> }
  | { kind: "text" }
  | { kind: "analyzing"; photo: Photo }
  | { kind: "review"; photo: Photo; analysis: Draft };

export function MealCapture({ date = todayKey(), onSaved }: { date?: string; onSaved?: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [note, setNote] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const photo = await prepareImage(file);
      setStage({ kind: "photo", photo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function analyze() {
    const photo = stage.kind === "photo" || stage.kind === "analyzing" || stage.kind === "review" ? stage.photo : null;
    if (!photo && !note.trim()) {
      setError("Describe what you ate first.");
      return;
    }
    const before = stage;
    setStage({ kind: "analyzing", photo });
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": getAppKey() },
        body: JSON.stringify({ image: photo?.dataUrl, note }),
      });
      const json = (await res.json()) as { analysis?: Analysis; error?: string };
      if (!res.ok || !json.analysis) throw new Error(json.error ?? `Request failed (${res.status})`);
      setStage({ kind: "review", photo, analysis: json.analysis });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage(before.kind === "analyzing" ? (photo ? { kind: "photo", photo } : { kind: "text" }) : before);
    }
  }

  function setItems(items: FoodItem[]) {
    if (stage.kind !== "review") return;
    setStage({ ...stage, analysis: { ...stage.analysis, items } });
  }

  function save() {
    if (stage.kind !== "review") return;
    const meal: Meal = {
      id: newId(),
      date,
      loggedAt: loggedAtFor(date),
      name: stage.analysis.meal_name || "Meal",
      items: stage.analysis.items.filter((i) => i.name.trim()),
      confidence: stage.analysis.confidence,
      notes: stage.analysis.notes,
      userNote: note,
      thumbnail: stage.photo?.thumbnail,
    };
    try {
      store.addMeal(meal, { favorite });
    } catch (err) {
      setError(errorMessage(err, "Could not save this meal."));
      return;
    }
    reset();
    onSaved?.();
  }

  function reset() {
    setStage({ kind: "idle" });
    setNote("");
    setFavorite(false);
    setError(null);
  }

  const busy = stage.kind === "analyzing";
  const photo = stage.kind === "photo" || stage.kind === "analyzing" || stage.kind === "review" ? stage.photo : null;

  return (
    <div className="card">
      <h2>{date === todayKey() ? "Log a meal" : `Log a meal for ${fmtDay(date)}`}</h2>
      <input
        ref={cameraRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
      />
      <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={onPick} />

      {stage.kind === "idle" && (
        <>
          <div className="row">
            <button className="btn primary" onClick={() => cameraRef.current?.click()}>
              📷 Take photo
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              🖼️ Upload
            </button>
          </div>
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => setStage({ kind: "text" })}>
            ✍️ Type it instead
          </button>
          <QuickAdd day={date} />
        </>
      )}

      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="preview" src={photo.dataUrl} alt="Meal preview" />
      )}

      {(stage.kind === "photo" || stage.kind === "text" || busy) && (
        <>
          <div className="field">
            <label htmlFor="note">
              {photo
                ? "Anything to add? Optional, but it improves accuracy."
                : "What did you eat? Be as specific as you can."}
            </label>
            <textarea
              id="note"
              rows={photo ? 2 : 3}
              placeholder={
                photo
                  ? "e.g. phở bò, large bowl, I ate half. Or: bánh mì with extra pâté."
                  : "e.g. 2 bánh mì thịt and a cà phê sữa đá. Or: 3 boiled eggs and a dragon fruit smoothie."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              autoFocus={stage.kind === "text"}
            />
          </div>
          <div className="row">
            <button className="btn" onClick={reset} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={analyze} disabled={busy || (!photo && !note.trim())}>
              {busy ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
        </>
      )}

      {stage.kind === "review" && (
        <>
          <div className="field">
            <label htmlFor="mealname">Meal</label>
            <input
              id="mealname"
              value={stage.analysis.meal_name}
              onChange={(e) => setStage({ ...stage, analysis: { ...stage.analysis, meal_name: e.target.value } })}
            />
          </div>

          <p className="small" style={{ margin: "0 0 8px" }}>
            <span className={`conf ${stage.analysis.confidence}`}>{stage.analysis.confidence} confidence</span>{" "}
            <span className="muted">{stage.analysis.notes}</span>
          </p>

          <ItemsEditor items={stage.analysis.items} onChange={setItems} />

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="note2">Not quite right? Add a correction and re-analyze.</label>
            <textarea
              id="note2"
              rows={2}
              placeholder="e.g. that is a small bowl, and the drink is unsweetened"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <label className="checkline">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            ★ Save as a favorite so you can re-add it in one tap
          </label>

          <div className="row">
            <button className="btn" onClick={reset}>
              Discard
            </button>
            <button className="btn" onClick={analyze}>
              Re-analyze
            </button>
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
