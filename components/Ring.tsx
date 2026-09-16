export function Ring({
  eaten,
  limit,
}: {
  eaten: number;
  limit: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = limit > 0 ? Math.min(eaten / limit, 1) : 0;
  const over = eaten > limit;
  const remaining = limit - eaten;
  return (
    <div className="ring" aria-label={`${eaten} of ${limit} calories`}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={over ? "var(--danger)" : "var(--accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="label">
        <strong>{Math.abs(remaining)}</strong>
        <span>{over ? "over" : "left"}</span>
      </div>
    </div>
  );
}
