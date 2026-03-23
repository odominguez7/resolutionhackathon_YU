import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Area, ComposedChart
} from "recharts";
import { AlertTriangle, Activity, Heart, Wind, Thermometer, RotateCcw, TrendingDown, TrendingUp, Minus } from "lucide-react";

const COLORS = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  gray: "#64748b",
  muted: "#94a3b8",
  slate: "#475569",
  amber: "#f59e0b",
};

/* ---------- animated counter hook ---------- */
function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

/* ---------- staggered fade-in hook ---------- */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`;
    const timer = setTimeout(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 50);
    return () => clearTimeout(timer);
  }, [delay]);
  return ref;
}

/* ---------- score color ---------- */
function scoreGradient(score: number) {
  if (score >= 70) return { from: "#10b981", to: "#34d399", text: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5" };
  if (score >= 50) return { from: "#f59e0b", to: "#fbbf24", text: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5" };
  return { from: "#ef4444", to: "#f87171", text: "text-red-400", bg: "from-red-500/20 to-red-500/5" };
}

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

/* ---------- sparkline for vital card ---------- */
const VITAL_DATA_KEYS: Record<string, string> = {
  "Heart Rate": "avgHeartRate",
  "HRV": "hrv",
  "Resp Rate": "avgRespRate",
  "Readiness": "readinessScore",
  "Restless": "tnt",
};

/* ---------- main component ---------- */
const Dashboard = () => {
  const [trends, setTrends] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [stressData, setStressData] = useState<any[]>([]);

  useEffect(() => {
    // Dashboard uses 100% REAL Oura Ring data
    Promise.all([
      api.get("/api/oura/sleep-history").catch(() => ({ data: [] })),
      api.get("/api/oura/stats").catch(() => null),
      api.get("/api/oura/stress-detail").catch(() => ({ data: [] })),
    ]).then(([sh, stats, sd]) => {
      const ouraData = sh.data || [];
      // Map Oura fields to what the charts expect
      setTrends(ouraData);
      setStressData(sd.data || []);
      // Build checkins from stress data
      const stressList = sd.data || [];
      const stressByDay: Record<string, any> = {};
      stressList.forEach((s: any) => { stressByDay[s.day] = s; });
      setCheckins(ouraData.map((d: any) => {
        const st = stressByDay[d.day] || {};
        const stressHigh = st.stressHigh || 0;
        const stressLevel = Math.min(10, Math.max(1, Math.round(stressHigh / 3600) + 1));
        return {
          date: d.day,
          mood: Math.max(1, Math.min(10, Math.round((d.readinessScore + d.sleepScore) / 20))),
          energy: Math.max(1, Math.min(10, Math.round(d.readinessScore / 10))),
          stress: stressLevel,
          sleep_quality_self: Math.max(1, Math.min(10, Math.round(d.sleepScore / 10))),
        };
      }));
      // Build summary from stats
      if (stats && ouraData.length > 0) {
        const latest = ouraData[ouraData.length - 1];
        const baselineAvg = stats.avgSleepScore || 80;
        const currentScore = latest.sleepScore || 0;
        const dropPct = baselineAvg > 0 ? Math.round(((baselineAvg - currentScore) / baselineAvg) * 100 * 10) / 10 : 0;
        setSummary({
          currentScore,
          baselineAvg: Math.round(baselineAvg),
          dropPercent: dropPct,
          currentHRV: latest.hrv || 0,
          baselineHRV: Math.round(stats.avgHRV || 0),
          alertLevel: dropPct > 15 ? "high" : dropPct > 5 ? "moderate" : "low",
        });
      }
      setLoading(false);
    });
  }, []);

  const latest = trends[trends.length - 1];
  const baseline = summary?.baselineAvg ?? 86;
  const currentScore = summary?.currentScore ?? latest?.sleepScore ?? 0;
  const drop = summary?.dropPercent ?? (baseline > 0 ? Math.round(((baseline - currentScore) / baseline) * 100) : 0);
  const alertLevel = summary?.alertLevel ?? (drop > 15 ? "high" : drop > 5 ? "moderate" : "low");
  const currentHRV = summary?.currentHRV ?? latest?.hrv ?? 0;
  const baselineHRV = summary?.baselineHRV ?? 0;

  const animatedScore = useAnimatedNumber(currentScore);
  const animatedDrop = useAnimatedNumber(drop);
  const animatedBaseline = useAnimatedNumber(baseline);

  const scoreColor = scoreGradient(currentScore);

  // Baseline calcs for vitals
  const baselineSlice = trends.slice(0, 5);
  const avgOf = (arr: any[], key: string) => arr.length > 0 ? arr.reduce((s, t) => s + (t[key] ?? 0), 0) / arr.length : 0;
  const pctChange = (current: number, base: number) => base > 0 ? Math.round(((current - base) / base) * 100) : 0;

  const vitals = latest ? [
    { icon: Heart, label: "Heart Rate", value: `${latest.avgHeartRate ?? "--"}`, unit: "bpm", change: pctChange(latest.avgHeartRate, avgOf(baselineSlice, "avgHeartRate")), color: COLORS.red },
    { icon: Activity, label: "HRV", value: `${latest.hrv ?? "--"}`, unit: "ms", change: pctChange(latest.hrv, avgOf(baselineSlice, "hrv")), color: COLORS.purple },
    { icon: Wind, label: "Resp Rate", value: `${latest.avgRespRate ?? "--"}`, unit: "/min", change: pctChange(latest.avgRespRate, avgOf(baselineSlice, "avgRespRate")), color: COLORS.blue },
    { icon: TrendingUp, label: "Readiness", value: `${latest.readinessScore ?? "--"}`, unit: "/100", change: pctChange(latest.readinessScore, avgOf(baselineSlice, "readinessScore")), color: COLORS.amber },
    { icon: RotateCcw, label: "Restless", value: `${latest.tnt ?? "--"}`, unit: "periods", change: pctChange(latest.tnt, avgOf(baselineSlice, "tnt")), color: COLORS.slate },
  ] : [];

  // Refs for staggered animation
  const headerRef = useFadeIn(0);
  const trendRef = useFadeIn(120);
  const stagesRef = useFadeIn(240);
  const moodRef = useFadeIn(360);
  const vitalsRef = useFadeIn(480);
  const actionsRef = useFadeIn(600);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 50%, #0d1229 100%)" }}>
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">

        {/* ======== LIVE DATA BADGE ======== */}
        <div ref={headerRef}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Data</span>
              </div>
              <span className="text-xs text-slate-500">from Omar's Oura Ring — {trends.length} days tracked</span>
            </div>
            <Link to="/oura">
              <Button variant="ghost" className="text-xs text-slate-400 hover:text-white">
                Full Oura Profile →
              </Button>
            </Link>
          </div>

          {/* ======== SCORE HEADER ======== */}
          <div className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r ${scoreColor.bg} backdrop-blur-xl p-8`}
               style={{ background: "rgba(15, 22, 49, 0.6)", backdropFilter: "blur(24px)" }}>
            {/* Glow accent */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: scoreColor.from }} />

            <div className="relative flex flex-wrap items-center gap-10">
              {/* Main score */}
              <div className="flex flex-col items-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2 font-medium">Sleep Score (Oura)</p>
                <p className="text-8xl font-black tabular-nums leading-none"
                   style={{ background: `linear-gradient(135deg, ${scoreColor.from}, ${scoreColor.to})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {animatedScore}
                </p>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-24 bg-white/10" />

              {/* Stats cluster */}
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Baseline</p>
                  <p className="text-3xl font-bold text-slate-200">{animatedBaseline}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">Drop</p>
                  <p className="text-3xl font-bold text-red-400">-{animatedDrop}%</p>
                </div>
                {currentHRV > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500 mb-1">HRV</p>
                    <p className="text-3xl font-bold text-purple-400">{currentHRV}<span className="text-lg text-slate-500 ml-1">ms</span></p>
                  </div>
                )}
              </div>

              {/* Alert badge */}
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

        {/* ======== CHARTS ROW ======== */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sleep Score Trend */}
          <div ref={trendRef}>
            <div className="rounded-2xl border border-white/[0.08] p-6"
                 style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Sleep Score Trend</h3>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded inline-block" /> Score</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 rounded inline-block border-dashed" style={{ borderTop: "1px dashed #8b5cf6", background: "none", height: 0 }} /> HRV</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
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
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false} />
                  <YAxis domain={[40, 100]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <ReferenceLine y={baseline} stroke="#64748b" strokeDasharray="6 4" strokeWidth={1} label={{ value: `Baseline ${baseline}`, fill: "#64748b", fontSize: 9, position: "right" }} />
                  <ReferenceLine y={60} stroke="transparent" />
                  <Area type="monotone" dataKey="sleepScore" fill="url(#dangerZone)" stroke="none" baseValue={40} activeDot={false} />
                  <Area type="monotone" dataKey="sleepScore" fill="url(#scoreGlow)" stroke="none" activeDot={false} />
                  <Line type="monotone" dataKey="sleepScore" stroke={COLORS.blue} strokeWidth={3} dot={false} name="Score" activeDot={{ r: 5, fill: COLORS.blue, stroke: "#0a0e27", strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="hrv" stroke={COLORS.purple} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="HRV" activeDot={{ r: 4, fill: COLORS.purple, stroke: "#0a0e27", strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sleep Stages */}
          <div ref={stagesRef}>
            <div className="rounded-2xl border border-white/[0.08] p-6"
                 style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Sleep Stages</h3>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Deep</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" /> REM</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500 inline-block" /> Light</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Awake</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trends} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="deepSleepPct" stackId="a" fill="#3b82f6" name="Deep" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="remSleepPct" stackId="a" fill="#8b5cf6" name="REM" />
                  <Bar dataKey="lightSleepPct" stackId="a" fill="#475569" name="Light" />
                  <Bar dataKey="awakePct" stackId="a" fill="#ef4444" name="Awake" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ======== MOOD / ENERGY / STRESS ======== */}
        <div ref={moodRef}>
          <div className="rounded-2xl border border-white/[0.08] p-6"
               style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Mood / Energy / Stress</h3>
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-emerald-500 inline-block" /> Mood</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-amber-400 inline-block" /> Energy</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-red-500 inline-block" /> Stress</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={checkins} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="moodGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.1)" }} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="mood" stroke="#10b981" strokeWidth={2.5} dot={false} name="Mood" activeDot={{ r: 4, fill: "#10b981", stroke: "#0a0e27", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="energy" stroke="#fbbf24" strokeWidth={2.5} dot={false} name="Energy" activeDot={{ r: 4, fill: "#fbbf24", stroke: "#0a0e27", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={2.5} dot={false} name="Stress" activeDot={{ r: 4, fill: "#ef4444", stroke: "#0a0e27", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ======== VITAL STAT CARDS ======== */}
        {vitals.length > 0 && (
          <div ref={vitalsRef}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {vitals.map((v, idx) => {
                const dataKey = VITAL_DATA_KEYS[v.label] || "sleepScore";
                const sparkData = trends.slice(-14);
                const isPositive = v.label === "Toss & Turns" ? v.change < 0 : v.change > 0;
                const isNegative = v.label === "Toss & Turns" ? v.change > 0 : v.change < 0;
                const ChangeIcon = v.change === 0 ? Minus : (isPositive ? TrendingUp : TrendingDown);

                return (
                  <div key={v.label}
                       className="group relative rounded-2xl border border-white/[0.08] p-5 transition-all duration-300 hover:border-white/20 hover:scale-[1.02]"
                       style={{ background: "rgba(15, 22, 49, 0.5)", backdropFilter: "blur(24px)", animationDelay: `${idx * 80}ms` }}>
                    {/* Icon */}
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
                        {Math.abs(v.change)}%
                      </div>
                    </div>

                    {/* Label */}
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">{v.label}</p>

                    {/* Value */}
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-bold text-slate-100">{v.value}</p>
                      {v.unit && <span className="text-xs text-slate-500">{v.unit}</span>}
                    </div>

                    {/* Sparkline */}
                    <div className="mt-3 h-10 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                          <defs>
                            <linearGradient id={`spark-${v.label}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={v.color} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={v.color} stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <Line type="monotone" dataKey={dataKey} stroke={`url(#spark-${v.label})`} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======== ACTION BUTTONS ======== */}
        <div ref={actionsRef}>
          <div className="flex flex-wrap gap-4">
            <Link to="/drift">
              <Button size="lg"
                      className="relative bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50 rounded-xl px-8 h-12 font-semibold text-sm transition-all duration-300">
                <span className="absolute inset-0 rounded-xl animate-pulse bg-amber-500/10" />
                <AlertTriangle className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">View Drift Alert</span>
              </Button>
            </Link>
            <Link to="/checkin">
              <Button variant="outline" size="lg"
                      className="rounded-xl px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20 font-semibold text-sm transition-all duration-300">
                Do Check-in
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
