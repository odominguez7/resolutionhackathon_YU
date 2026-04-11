import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Dumbbell, TrendingUp, Calendar, ChevronDown, ChevronUp, Check, X, Minus, AlertTriangle, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";

const VERDICT_COLORS: Record<string, string> = { ok: "#C2FF4A", too_much: "#FF5D6C", undertrained: "#FFC36B" };
const FB_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  yes: { bg: "rgba(194,255,74,.15)", color: "#C2FF4A", label: "Done" },
  partial: { bg: "rgba(255,195,107,.15)", color: "#FFC36B", label: "Partial" },
  no: { bg: "rgba(255,93,108,.15)", color: "#FF5D6C", label: "Skipped" },
};

export default function History() {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [progressions, setProgressions] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [range, setRange] = useState(14);

  useEffect(() => {
    api.get(`/api/oura/workout/log?days=${range}`).then(d => setEntries((d?.entries || []).slice().reverse())).catch(() => {});
    api.get("/api/oura/workout/weekly-summary").then(setSummary).catch(() => {});
    api.get("/api/oura/workout/progression").then(d => setProgressions(d?.movements || [])).catch(() => {});
  }, [range]);

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto" style={{ background: "#0a0b0d" }}>
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Training</p>
        <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>History</h1>
      </div>

      {/* Weekly Summary Card */}
      {summary && (
        <motion.div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,92,53,0.04)", border: "1px solid rgba(255,92,53,0.1)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: "#FF5C35" }}>This Week</p>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { value: summary.completed, label: "completed", color: "#C2FF4A" },
              { value: summary.total_sessions, label: "generated", color: "#FF5C35" },
              { value: `${summary.completion_rate}%`, label: "completion", color: "#6EE7FF" },
              { value: summary.streak, label: "streak", color: "#A78BFA" },
            ].map(s => (
              <div key={s.label} className="text-center rounded-xl py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-2xl font-black" style={{ color: s.color, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
                <p className="text-[8px] uppercase tracking-[0.12em] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(110,231,255,.1)", color: "#6EE7FF" }}>
              HRV {summary.hrv_trend}
            </span>
            {Object.entries(summary.intensity_distribution || {}).map(([k, v]) => (
              <span key={k} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.04)", color: "#94A3B8" }}>
                {k}: {v as number}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Progress Cards */}
      {progressions.length > 0 && (
        <motion.div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(194,255,74,0.03)", border: "1px solid rgba(194,255,74,0.08)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" style={{ color: "#C2FF4A" }} />
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#C2FF4A" }}>Progressive Overload</p>
          </div>
          <div className="space-y-2">
            {progressions.filter(p => p.current_load_lbs).slice(0, 8).map((p: any) => {
              const bumped = p.next_prescribed_lbs > p.current_load_lbs;
              return (
                <div key={p.movement_name} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div>
                    <p className="text-sm text-white font-bold">{p.movement_name}</p>
                    <p className="text-[10px] text-slate-500">{p.consecutive_clean} clean hit{p.consecutive_clean !== 1 ? "s" : ""} at {p.current_load_lbs}lb</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-sm font-black" style={{ color: bumped ? "#C2FF4A" : "#94A3B8", fontFamily: "'Space Grotesk', sans-serif" }}>
                      {p.next_prescribed_lbs}lb
                    </p>
                    {bumped && (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(194,255,74,0.15)", color: "#C2FF4A", letterSpacing: "0.08em" }}>
                        ▲ +{p.next_prescribed_lbs - p.current_load_lbs}lb
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* HRV Trend Chart — before/after visualization */}
      {summary?.hrv_values && summary.hrv_values.length >= 3 && (
        <motion.div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(110,231,255,0.03)", border: "1px solid rgba(110,231,255,0.08)" }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4" style={{ color: "#6EE7FF" }} />
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#6EE7FF" }}>HRV Trend (7 days)</p>
            <span className="text-[9px] px-2 py-0.5 rounded-full ml-auto" style={{
              background: summary.hrv_trend === "improving" ? "rgba(194,255,74,.12)" : summary.hrv_trend === "declining" ? "rgba(255,93,108,.12)" : "rgba(255,255,255,.04)",
              color: summary.hrv_trend === "improving" ? "#C2FF4A" : summary.hrv_trend === "declining" ? "#FF5D6C" : "#94A3B8",
            }}>{summary.hrv_trend}</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={summary.hrv_values.map((v: number, i: number) => ({ day: i + 1, hrv: v }))}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6EE7FF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6EE7FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip
                contentStyle={{ background: "#1a1d24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#94A3B8" }}
                formatter={(v: number) => [`${v}ms`, "HRV"]}
              />
              <Area type="monotone" dataKey="hrv" stroke="#6EE7FF" fill="url(#hrvGrad)" strokeWidth={2} dot={{ r: 3, fill: "#6EE7FF" }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-slate-500 mt-2 text-center">
            {summary.hrv_values[0]}ms → {summary.hrv_values[summary.hrv_values.length - 1]}ms over the last {summary.hrv_values.length} days
          </p>
        </motion.div>
      )}

      {/* Range selector */}
      <div className="flex gap-2 mb-4">
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setRange(d)}
            className="text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer border-0"
            style={{
              background: range === d ? "rgba(255,92,53,.15)" : "rgba(255,255,255,.03)",
              color: range === d ? "#FF5C35" : "#64748B",
            }}>{d}d</button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No workouts in this period.</p>
        )}
        {entries.map((e: any) => {
          const fb = (e.user_feedback || {}).completed;
          const fbStyle = FB_COLORS[fb] || { bg: "rgba(148,163,184,.1)", color: "#94A3B8", label: "Pending" };
          const isExpanded = expanded === e.id;
          return (
            <motion.div key={e.id} className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button onClick={() => setExpanded(isExpanded ? null : e.id)}
                className="w-full flex items-center gap-3 p-3.5 cursor-pointer border-0 bg-transparent text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{e.title || "Workout"}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: fbStyle.bg, color: fbStyle.color }}>{fbStyle.label}</span>
                    {e.load_verdict && (
                      <span className="text-[8px] font-bold uppercase" style={{ color: VERDICT_COLORS[e.load_verdict] || "#475569" }}>{e.load_verdict}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {e.day} · {e.intensity || "?"} · {(e.patterns || []).join(", ") || "no patterns"}
                  </p>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
              </button>
              {isExpanded && e.full_workout && (
                <div className="px-3.5 pb-3.5 space-y-2">
                  {["warmup", "strength", "metcon", "workout", "cooldown"].map(bk => {
                    const block = (e.full_workout || {})[bk];
                    if (!block?.movements?.length) return null;
                    return (
                      <div key={bk}>
                        <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(255,92,53,0.5)" }}>{bk}</p>
                        {block.movements.map((m: any, i: number) => (
                          <p key={i} className="text-xs text-slate-300 pl-2">
                            {typeof m === "object" ? `${m.reps || ""} ${m.movement_name || ""} ${m.load ? `(${m.load})` : ""}`.trim() : m}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                  {e.full_workout?.why_this_workout && (
                    <p className="text-[10px] text-slate-500 italic mt-1">{e.full_workout.why_this_workout}</p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
