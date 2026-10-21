'use client';

// 1–7 scale as 7 big buttons (SPEC §7), labelled "Not at all" (1) and "Very much" (7).
export default function Scale({
  value,
  onChange,
  labelledBy,
  low,
  high,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  labelledBy: string;
  low: string;
  high: string;
}) {
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={n === 1 ? `1 · ${low}` : n === 7 ? `7 · ${high}` : String(n)}
            onClick={() => onChange(n)}
            className={`aspect-square rounded-2xl border text-lg font-semibold ${
              value === n ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-midnight/60">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
