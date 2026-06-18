"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function WeeklySlaChart({ data }: { data: Array<{ semana: string; sla: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
        <XAxis dataKey="semana" tick={{ fill: "#3d536e", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis tickFormatter={(value) => `${value}%`} domain={[80, 100]} tick={{ fill: "#3d536e", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <ReferenceLine y={93} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Meta 93%", fill: "#92400e", fontSize: 12, position: "insideTopRight" }} />
        <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
        <Bar dataKey="sla" fill="#2563eb" radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailySlaChart({ data }: { data: Array<{ dia: string; sla: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
        <XAxis dataKey="dia" tick={{ fill: "#3d536e", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <YAxis tickFormatter={(value) => `${value}%`} domain={[80, 100]} tick={{ fill: "#3d536e", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
        <ReferenceLine y={93} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Meta 93%", fill: "#92400e", fontSize: 12, position: "insideTopRight" }} />
        <Tooltip formatter={(value) => (value == null ? "-" : `${Number(value).toFixed(2)}%`)} />
        <Line type="monotone" dataKey="sla" stroke="#16a34a" strokeWidth={3} dot={{ r: 3, fill: "#16a34a" }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
