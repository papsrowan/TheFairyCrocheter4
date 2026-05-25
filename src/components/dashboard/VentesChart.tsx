"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT VentesChart — Graphique du CA sur les 7 derniers jours
// Recharts AreaChart + ComposedChart pour CA + nb ventes
// ─────────────────────────────────────────────────────────────────────────────

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface JourData {
  date:  string; // "2024-04-15"
  total: number;
  nb:    number;
}

interface Props {
  data:         JourData[];
  showFinances: boolean;
}

function formatDateCourt(iso: string): string {
  const d = new Date(iso + "T12:00:00"); // éviter décalage UTC
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(d);
}

function formatEur(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k XAF`;
  return `${n.toFixed(0)} XAF`;
}

// Tooltip personnalisé
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name} :</span>
          <span className="font-medium text-gray-900">
            {entry.name === "CA"
              ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(entry.value) + " XAF"
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VentesChart({ data, showFinances }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDateCourt(d.date),
  }));

  const maxCA = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">Activité — 7 derniers jours</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ventes complétées uniquement</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />

          {showFinances && (
            <YAxis
              yAxisId="ca"
              orientation="left"
              tickFormatter={formatEur}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              domain={[0, maxCA * 1.2]}
              width={60}
            />
          )}

          <YAxis
            yAxisId="nb"
            orientation="right"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={30}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            formatter={(value) => <span className="text-gray-600">{value}</span>}
          />

          {showFinances && (
            <Area
              yAxisId="ca"
              type="monotone"
              dataKey="total"
              name="CA"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradCA)"
              dot={{ r: 3, fill: "#6366f1" }}
              activeDot={{ r: 5 }}
            />
          )}

          <Bar
            yAxisId="nb"
            dataKey="nb"
            name="Ventes"
            fill="#e0e7ff"
            stroke="#a5b4fc"
            strokeWidth={1}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
