"use client";

import { useRef, useState } from "react";
import { prepareImage } from "@/lib/image";
import { mealCalories, newId, store, todayKey } from "@/lib/store";
import type { Analysis, FoodItem } from "@/lib/schema";
import type { Meal } from "@/lib/types";

type Stage =
  | { kind: "idle" }
  | { kind: "picked"; dataUrl: string; thumbnail: string }
  | { kind: "analyzing"; dataUrl: string; thumbnail: string }
  | { kind: "review"; dataUrl: string; thumbnail: string; analysis: Analysis };

export function MealCapture({ onSaved }: { onSaved?: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const { dataUrl, thumbnail } = await prepareImage(file);
      setStage({ kind: "picked", dataUrl, thumbnail });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function analyze() {
    if (stage.kind !== "picked" && stage.kind !== "review") return;
    const { dataUrl, thumbnail } = stage;
    setStage({ kind: "analyzing", dataUrl, thumbnail });
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, note }),
      });
      const json = (await res.json()) as { analysis?: Analysis; error?: string };
      if (!res.ok || !json.analysis) throw new Error(json.error ?? `Request failed (${res.status})`);
      setStage({ kind: "review", dataUrl, thumbnail, analysis: json.analysis });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage({ kind: "picked", dataUrl, thumbnail });
    }
  }

  function updateItem(idx: number, patch: Partial<FoodItem>) {
    if (stage.kind !== "review") return;
    const items = stage.analysis.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setStage({ ...stage, analysis: { ...stage.analysis, items } });
  }

  function removeItem(idx: number) {
    if (stage.kind !== "review") return;
    const items = stage.analysis.items.filter((_, i) => i !== idx);
    setStage({ ...stage, analysis: { ...stage.analysis, items } });
  }

  function addItem() {
    if (stage.kind !== "review") return;
    const items = [
      ...stage.analysis.items,
      { name: "", portion: "", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    ];
    setStage({ ...stage, analysis: { ...stage.analysis, items } });
  }

  function save() {
    if (stage.kind !== "review") return;
    const meal: Meal = {
      id: newId(),
      date: todayKey(),
      loggedAt: new Date().toISOString(),
      name: stage.analysis.meal_name || "Meal",
      items: stage.analysis.items.filter((i) => i.name.trim()),
      confidence: stage.analysis.confidence,
      notes: stage.analysis.notes,
      userNote: note,
      thumbnail: stage.thumbnail,
    };
    store.addMeal(meal);
    setStage({ kind: "idle" });
    setNote("");
    onSaved?.();
  }

  function reset() {
    setStage({ kind: "idle" });
    setNote("");
    setError(null);
  }

  return (
    <div className="card">
      <h2>Log a meal</h2>
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
        <div className="row">
          <button className="btn primary" onClick={() => cameraRef.current?.click()}>
            📷 Take photo
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            🖼️ Upload
          </button>
        </div>
      )}

      {stage.kind !== "idle" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="preview" src={stage.dataUrl} alt="Meal preview" />
      )}

      {(stage.kind === "picked" || stage.kind === "analyzing") && (
        <>
          <div className="field">
            <label htmlFor="note">Anything to add? (optional, but it improves accuracy)</label>
            <textarea
              id="note"
              rows={2}
              placeholder="e.g. phở bò, large bowl, I ate half. Or: bánh mì with extra pâté."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={stage.kind === "analyzing"}
            />
          </div>
          <div className="row">
            <button className="btn" onClick={reset} disabled={stage.kind === "analyzing"}>
              Cancel
            </button>
            <button className="btn primary" onClick={analyze} disabled={stage.kind === "analyzing"}>
              {stage.kind === "analyzing" ? (
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
        <ReviewPanel
          analysis={stage.analysis}
          note={note}
          setNote={setNote}
          onRename={(meal_name) => setStage({ ...stage, analysis: { ...stage.analysis, meal_name } })}
          updateItem={updateItem}
          removeItem={removeItem}
          addItem={addItem}
          reanalyze={analyze}
          save={save}
          cancel={reset}
        />
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ReviewPanel(props: {
  analysis: Analysis;
  note: string;
  setNote: (s: string) => void;
  onRename: (s: string) => void;
  updateItem: (i: number, p: Partial<FoodItem>) => void;
  removeItem: (i: number) => void;
  addItem: () => void;
  reanalyze: () => void;
  save: () => void;
  cancel: () => void;
}) {
  const { analysis } = props;
  const total = mealCalories({ items: analysis.items } as Meal);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <>
      <div className="field">
        <label htmlFor="mealname">Meal</label>
        <input id="mealname" value={analysis.meal_name} onChange={(e) => props.onRename(e.target.value)} />
      </div>

      <p className="small" style={{ margin: "0 0 8px" }}>
        <span className={`conf ${analysis.confidence}`}>{analysis.confidence} confidence</span>{" "}
        <span className="muted">{analysis.notes}</span>
      </p>

      <div className="items">
        {analysis.items.map((it, i) => (
          <div className="item" key={i}>
            <div className="item-top">
              <input
                className="item-name"
                value={it.name}
                placeholder="Item"
                onChange={(e) => props.updateItem(i, { name: e.target.value })}
              />
              <input
                className="item-kcal"
                type="number"
                inputMode="numeric"
                aria-label="Calories"
                value={it.calories}
                onChange={(e) => props.updateItem(i, { calories: num(e.target.value) })}
              />
              <span className="muted small">kcal</span>
              <button className="btn small danger" onClick={() => props.removeItem(i)} aria-label="Remove item">
                ✕
              </button>
            </div>
            <div className="item-sub muted small">
              {it.portion && <span>{it.portion}</span>}
              <span>
                P {Math.round(it.protein_g)}g · C {Math.round(it.carbs_g)}g · F {Math.round(it.fat_g)}g
              </span>
            </div>
          </div>
        ))}
        <div className="item-total">
          <span>Total</span>
          <strong>{total} kcal</strong>
        </div>
      </div>

      <div style={{ margin: "8px 0 12px" }}>
        <button className="btn small" onClick={props.addItem}>
          + Add item
        </button>
      </div>

      <div className="field">
        <label htmlFor="note2">Not quite right? Add a correction and re-analyze.</label>
        <textarea
          id="note2"
          rows={2}
          placeholder="e.g. that is a small bowl, and the drink is unsweetened"
          value={props.note}
          onChange={(e) => props.setNote(e.target.value)}
        />
      </div>

      <div className="row">
        <button className="btn" onClick={props.cancel}>
          Discard
        </button>
        <button className="btn" onClick={props.reanalyze}>
          Re-analyze
        </button>
        <button className="btn primary" onClick={props.save}>
          Save
        </button>
      </div>
    </>
  );
}
