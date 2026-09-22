"use client";

import { useRouter } from "next/navigation";
import { isDayKey, MIN_DAY, shiftDay, todayKey } from "@/lib/store";

export function dayHref(day: string): string {
  return day === todayKey() ? "/" : `/?date=${day}`;
}

export function DayNav({ day }: { day: string }) {
  const router = useRouter();
  const today = todayKey();
  const go = (d: string) => router.push(dayHref(d));

  return (
    <div className="daynav">
      <button className="btn small" onClick={() => go(shiftDay(day, -1))} disabled={day <= MIN_DAY} aria-label="Previous day">
        ←
      </button>
      <input
        type="date"
        aria-label="Pick a day"
        value={day}
        min={MIN_DAY}
        max={today}
        onChange={(e) => {
          const v = e.target.value;
          if (isDayKey(v) && v <= today) go(v);
        }}
      />
      <button className="btn small" onClick={() => go(shiftDay(day, 1))} disabled={day >= today} aria-label="Next day">
        →
      </button>
      {day !== today && (
        <button className="btn small" onClick={() => go(today)}>
          Today
        </button>
      )}
    </div>
  );
}
