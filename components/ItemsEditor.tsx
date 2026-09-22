"use client";

import { useRef, useState } from "react";
import { scaleItem } from "@/lib/store";
import type { FoodItem } from "@/lib/schema";

const EMPTY_ITEM: FoodItem = {
  name: "",
  portion: "",
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
};

const num = (v: string) => (v === "" ? 0 : Number(v));

export function ItemsEditor({
  items,
  onChange,
}: {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const total = Math.round(items.reduce((s, i) => s + (i.calories || 0), 0));

  function update(idx: number, patch: Partial<FoodItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
    setOpenIdx(null);
  }
  function add() {
    onChange([...items, { ...EMPTY_ITEM }]);
    setOpenIdx(items.length);
  }

  return (
    <div className="items">
      {items.map((it, i) => {
        const open = openIdx === i;
        return (
          <div className="item" key={i}>
            <div className="item-top">
              <input
                className="item-name"
                value={it.name}
                placeholder="Ingredient"
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <input
                className="item-kcal"
                type="number"
                inputMode="numeric"
                aria-label="Calories"
                value={it.calories}
                onChange={(e) => update(i, { calories: num(e.target.value) })}
              />
              <span className="muted small">kcal</span>
              <button
                className={`btn small${open ? " active" : ""}`}
                onClick={() => setOpenIdx(open ? null : i)}
                aria-label={open ? "Hide details" : "Edit details"}
              >
                {open ? "▴" : "▾"}
              </button>
            </div>
            <div className="item-grams">
              <GramsInput item={it} onChange={(next) => onChange(items.map((x, j) => (j === i ? next : x)))} />
              <span className="muted small">
                {it.grams ? "g · change to rescale" : "g · set the weight to rescale later"}
              </span>
            </div>
            {!open && (
              <div className="item-sub muted small" onClick={() => setOpenIdx(i)}>
                {it.portion && <span>{it.portion}</span>}
                <span>
                  P {Math.round(it.protein_g)}g · C {Math.round(it.carbs_g)}g · F {Math.round(it.fat_g)}g
                </span>
              </div>
            )}
            {open && (
              <div className="item-detail">
                <div className="field">
                  <label htmlFor={`portion-${i}`}>Portion</label>
                  <input
                    id={`portion-${i}`}
                    value={it.portion}
                    placeholder="e.g. 1 bowl (~400 g)"
                    onChange={(e) => update(i, { portion: e.target.value })}
                  />
                </div>
                <div className="macro-grid">
                  <MacroField id={`p-${i}`} label="Protein g" value={it.protein_g} onChange={(v) => update(i, { protein_g: v })} />
                  <MacroField id={`c-${i}`} label="Carbs g" value={it.carbs_g} onChange={(v) => update(i, { carbs_g: v })} />
                  <MacroField id={`f-${i}`} label="Fat g" value={it.fat_g} onChange={(v) => update(i, { fat_g: v })} />
                  <MacroField id={`fi-${i}`} label="Fiber g" value={it.fiber_g} onChange={(v) => update(i, { fiber_g: v })} />
                </div>
                <button className="btn small danger" onClick={() => remove(i)}>
                  Remove ingredient
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div className="item-total">
        <button className="btn small" onClick={add}>
          + Add ingredient
        </button>
        <strong>{total} kcal</strong>
      </div>
    </div>
  );
}

// Editing the weight rescales calories and macros from the item as it was when
// the field was focused, so intermediate keystrokes don't compound rounding.
// An empty or zero entry is left as a draft and never applied.
function GramsInput({ item, onChange }: { item: FoodItem; onChange: (item: FoodItem) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const base = useRef<FoodItem | null>(null);
  return (
    <input
      className="item-g"
      type="number"
      inputMode="decimal"
      min={0}
      aria-label={`Grams of ${item.name || "ingredient"}`}
      placeholder="g"
      value={draft ?? (item.grams ? String(item.grams) : "")}
      onFocus={() => {
        base.current = item;
      }}
      onBlur={() => {
        base.current = null;
        setDraft(null);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const g = Number(e.target.value);
        if (e.target.value === "" || !(g > 0)) return;
        onChange(scaleItem(base.current ?? item, Math.round(g * 10) / 10));
      }}
    />
  );
}

function MacroField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(num(e.target.value))}
      />
    </div>
  );
}
