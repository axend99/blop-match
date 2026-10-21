'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Funnel by group, in % (numbers only come from the server).
export default function FunnelChart({ data }: { data: { label: string; compatible: number | null; control: number | null }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
          <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—')} />
          <Legend />
          <Bar dataKey="compatible" name="Compatível" fill="#5b3cf5" radius={[6, 6, 0, 0]} />
          <Bar dataKey="control" name="Controlo" fill="#e3a6f5" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
