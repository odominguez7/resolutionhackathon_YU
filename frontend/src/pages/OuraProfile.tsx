import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import {
  Activity, Heart, Moon, Brain, Flame, Dumbbell, Clock, TrendingUp,
  ArrowLeft, BarChart3, Zap,
} from "lucide-react";

/* ── keyframes ── */
const styleId = "oura-profile-keyframes";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.textContent = `
    @keyframes oura-fade-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes oura-pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0)} }
    @keyframes oura-glow { 0%,100%{opacity:.7} 50%{opacity:1} }
  `;
  document.head.appendChild(s);
}

/* ── helpers ── */
function scoreColor(v: number, thresholds = { green: 80, amber: 65 }) {
  if (v >= thresholds.green) return "#22c55e";
  if (v >= thresholds.amber) return "#f59e0b";
  return "#ef4444";
}

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function secToHrs(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ── dark tooltip ── */
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1631]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ── glassmorphism card wrapper ── */
const GlassCard = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div
    className={`rounded-2xl border border-slate-700/50 p-6 ${className}`}
    style={{
      background: "rgba(15,23,42,.7)",
      backdropFilter: "blur(12px)",
      animation: `oura-fade-up 0.7s ease-out ${delay}ms both`,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[.2em] mb-5 flex items-center gap-2">
    <Icon className="w-4 h-4 text-slate-500" />
    {title}
  </h3>
);

/* ── smart tick: show every Nth label ── */
function tickInterval(len: number): number {
  if (len <= 14) return 0;
  if (len <= 30) return 2;
  if (len <= 60) return 4;
  if (len <= 120) return 6;
  return Math.floor(len / 15);
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
const OuraProfile = () => {
  const [sleepHistory, setSleepHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/oura/sleep-history"),
      api.get("/api/oura/stats"),
      api.get("/api/oura/workouts"),
    ])
      .then(([sh, st, wo]) => {
        setSleepHistory(sh.data ?? []);
        setStats(st);
        setWorkouts(wo.data ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0b1120 0%,#111827 100%)" }}>
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(30,41,59,.5)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
        <div className="text-center space-y-4">
          <p className="text-xl font-bold text-red-400">Failed to load Oura data</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <Link to="/dashboard"><Button variant="ghost">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  /* ── derived chart data ── */
  const chartData = sleepHistory.map((d: any) => ({
    ...d,
    label: fmtDate(d.day),
    deepPct: d.deepSleepPct ?? 0,
    remPct: d.remSleepPct ?? 0,
    lightPct: Math.max(0, 100 - (d.deepSleepPct ?? 0) - (d.remSleepPct ?? 0) - (d.awakePct ?? 0)),
    awakePct: d.awakePct ?? 0,
    stressMin: d.stressLevel != null ? Math.round(d.stressLevel) : 0,
    sleepHrs: d.totalSleepSeconds ? +(d.totalSleepSeconds / 3600).toFixed(1) : 0,
  }));

  const interval = tickInterval(chartData.length);
  const dateRange = chartData.length > 0
    ? `${fmtDate(chartData[0].day)} - ${fmtDate(chartData[chartData.length - 1].day)}`
    : "";

  const stressBarColor = (entry: any) => {
    const s = (entry.stressSummary ?? "").toLowerCase();
    if (s.includes("stress")) return "#ef4444";
    if (s.includes("restor")) return "#22c55e";
    return "#f59e0b";
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0b1120 0%,#111827 100%)" }}>
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">

        {/* ═══════ HEADER ═══════ */}
        <GlassCard delay={0} className="text-center relative overflow-hidden">
          {/* subtle ring glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 50% 30%, rgba(139,92,246,.12) 0%, transparent 60%)",
          }} />

          <div className="relative z-10 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full p-4" style={{ background: "rgba(139,92,246,.15)" }}>
                <Activity className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              YOUR OURA RING DATA
            </h1>
            <p className="text-slate-400 text-lg">
              Real biometric data from Omar's Oura Ring — not simulated
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {/* LIVE DATA badge */}
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: "rgba(34,197,94,.15)", color: "#22c55e" }}>
                <span className="w-2 h-2 rounded-full bg-green-400"
                  style={{ animation: "oura-pulse-green 1.5s ease-in-out infinite" }} />
                Live Data
              </span>

              {stats && (
                <span className="text-slate-500 text-sm">
                  {stats.totalDays} days tracked &middot; {dateRange}
                </span>
              )}
            </div>
          </div>
        </GlassCard>

        {/* ═══════ STATS OVERVIEW ═══════ */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
            style={{ animation: "oura-fade-up 0.7s ease-out 100ms both" }}>
            {[
              {
                label: "Avg Sleep Score", value: stats.avgSleepScore?.toFixed(0),
                color: scoreColor(stats.avgSleepScore ?? 0), icon: Moon,
              },
              {
                label: "Avg HRV", value: stats.avgHRV?.toFixed(0) + " ms",
                color: "#8b5cf6", icon: Brain,
              },
              {
                label: "Avg Heart Rate", value: stats.avgHeartRate?.toFixed(0) + " bpm",
                color: "#ef4444", icon: Heart,
              },
              {
                label: "Avg Deep Sleep", value: (stats.avgDeepPct ?? 0).toFixed(0) + "%",
                color: "#3b82f6", icon: Moon,
              },
              {
                label: "Total Workouts", value: stats.totalWorkouts ?? 0,
                color: "#f59e0b", icon: Dumbbell,
              },
              {
                label: "Avg Sleep", value: (stats.avgSleepHours ?? 0).toFixed(1) + " hrs",
                color: "#06b6d4", icon: Clock,
              },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-700/40 p-4 text-center space-y-2"
                style={{
                  background: "rgba(15,23,42,.6)",
                  backdropFilter: "blur(8px)",
                  animation: `oura-fade-up 0.5s ease-out ${150 + i * 80}ms both`,
                }}>
                <s.icon className="w-5 h-5 mx-auto" style={{ color: s.color }} />
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ═══════ SLEEP SCORE HISTORY ═══════ */}
        <GlassCard delay={300}>
          <SectionTitle icon={Moon} title="Sleep Score History" />
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="redZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} domain={[40, 100]} />
              <Tooltip content={<DarkTooltip />} />
              {/* red zone below 65 */}
              <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
              {/* average reference */}
              {stats?.avgSleepScore && (
                <ReferenceLine y={stats.avgSleepScore} stroke="#3b82f6" strokeDasharray="6 4" strokeOpacity={0.4}
                  label={{ value: `Avg: ${stats.avgSleepScore.toFixed(0)}`, fill: "#3b82f688", fontSize: 10, position: "insideTopRight" }} />
              )}
              <Line type="monotone" dataKey="sleepScore" stroke="#3b82f6" strokeWidth={2.5}
                dot={false} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#0f172a", strokeWidth: 2 }}
                name="Sleep Score" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* ═══════ HRV TREND ═══════ */}
        <GlassCard delay={400}>
          <SectionTitle icon={Brain} title="HRV Trend" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} />
              <Tooltip content={<DarkTooltip />} />
              {stats?.avgHRV && (
                <ReferenceLine y={stats.avgHRV} stroke="#8b5cf6" strokeDasharray="6 4" strokeOpacity={0.4}
                  label={{ value: `Avg: ${stats.avgHRV.toFixed(0)}`, fill: "#8b5cf688", fontSize: 10, position: "insideTopRight" }} />
              )}
              <Area type="monotone" dataKey="hrv" stroke="#8b5cf6" strokeWidth={2}
                fill="url(#hrvGrad)" dot={false}
                activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#0f172a", strokeWidth: 2 }}
                name="HRV (ms)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* ═══════ STRESS ANALYSIS ═══════ */}
        <GlassCard delay={500}>
          <SectionTitle icon={Zap} title="Stress Analysis" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }}
                label={{ value: "Stress Level", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10 }} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="stressMin" name="Stress Level" radius={[4, 4, 0, 0]}
                fill="#f59e0b"
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const c = stressBarColor(payload);
                  return <rect x={x} y={y} width={width} height={height} rx={4} fill={c} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Stressful</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Normal</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Restored</span>
          </div>
        </GlassCard>

        {/* ═══════ SLEEP STAGES OVER TIME ═══════ */}
        <GlassCard delay={600}>
          <SectionTitle icon={Moon} title="Sleep Stages Over Time" />
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              stackOffset="expand">
              <defs>
                <linearGradient id="deepGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="remGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="lightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748b" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#64748b" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="awakeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
              <Tooltip content={<DarkTooltip />} />
              <Area type="monotone" dataKey="deepPct" stackId="1" stroke="#3b82f6" fill="url(#deepGrad)" name="Deep %" />
              <Area type="monotone" dataKey="remPct" stackId="1" stroke="#8b5cf6" fill="url(#remGrad)" name="REM %" />
              <Area type="monotone" dataKey="lightPct" stackId="1" stroke="#64748b" fill="url(#lightGrad)" name="Light %" />
              <Area type="monotone" dataKey="awakePct" stackId="1" stroke="#ef4444" fill="url(#awakeGrad)" name="Awake %" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#3b82f6" }} /> Deep</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#8b5cf6" }} /> REM</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#64748b" }} /> Light</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#ef4444" }} /> Awake</span>
          </div>
        </GlassCard>

        {/* ═══════ HEART RATE TREND ═══════ */}
        <GlassCard delay={700}>
          <SectionTitle icon={Heart} title="Resting Heart Rate Trend" />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} />
              <Tooltip content={<DarkTooltip />} />
              {stats?.avgHeartRate && (
                <ReferenceLine y={stats.avgHeartRate} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.4}
                  label={{ value: `Avg: ${stats.avgHeartRate.toFixed(0)}`, fill: "#ef444488", fontSize: 10, position: "insideTopRight" }} />
              )}
              <Line type="monotone" dataKey="avgHeartRate" stroke="#ef4444" strokeWidth={2}
                dot={false} activeDot={{ r: 5, fill: "#ef4444", stroke: "#0f172a", strokeWidth: 2 }}
                name="Resting HR (bpm)" />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* ═══════ READINESS SCORE ═══════ */}
        <GlassCard delay={800}>
          <SectionTitle icon={TrendingUp} title="Readiness Score" />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="readyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} interval={interval} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false}
                axisLine={{ stroke: "#334155" }} domain={[40, 100]} />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.3} />
              <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} />
              <Area type="monotone" dataKey="readinessScore" stroke="#10b981" strokeWidth={2}
                fill="url(#readyGrad)" dot={false}
                activeDot={{ r: 5, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
                name="Readiness" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* ═══════ WORKOUTS ═══════ */}
        {workouts.length > 0 && (
          <GlassCard delay={900}>
            <SectionTitle icon={Dumbbell} title="Workout History" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                    <th className="text-left py-3 px-3 font-semibold">Date</th>
                    <th className="text-left py-3 px-3 font-semibold">Activity</th>
                    <th className="text-right py-3 px-3 font-semibold">Duration</th>
                    <th className="text-right py-3 px-3 font-semibold">Calories</th>
                    <th className="text-right py-3 px-3 font-semibold">Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {workouts.slice(0, 30).map((w: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/40 hover:bg-white/[.02] transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{fmtDate(w.day)}</td>
                      <td className="py-2.5 px-3 text-white font-medium">{w.activity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {w.duration ? `${Math.round(w.duration / 60)} min` : "--"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-orange-400 font-semibold">
                        {w.calories ? `${Math.round(w.calories)} kcal` : "--"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase"
                          style={{
                            background: w.intensity === "high" ? "rgba(239,68,68,.15)" :
                              w.intensity === "medium" ? "rgba(245,158,11,.15)" : "rgba(34,197,94,.15)",
                            color: w.intensity === "high" ? "#ef4444" :
                              w.intensity === "medium" ? "#f59e0b" : "#22c55e",
                          }}>
                          {w.intensity || "low"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        {/* ═══════ NAVIGATION ═══════ */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8"
          style={{ animation: "oura-fade-up 0.7s ease-out 1000ms both" }}>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:border-slate-400 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
          <Link to="/drift">
            <button
              className="px-8 py-3 rounded-2xl text-sm font-extrabold text-white cursor-pointer border-0"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
                boxShadow: "0 4px 24px rgba(139,92,246,.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(139,92,246,.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(139,92,246,.3)";
              }}
            >
              View Drift Analysis &rarr;
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default OuraProfile;
