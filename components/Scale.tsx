'use client';

// 1–7 scale as 7 big buttons (SPEC §7), labelled "Not at all" (1) and "Very much" (7).
// Native radios (visually hidden) give keyboard and screen reader behaviour for free.
export default function Scale({
  name,
  value,
  onChange,
  low,
  high,
}: {
  name: string;
  value: number | undefined;
  onChange: (value: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <label
            key={n}
            className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border text-lg font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet/50 ${
              value === n ? 'border-violet bg-violet text-white' : 'border-midnight/15 bg-white'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={n === 1 ? `1 · ${low}` : n === 7 ? `7 · ${high}` : String(n)}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs text-midnight/60">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
