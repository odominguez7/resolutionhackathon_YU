import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";

const zoneColors: Record<string, string> = {
  peak: "#10b981",
  productive: "#3b82f6",
  dip: "#f59e0b",
  low: "#f59e0b",
  waking: "#8b5cf6",
  recovery: "#8b5cf6",
  sleep: "#1e293b",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl px-4 py-3 border border-white/10 text-xs"
         style={{ background: "rgba(15,22,49,0.95)", backdropFilter: "blur(12px)" }}>
      <p className="font-bold text-white">{d.emoji} {d.hour_label} — {d.label}</p>
      <p className="text-slate-400">Energy: <b style={{ color: zoneColors[d.zone] }}>{d.energy}%</b></p>
    </div>
  );
};

interface Props {
  curve: any[];
  events?: any[];
  peakWindows?: any[];
  dipWindows?: any[];
}

const EnergyCurve = ({ curve, events = [], peakWindows = [], dipWindows = [] }: Props) => {
  return (
    <div className="rounded-2xl border border-white/[0.08] p-6" style={{ background: "rgba(15,22,49,0.6)", backdropFilter: "blur(24px)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Energy Curve</h3>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Peak
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Productive
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Dip
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="hour_label"
            tick={{ fill: "#475569", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#475569", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Peak windows */}
          {peakWindows.map((w: any, i: number) => (
            <ReferenceArea key={`peak-${i}`}
              x1={w.start} x2={w.end}
              fill="#10b981" fillOpacity={0.08}
              strokeDasharray="3 3" stroke="#10b981" strokeOpacity={0.2}
            />
          ))}

          {/* Dip windows */}
          {dipWindows.map((w: any, i: number) => (
            <ReferenceArea key={`dip-${i}`}
              x1={w.start} x2={w.end}
              fill="#f59e0b" fillOpacity={0.08}
              strokeDasharray="3 3" stroke="#f59e0b" strokeOpacity={0.2}
            />
          ))}

          <ReferenceLine y={80} stroke="#10b98133" strokeDasharray="4 4" label="" />
          <ReferenceLine y={50} stroke="#f59e0b33" strokeDasharray="4 4" label="" />

          <Area
            type="monotone"
            dataKey="energy"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#energyGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Calendar events as pills below the chart */}
      {events.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Today's Calendar</p>
          {events.map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-500 w-24 flex-shrink-0">{e.start}-{e.end}</span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                e.flag === "optimize" ? "bg-amber-400" : e.flag === "reschedule" ? "bg-red-400" : "bg-emerald-400"
              }`} />
              <span className="text-slate-300 truncate">{e.summary}</span>
              <span className="text-[10px] text-slate-600 ml-auto">{e.energy_emoji} {e.energy_level}%</span>
              {e.suggestion && (
                <span className="text-[9px] text-amber-400/70 max-w-[200px] truncate">{e.suggestion}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnergyCurve;
