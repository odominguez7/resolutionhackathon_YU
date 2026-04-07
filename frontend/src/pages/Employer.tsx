import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import {
  Users, ShieldCheck, TrendingDown, TrendingUp, Activity,
  AlertTriangle, Lock, BarChart3, Moon, Zap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

const DRIVER_ICONS: Record<string, any> = { "Sleep Quality": Moon, "HRV Decline": Activity, "Stress Elevation": Zap };

interface TeamData {
  company: string; team_size: number;
  summary: {
    drift_rate: number; drifting_count: number; avg_readiness: number;
    avg_sleep: number; avg_hrv: number;
    interventions_sent: number; interventions_effective: number; effectiveness_rate: number;
  };
  readiness_distribution: { high: number; moderate: number; low: number };
  weekly_trend: { week: string; drift_rate: number; avg_readiness: number }[];
  top_drivers: { metric: string; pct: number; color: string }[];
  privacy_note: string;
}

export default function Employer() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/agent/team").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#060918" }}>
      <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
    </div>
  );
  if (!data) return null;

  const s = data.summary;
  const driftColor = s.drift_rate > 25 ? "#ef4444" : s.drift_rate > 15 ? "#f59e0b" : "#22c55e";

  const readinessDist = [
    { name: "High\n(75+)", value: data.readiness_distribution.high, color: "#22c55e" },
    { name: "Moderate\n(55-74)", value: data.readiness_distribution.moderate, color: "#f59e0b" },
    { name: "Low\n(<55)", value: data.readiness_distribution.low, color: "#ef4444" },
  ];

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(180deg,#060918 0%,#0b1120 40%,#0a0f1f 100%)" }}>

      {/* Header */}
      <div className="relative overflow-hidden" style={{ paddingTop: 50, paddingBottom: 24 }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(34,197,94,0.06) 0%, transparent 70%)",
        }} />
        <div className="max-w-2xl mx-auto px-5 text-center relative z-10">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Users className="w-7 h-7" style={{ color: "#4ade80" }} />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1" style={{ color: "#f1f5f9" }}>
            Employer Dashboard
          </h1>
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            {data.team_size} employees -- generated from real Oura baseline
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#fbbf24" }}>
                Simulated Team
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.12)" }}>
              <Lock className="w-3 h-3" style={{ color: "#4ade80" }} />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4ade80" }}>
                No Individual Data Exposed
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 space-y-4">

        {/* Key metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Drift Rate", value: `${s.drift_rate}%`, sub: `${s.drifting_count} employees`, color: driftColor, icon: AlertTriangle },
            { label: "Avg Readiness", value: `${s.avg_readiness}`, sub: "team average", color: s.avg_readiness >= 70 ? "#22c55e" : "#f59e0b", icon: ShieldCheck },
            { label: "Interventions", value: `${s.interventions_sent}`, sub: "sent this week", color: "#3b82f6", icon: Zap },
            { label: "Effectiveness", value: `${s.effectiveness_rate}%`, sub: `${s.interventions_effective}/${s.interventions_sent} worked`, color: s.effectiveness_rate >= 50 ? "#22c55e" : "#f59e0b", icon: BarChart3 },
          ].map((m, i) => (
            <motion.div key={m.label}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}18` }}>
              <m.icon className="w-4 h-4 mx-auto mb-2" style={{ color: m.color }} />
              <p className="text-xl font-extrabold tabular-nums" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{m.label}</p>
              <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>{m.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Drift trend chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}
          className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            4-Week Drift Trend
          </p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekly_trend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="drift_rate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} name="Drift Rate %" />
                <Line type="monotone" dataKey="avg_readiness" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 4 }} name="Avg Readiness" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Readiness distribution + Drift drivers side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Readiness distribution */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
              Readiness Distribution
            </p>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={readinessDist} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {readinessDist.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top drift drivers */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
            className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
              Top Drift Drivers
            </p>
            <div className="space-y-3">
              {data.top_drivers.map((d) => {
                const Icon = DRIVER_ICONS[d.metric] || Activity;
                return (
                  <div key={d.metric}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3" style={{ color: d.color }} />
                        <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{d.metric}</span>
                      </span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: d.color }}>{d.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <motion.div className="h-full rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${d.pct}%` }}
                        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        style={{ background: `linear-gradient(90deg, ${d.color}60, ${d.color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ROI card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
          className="rounded-2xl p-5 text-center"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.05), rgba(59,130,246,0.05))", border: "1px solid rgba(34,197,94,0.12)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(34,197,94,0.5)" }}>
            Estimated ROI
          </p>
          <p className="text-3xl font-extrabold mb-1" style={{ background: "linear-gradient(135deg,#22c55e,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            $96,000
          </p>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            saved annually by preventing {Math.round(s.drifting_count * 0.6)} burnout-driven departures
          </p>
          <p className="text-[9px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            At $8 PEPM for {data.team_size} employees = ${data.team_size * 8 * 12}/yr investment
          </p>
        </motion.div>

        {/* Privacy footer */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.1)" }}>{data.privacy_note}</p>
        </div>
      </div>
    </div>
  );
}
