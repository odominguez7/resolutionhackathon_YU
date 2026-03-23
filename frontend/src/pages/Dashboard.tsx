import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Area, ComposedChart,
} from "recharts";
import {
  AlertTriangle, Activity, Heart, Wind, Moon, Droplets, Flame,
  Footprints, TrendingDown, TrendingUp, Minus, Zap, Clock, Dumbbell,
} from "lucide-react";

/* ---------- palette ---------- */
const C = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  gray: "#64748b",
  muted: "#94a3b8",
  slate: "#475569",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

/* ---------- animated counter ---------- */
function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

/* ---------- staggered fade-in ---------- */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`;
    const t = setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, 50);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

/* ---------- helpers ---------- */
function scoreGradient(score: number) {
  if (score >= 70) return { from: "#10b981", to: "#34d399", text: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5" };
  if (score >= 50) return { from: "#f59e0b", to: "#fbbf24", text: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5" };
  return { from: "#ef4444", to: "#f87171", text: "text-red-400", bg: "from-red-500/20 to-red-500/5" };
}

const avgOf = (arr: any[], key: string) => arr.length > 0 ? arr.reduce((s: number, t: any) => s + (Number(t[key]) || 0), 0) / arr.length : 0;
const pctChange = (cur: number, base: number) => base > 0 ? Math.round(((cur - base) / base) * 100) : 0;
const fmtDate = (d: string) => { const p = d.split("-"); return `${p[1]}/${p[2]}`; };

/* ---------- dark tooltip ---------- */
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1631]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ---------- intensity badge ---------- */
const IntensityBadge = ({ level }: { level: string }) => {
  const map: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    moderate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    hard: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const cls = map[(level || "").toLowerCase()] || map.moderate;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${cls}`}>{level || "---"}</span>;
};

/* ============================================================ */
/*                       DASHBOARD                              */
/* ============================================================ */
const Dashboard = () => {
  const [trends, setTrends] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [stressData, setStressData] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/oura/sleep-history").catch(() => ({ data: [], totalDays: 0 })),
      api.get("/api/oura/stats").catch(() => null),
      api.get("/api/oura/stress-detail").catch(() => ({ data: [] })),
      api.get("/api/oura/workouts").catch(() => ({ data: [] })),
    ]).then(([sh, st, sd, wo]) => {
      setTrends(sh.data || []);
      setStats(st);
      setStressData(sd.data || []);
      setWorkouts(wo.data || []);
      setLoading(false);
    });
  }, []);

  /* derived values */
  const latest = trends.length > 0 ? trends[trends.length - 1] : null;
  const baseline14 = trends.slice(0, 14);
  const currentScore = latest?.sleepScore ?? 0;
  const baselineAvg = stats?.avgSleepScore ? Math.round(stats.avgSleepScore) : Math.round(avgOf(baseline14, "sleepScore"));
  const dropPct = baselineAvg > 0 ? Math.round(((baselineAvg - currentScore) / baselineAvg) * 100 * 10) / 10 : 0;
  const alertLevel = dropPct > 15 ? "high" : dropPct > 5 ? "moderate" : "low";
  const currentHRV = latest?.hrv ?? 0;
  const baselineHRV = stats?.avgHRV ? Math.round(stats.avgHRV) : Math.round(avgOf(baseline14, "hrv"));
  const readiness = latest?.readinessScore ?? 0;
  const vascularAge = stats?.latestVascularAge ?? latest?.vascularAge ?? null;
  const realAge = 30; // Omar's real age
  const yearsYounger = vascularAge != null ? realAge - vascularAge : null;

  const scoreColor = scoreGradient(currentScore);

  /* animated counters */
  const aScore = useAnimatedNumber(currentScore);
  const aBaseline = useAnimatedNumber(baselineAvg);
  const aDrop = useAnimatedNumber(Math.round(Math.abs(dropPct)));
  const aHRV = useAnimatedNumber(currentHRV);
  const aReadiness = useAnimatedNumber(readiness);

  /* 8 vital cards */
  const vitals = latest ? [
    { icon: Moon, label: "Sleep Score", value: latest.sleepScore, unit: "/100", dataKey: "sleepScore", color: C.blue },
    { icon: Activity, label: "HRV", value: latest.hrv, unit: "ms", dataKey: "hrv", color: C.purple },
    { icon: Heart, label: "Heart Rate", value: latest.avgHeartRate, unit: "bpm", dataKey: "avgHeartRate", color: C.red },
    { icon: Wind, label: "Resp Rate", value: latest.avgRespRate, unit: "/min", dataKey: "avgRespRate", color: C.cyan },
    { icon: Zap, label: "Readiness", value: latest.readinessScore, unit: "/100", dataKey: "readinessScore", color: C.amber },
    { icon: Droplets, label: "SpO2", value: latest.spo2Avg, unit: "%", dataKey: "spo2Avg", color: C.green },
    { icon: Flame, label: "Stress", value: latest.stressMin, unit: "min", dataKey: "stressMin", color: C.pink },
    { icon: Footprints, label: "Steps", value: latest.steps, unit: "", dataKey: "steps", color: C.yellow },
  ] : [];

  /* smart tick interval for X axis */
  const tickInterval = Math.max(1, Math.floor(trends.length / 12));

  /* stagger refs */
  const ref0 = useFadeIn(0);
  const ref1 = useFadeIn(100);
  const ref2 = useFadeIn(200);
  const ref3 = useFadeIn(300);
  const ref4 = useFadeIn(400);
  const ref5 = useFadeIn(500);
  const ref6 = useFadeIn(600);
  const ref7 = useFadeIn(700);
  const ref8 = useFadeIn(800);

  /* ============ LOADING STATE ============ */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
          <Skeleton className="h-10 w-60 rounded-xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  /* ============ RENDER ============ */
  return (
    <div className="min-h-screen pb-16" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 50%, #0d1229 100%)" }}>
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">

        {/* ============================================================ */}
        {/* 1. LIVE DATA BADGE + HEADER                                  */}
        {/* ============================================================ */}
        <div ref={ref0}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Data — Oura Ring</span>
              </div>
            </div>
            <Link to="/oura">
              <Button variant="ghost" className="text-xs text-slate-400 hover:text-white">
                Full Oura Profile &rarr;
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Omar's Sleep & Recovery Dashboard</h1>
          <p className="text-sm text-slate-500">
            {stats?.totalDays ?? trends.length} days tracked
            {stats?.dateRange ? ` — ${stats.dateRange}` : trends.length > 0 ? ` — ${trends[0].day} to ${trends[trends.length - 1].day}` : ""}
          </p>
        </div>

        {/* ============================================================ */}
        {/* 2. SCORE HEADER CARD                                         */}
        {/* ============================================================ */}
        <div ref={ref1}>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-8"
               style={{ background: "rgba(15, 22, 49, 0.6)", backdropFilter: "blur(24px)" }}>
            {/* glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: scoreColor.from }} />

            <div className="relative flex flex-wrap items-center gap-10">
              {/* Main score */}
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2 font-medium">Sleep Score</p>
                <p className="text-8xl font-black tabular-nums leading-none"
                   style={{ background: `linear-gradient(135deg, ${scoreColor.from}, ${scoreColor.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {aScore}
                </p>
              </div>

              <div className="hidden md:block w-px h-24 bg-white/10" />

              {/* Stat cluster */}
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Baseline Avg</p>
                  <p className="text-3xl font-bold text-slate-200">{aBaseline}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Drop</p>
                  <p className={`text-3xl font-bold ${dropPct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {dropPct > 0 ? "-" : "+"}{aDrop}%
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">HRV</p>
                  <p className="text-3xl font-bold text-purple-400">{aHRV}<span className="text-lg text-slate-500 ml-1">ms</span></p>
                  <p className="text-[10px] text-slate-600">baseline {baselineHRV} ms</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Readiness</p>
                  <p className="text-3xl font-bold text-amber-400">{aReadiness}</p>
                </div>
                {vascularAge != null && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Vascular Age</p>
                    <p className="text-3xl font-bold text-cyan-400">{vascularAge}</p>
                    {yearsYounger != null && yearsYounger > 0 && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {yearsYounger}yr younger
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Alert */}
              <div className="ml-auto">
                {alertLevel !== "low" && (
                  <div className={`flex items-center gap-2 rounded-xl px-5 py-3 border ${
                    alertLevel === "high"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}>
                    <AlertTriangle className={`w-5 h-5 ${alertLevel === "high" ? "animate-pulse" : ""}`} />
                    <span className="font-semibold text-sm capitalize">{alertLevel} Alert</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. EIGHT VITAL STAT CARDS (2 rows of 4)                      */}
        {/* ============================================================ */}
        {vitals.length > 0 && (
          <div ref={ref2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {vitals.map((v, idx) => {
                const baseVal = avgOf(baseline14, v.dataKey);
                const curVal = Number(v.value) || 0;
                const change = pctChange(curVal, baseVal);
                // For heart rate & stress, lower is better
                const lowerIsBetter = v.label === "Heart Rate" || v.label === "Stress";
                const isPositive = lowerIsBetter ? change < 0 : change > 0;
                const isNegative = lowerIsBetter ? change > 0 : change < 0;
                const ChangeIcon = change === 0 ? Minus : (isPositive ? TrendingUp : TrendingDown);
                const sparkData = trends.slice(-20);

                return (
                  <div key={v.label}
                       className="group relative rounded-2xl border border-white/[0.08] p-5 transition-all duration-300 hover:border-white/20 hover:scale-[1.02]"
                       style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${v.color}15` }}>
                        <v.icon className="w-4 h-4" style={{ color: v.color }} />
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-0.5 ${
                        isPositive ? "text-emerald-400 bg-emerald-500/10" :
                        isNegative ? "text-red-400 bg-red-500/10" :
                        "text-slate-500 bg-slate-500/10"
                      }`}>
                        <ChangeIcon className="w-3 h-3" />
                        {Math.abs(change)}%
                      </div>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">{v.label}</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-bold text-slate-100">{v.value ?? "--"}</p>
                      {v.unit && <span className="text-xs text-slate-500">{v.unit}</span>}
                    </div>
                    {/* sparkline */}
                    <div className="mt-3 h-10 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                          <defs>
                            <linearGradient id={`sp-${idx}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={v.color} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={v.color} stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <Line type="monotone" dataKey={v.dataKey} stroke={`url(#sp-${idx})`} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. SLEEP SCORE TREND — ComposedChart                         */}
        {/* ============================================================ */}
        <div ref={ref3}>
          <div className="rounded-2xl border border-white/[0.08] p-6"
               style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Sleep Score Trend</h3>
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded inline-block" /> Score</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ borderTop: "1px dashed #8b5cf6" }} /> HRV</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500/30 rounded inline-block" /> Danger &lt;65</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={trends} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="dangerZone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false}
                       interval={tickInterval} tickFormatter={fmtDate} />
                <YAxis domain={[30, 100]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={baselineAvg} stroke="#64748b" strokeDasharray="6 4" strokeWidth={1}
                               label={{ value: `Baseline ${baselineAvg}`, fill: "#64748b", fontSize: 9, position: "right" }} />
                <ReferenceLine y={65} stroke="#ef444466" strokeDasharray="4 4" strokeWidth={1}
                               label={{ value: "Danger 65", fill: "#ef444488", fontSize: 9, position: "left" }} />
                <Area type="monotone" dataKey="sleepScore" fill="url(#dangerZone)" stroke="none" baseValue={30} activeDot={false} />
                <Area type="monotone" dataKey="sleepScore" fill="url(#scoreGlow)" stroke="none" activeDot={false} />
                <Line type="monotone" dataKey="sleepScore" stroke={C.blue} strokeWidth={3} dot={false} name="Score"
                      activeDot={{ r: 5, fill: C.blue, stroke: "#0a0e27", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="hrv" stroke={C.purple} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="HRV"
                      activeDot={{ r: 4, fill: C.purple, stroke: "#0a0e27", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 5. SLEEP STAGES — StackedBarChart                            */}
        {/* ============================================================ */}
        <div ref={ref4}>
          <div className="rounded-2xl border border-white/[0.08] p-6"
               style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Sleep Stages</h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Deep</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" /> REM</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500 inline-block" /> Light</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" /> Awake</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false}
                       interval={tickInterval} tickFormatter={fmtDate} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                       tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="deepSleepPct" stackId="stages" fill="#3b82f6" name="Deep %" radius={[0, 0, 0, 0]} />
                <Bar dataKey="remSleepPct" stackId="stages" fill="#8b5cf6" name="REM %" />
                <Bar dataKey="lightSleepPct" stackId="stages" fill="#475569" name="Light %" />
                <Bar dataKey="awakePct" stackId="stages" fill="#ef444499" name="Awake %" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 6. STRESS & RECOVERY — BarChart from stress-detail           */}
        {/* ============================================================ */}
        {stressData.length > 0 && (
          <div ref={ref5}>
            <div className="rounded-2xl border border-white/[0.08] p-6"
                 style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Stress & Recovery</h3>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Stress min</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" /> Recovery min</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stressData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false}
                         interval={Math.max(1, Math.floor(stressData.length / 12))} tickFormatter={fmtDate} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="stressMin" fill="#ef4444" name="Stress" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                  <Bar dataKey="recoveryMin" fill="#10b981" name="Recovery" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 7. READINESS + ACTIVITY — dual LineChart                      */}
        {/* ============================================================ */}
        <div ref={ref6}>
          <div className="rounded-2xl border border-white/[0.08] p-6"
               style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Readiness + Activity</h3>
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" /> Readiness</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-blue-500 inline-block" /> Activity</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="readyGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false}
                       interval={tickInterval} tickFormatter={fmtDate} />
                <YAxis domain={[20, 100]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="readinessScore" stroke={C.green} strokeWidth={2.5} dot={false} name="Readiness"
                      activeDot={{ r: 4, fill: C.green, stroke: "#0a0e27", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="activityScore" stroke={C.blue} strokeWidth={2.5} dot={false} name="Activity"
                      activeDot={{ r: 4, fill: C.blue, stroke: "#0a0e27", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 8. RECENT WORKOUTS — compact table                           */}
        {/* ============================================================ */}
        {workouts.length > 0 && (
          <div ref={ref7}>
            <div className="rounded-2xl border border-white/[0.08] p-6"
                 style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Recent Workouts</h3>
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-500">{workouts.length} total</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/[0.06]">
                      <th className="text-left pb-3 font-semibold">Date</th>
                      <th className="text-left pb-3 font-semibold">Activity</th>
                      <th className="text-right pb-3 font-semibold">Duration</th>
                      <th className="text-right pb-3 font-semibold">Calories</th>
                      <th className="text-right pb-3 font-semibold">Avg HR</th>
                      <th className="text-center pb-3 font-semibold">Intensity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workouts.slice(-10).reverse().map((w: any, i: number) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-slate-400 font-mono text-xs">{w.day}</td>
                        <td className="py-3 text-slate-200 font-medium">{w.activity || "Workout"}</td>
                        <td className="py-3 text-right text-slate-300 tabular-nums">
                          <span className="flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {w.duration != null ? `${Math.round(w.duration)}m` : "--"}
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-300 tabular-nums">{w.calories ?? "--"}</td>
                        <td className="py-3 text-right text-slate-300 tabular-nums">{w.avgHeartRate ?? "--"} <span className="text-slate-500 text-[10px]">bpm</span></td>
                        <td className="py-3 text-center"><IntensityBadge level={w.intensity} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 9. ACTION BUTTONS                                            */}
        {/* ============================================================ */}
        <div ref={ref8}>
          <div className="flex flex-wrap gap-4">
            <Link to="/drift">
              <Button size="lg"
                      className="relative bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50 rounded-xl px-8 h-12 font-semibold text-sm transition-all duration-300">
                <span className="absolute inset-0 rounded-xl animate-pulse bg-amber-500/10" />
                <AlertTriangle className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">View Drift Analysis</span>
              </Button>
            </Link>
            <Link to="/oura">
              <Button size="lg"
                      className="relative bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 rounded-xl px-8 h-12 font-semibold text-sm transition-all duration-300">
                <Activity className="w-4 h-4 mr-2" />
                My Oura Profile
              </Button>
            </Link>
            <Link to="/checkin">
              <Button variant="outline" size="lg"
                      className="rounded-xl px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20 font-semibold text-sm transition-all duration-300">
                Check-in
              </Button>
            </Link>
            <Link to="/xray">
              <Button variant="outline" size="lg"
                      className="rounded-xl px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20 font-semibold text-sm transition-all duration-300">
                X-Ray Mode
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
