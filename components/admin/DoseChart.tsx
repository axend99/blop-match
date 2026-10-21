'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Mean satisfaction (1–7) by number of shared items.
export default function DoseChart({ data }: { data: { bucket: string; value: number | null }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : '—')} />
          <Bar dataKey="value" name="Satisfação média" fill="#5b3cf5" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
