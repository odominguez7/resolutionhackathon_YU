import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Activity, Heart, Moon, Brain, Flame, Dumbbell, Clock, TrendingUp,
  Zap, Wind, Droplets, Footprints, Gauge, Calendar, MapPin, Coffee, Bed, Sun, Sunrise,
} from "lucide-react";
import PlanOrbit from "@/components/PlanOrbit";

/* ── inject keyframes ── */
const styleId = "oura-v2-keyframes";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.textContent = `
    @keyframes oura-fade-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes oura-pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.55)} 50%{box-shadow:0 0 0 8px rgba(74,222,128,0)} }
    @keyframes oura-ring-fill { from{stroke-dashoffset:var(--ring-circ)} to{stroke-dashoffset:var(--ring-offset)} }
    @keyframes oura-number-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
  `;
  document.head.appendChild(s);
}

/* ── types ── */
type Interval = "7D" | "14D" | "30D" | "ALL";

/* ── helpers ── */
function scoreClr(v: number) {
  if (v >= 80) return "#4ADE80";
  if (v >= 65) return "#F59E0B";
  return "#F87171";
}

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()} ${dt.toLocaleString("en-GB", { month: "short" })}`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function pctChange(current: number, avg: number) {
  if (!avg) return 0;
  return +((current - avg) / avg * 100).toFixed(1);
}

function sliceDays(data: any[], interval: Interval) {
  if (interval === "ALL") return data;
  const n = interval === "7D" ? 7 : interval === "14D" ? 14 : 30;
  return data.slice(-n);
}

function intervalDayCount(interval: Interval, totalLen: number): number {
  if (interval === "ALL") return totalLen;
  if (interval === "7D") return Math.min(7, totalLen);
  if (interval === "14D") return Math.min(14, totalLen);
  return Math.min(30, totalLen);
}

function tickInterval(len: number): number {
  if (len <= 10) return 0;
  if (len <= 20) return 1;
  if (len <= 40) return 3;
  if (len <= 80) return 5;
  return Math.floor(len / 14);
}

function sparkPoints(data: any[], key: string): number[] {
  const src = data.length > 20 ? data.filter((_: any, i: number) => i % Math.ceil(data.length / 20) === 0) : data;
  return src.map((d: any) => d[key] ?? 0);
}

function avgOf(data: any[], key: string): number {
  const valid = data.filter((d: any) => d[key] != null && d[key] !== 0);
  if (!valid.length) return 0;
  return valid.reduce((s: number, d: any) => s + (d[key] ?? 0), 0) / valid.length;
}

/* ── SVG Ring Gauge ── */
const RingGauge = ({ value, max, label, unit, avg, color, delay = 0 }: {
  value: number; max: number; label: string; unit?: string; avg?: number; color: string; delay?: number;
}) => {
  const r = 54, stroke = 10, circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-2" style={{ animation: `oura-fade-up .7s ease-out ${delay}ms both` }}>
      <svg width="140" height="140" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" transform="rotate(-90 64 64)"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ "--ring-circ": circ, "--ring-offset": offset, animation: `oura-ring-fill 1.2s ease-out ${delay + 200}ms both` } as any}
        />
        <text x="64" y="58" textAnchor="middle" fill="white" fontSize="28" fontWeight="800"
          style={{ animation: `oura-number-pop .6s ease-out ${delay + 400}ms both` }}>
          {Math.round(value)}
        </text>
        {unit && <text x="64" y="74" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" fontWeight="600">{unit}</text>}
      </svg>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      {avg !== undefined && (
        <span className="text-[10px] text-slate-500">vs avg {Math.round(avg)}</span>
      )}
    </div>
  );
};

/* ── Mini sparkline (pure SVG) ── */
const Sparkline = ({ points, color, w = 64, h = 24 }: { points: number[]; color: string; w?: number; h?: number }) => {
  if (!points.length) return null;
  const mn = Math.min(...points), mx = Math.max(...points);
  const range = mx - mn || 1;
  const coords = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - mn) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

/* ── Glassmorphism Card ── */
const Glass = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div className={`rounded-2xl border border-white/[0.07] p-5 md:p-6 ${className}`}
    style={{ background: "rgba(15,22,56,0.55)", backdropFilter: "blur(16px)", animation: `oura-fade-up .65s ease-out ${delay}ms both` }}>
    {children}
  </div>
);

/* ── Section Title with description ── */
const SectionHeader = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="mb-5">
    <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[.22em] mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-slate-500" /> {title}
    </h3>
    <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{description}</p>
  </div>
);

/* ── Tooltip ── */
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0b0d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] text-slate-500 mb-1 font-semibold tracking-wider uppercase">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ── Stat Card (vital grid) ── */
const StatCard = ({ icon: Icon, label, subtitle, value, unit, spark, change, color, daysLabel, delay = 0 }: {
  icon: any; label: string; subtitle: string; value: string | number; unit: string; spark: number[]; change: number; color: string; daysLabel: string; delay?: number;
}) => (
  <div className="rounded-xl border border-white/[0.06] p-4 flex flex-col gap-2"
    style={{ background: "rgba(15,22,56,0.5)", backdropFilter: "blur(12px)", animation: `oura-fade-up .55s ease-out ${delay}ms both` }}>
    <div className="flex items-center justify-between">
      <Icon className="w-4 h-4" style={{ color }} />
      <Sparkline points={spark} color={color} />
    </div>
    <p className="text-2xl font-black text-white leading-none">{value}<span className="text-xs font-semibold text-slate-500 ml-1">{unit}</span></p>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      {change !== 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${change > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {change > 0 ? "+" : ""}{change}%
        </span>
      )}
    </div>
    <p className="text-[9px] text-slate-600 leading-tight">{subtitle}</p>
    <p className="text-[8px] text-slate-600 uppercase tracking-wider">{daysLabel}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const OuraProfile = () => {
  const [sleepHistory, setSleepHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [stressData, setStressData] = useState<any[]>([]);
  const [cardioAge, setCardioAge] = useState<any[]>([]);
  const [todayData, setTodayData] = useState<any>(null);
  const [contributors, setContributors] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Interval>("ALL");
  const [workout, setWorkout] = useState<any>(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);

  useEffect(() => {
    // Auto-refresh from Oura API first, then load all data
    api.get("/api/oura/refresh").catch(() => {}).finally(() => {
      Promise.all([
        api.get("/api/oura/sleep-history"),
        api.get("/api/oura/stats"),
        api.get("/api/oura/workouts"),
        api.get("/api/oura/stress-detail"),
        api.get("/api/oura/cardiovascular-age"),
        api.get("/api/oura/today"),
        api.get("/api/oura/contributors").catch(() => null),
        api.get("/api/calendar/events?days=7").catch(() => ({ events: [] })),
      ])
        .then(([sh, st, wo, sd, ca, td, ct, cal]) => {
          setSleepHistory(sh.data ?? []);
          setStats(st);
          setWorkouts(wo.data ?? []);
          setStressData(sd.data ?? []);
          setCardioAge(ca.data ?? []);
          setTodayData(td);
          if (ct) setContributors(ct);
          setCalendarEvents(cal?.events ?? []);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, []);

  /* ── derived data ── */
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const completeDays = useMemo(() => sleepHistory.filter((d: any) => {
    if (d.day === today && (d.totalSleepHours < 3 || d.activityScore === 0 || d.efficiency < 60)) return false;
    return true;
  }), [sleepHistory, today]);

  const allChart = useMemo(() => completeDays.map((d: any) => ({
    ...d,
    label: fmtDate(d.day),
    deepPct: Math.round((d.deepSleepPct ?? 0) * 100),
    remPct: Math.round((d.remSleepPct ?? 0) * 100),
    lightPct: Math.round((d.lightSleepPct ?? 0) * 100),
    awakePct: Math.round((d.awakePct ?? 0) * 100),
    sleepHrs: d.totalSleepSeconds ? +(d.totalSleepSeconds / 3600).toFixed(1) : 0,
  })), [completeDays]);

  const chart = useMemo(() => sliceDays(allChart, range), [allChart, range]);
  const stressChart = useMemo(() => sliceDays(stressData, range).map((d: any) => ({ ...d, label: fmtDate(d.day) })), [stressData, range]);
  const cardioChart = useMemo(() => sliceDays(cardioAge, range).map((d: any) => ({ ...d, label: fmtDate(d.day) })), [cardioAge, range]);

  const latest = allChart.length ? allChart[allChart.length - 1] : null;
  const ti = tickInterval(chart.length);
  const dayCount = intervalDayCount(range, allChart.length);
  const daysLabel = `avg over ${chart.length} days`;

  /* ── computed averages from filtered chart data ── */
  const avgHR = useMemo(() => +avgOf(chart, "avgHeartRate").toFixed(0), [chart]);
  const avgHRV = useMemo(() => +avgOf(chart, "hrv").toFixed(0), [chart]);
  const avgResp = useMemo(() => +avgOf(chart, "avgRespRate").toFixed(1), [chart]);
  const avgSpO2 = useMemo(() => +avgOf(chart, "spo2Avg").toFixed(1), [chart]);
  const avgDeep = useMemo(() => +avgOf(chart, "deepSleepMin").toFixed(0), [chart]);
  const avgReadiness = useMemo(() => +avgOf(chart, "readinessScore").toFixed(0), [chart]);
  const avgSteps = useMemo(() => +avgOf(chart, "steps").toFixed(0), [chart]);
  const avgEfficiency = useMemo(() => +avgOf(chart, "efficiency").toFixed(0), [chart]);

  /* ── overall averages for % change comparison ── */
  const overallAvgHR = useMemo(() => +avgOf(allChart, "avgHeartRate").toFixed(0), [allChart]);
  const overallAvgHRV = useMemo(() => +avgOf(allChart, "hrv").toFixed(0), [allChart]);
  const overallAvgResp = useMemo(() => +avgOf(allChart, "avgRespRate").toFixed(1), [allChart]);
  const overallAvgSpO2 = useMemo(() => +avgOf(allChart, "spo2Avg").toFixed(1), [allChart]);
  const overallAvgDeep = useMemo(() => +avgOf(allChart, "deepSleepMin").toFixed(0), [allChart]);
  const overallAvgReadiness = useMemo(() => +avgOf(allChart, "readinessScore").toFixed(0), [allChart]);
  const overallAvgSteps = useMemo(() => +avgOf(allChart, "steps").toFixed(0), [allChart]);
  const overallAvgEfficiency = useMemo(() => +avgOf(allChart, "efficiency").toFixed(0), [allChart]);

  /* ── bedtime data ── */
  const bedtimeData = useMemo(() => {
    return sliceDays(completeDays, range)
      .filter((d: any) => {
        if (!d.bedtimeStart) return false;
        // Extract hour from the ISO string directly (already in Boston time from Oura)
        const match = d.bedtimeStart.match(/T(\d{2}):(\d{2})/);
        if (!match) return false;
        const hour = parseInt(match[1], 10);
        return hour >= 18 || hour <= 10;
      })
      .map((d: any) => {
        const match = d.bedtimeStart.match(/T(\d{2}):(\d{2})/);
        const h = parseInt(match![1], 10);
        const m = parseInt(match![2], 10);
        let mins = h * 60 + m;
        if (mins > 720) mins -= 1440;
        return { label: fmtDate(d.day), mins, time: fmtTime(d.bedtimeStart) };
      });
  }, [completeDays, range]);

  /* ── loading / error ── */
  if (loading) return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a0b0d,#111215)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 space-y-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(30,41,59,.4)" }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0b0d" }}>
      <div className="text-center space-y-4">
        <p className="text-xl font-bold text-red-400">Failed to load Oura data</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <Link to="/"><Button variant="ghost">Back</Button></Link>
      </div>
    </div>
  );

  const dateRange = allChart.length > 1 ? `${fmtDate(allChart[0].day)} — ${fmtDate(allChart[allChart.length - 1].day)}` : "";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a0b0d 0%,#111215 100%)" }}>

      {/* Live data indicator */}
      <div className="flex items-center justify-center pt-4 pb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4ade80" }}>
            Live from Oura Ring {dateRange && `-- ${dateRange}`}
          </span>
        </div>
      </div>

      {/* Sticky bar removed — data lives in the orbit now */}
      {false && todayData && (() => {
        const hrTime = todayData.latestHeartRateTime ? new Date(todayData.latestHeartRateTime) : null;
        const isHRLive = hrTime && (Date.now() - hrTime.getTime()) < 30 * 60 * 1000;
        const isHRRecent = hrTime && (Date.now() - hrTime.getTime()) < 6 * 60 * 60 * 1000;
        const todayStr = new Date().toISOString().slice(0, 10);

        // Ring score component matching Oura app style
        const RingScore = ({ value, color, size = 32 }: { value: number | null; color: string; size?: number }) => {
          const r = (size - 4) / 2;
          const circ = 2 * Math.PI * r;
          const offset = value != null ? circ * (1 - value / 100) : circ;
          return (
            <svg width={size} height={size} className="transform -rotate-90">
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1s ease-out" }} />
              <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={size * 0.32} fontWeight="800"
                className="transform rotate-90" style={{ transformOrigin: "center" }}>
                {value ?? "--"}
              </text>
            </svg>
          );
        };

        return (
          <div className="sticky top-14 z-40 border-b border-white/[0.04]"
            style={{ background: "rgba(8,11,30,0.92)", backdropFilter: "blur(24px)" }}>
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center justify-center gap-5 md:gap-7 flex-wrap">

              {/* Sleep */}
              <div className="flex items-center gap-2">
                <RingScore value={todayData.sleepScore} color="#60a5fa" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none">Sleep</span>
                  <span className="text-[9px] text-slate-600 leading-none mt-0.5">
                    {todayData.sleepDay === todayStr ? "Today" : "Last night"}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/[0.06]" />

              {/* Readiness */}
              <div className="flex items-center gap-2">
                <RingScore value={todayData.readinessScore} color="#4ade80" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold leading-none">Readiness</span>
                  <span className="text-[9px] text-slate-600 leading-none mt-0.5">
                    {todayData.readinessDay === todayStr ? "Today" : "Last night"}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/[0.06]" />

              {/* HRV */}
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-violet-400">{todayData.hrv ?? "--"}</span>
                    <span className="text-[9px] text-slate-500">ms</span>
                  </div>
                  <span className="text-[9px] text-slate-600 leading-none">HRV (last night)</span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/[0.06]" />

              {/* Heart Rate */}
              <div className="flex items-center gap-2">
                <Heart className={`w-4 h-4 text-red-400 ${isHRLive ? "animate-pulse" : ""}`} />
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-black ${isHRRecent ? "text-red-400" : "text-red-400/50"}`}>
                      {todayData.latestHeartRate ?? "--"}
                    </span>
                    <span className="text-[9px] text-slate-500">bpm</span>
                  </div>
                  <span className="text-[9px] text-slate-600 leading-none">
                    {isHRLive ? (
                      <span className="text-emerald-500">Live</span>
                    ) : hrTime ? (
                      hrTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" })
                    ) : "No data"}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/[0.06]" />

              {/* Stress */}
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-amber-400">{todayData.stressMin ?? "--"}</span>
                    <span className="text-[9px] text-slate-500">min</span>
                  </div>
                  <span className="text-[9px] text-slate-600 leading-none">
                    Stress {todayData.stressDay === todayStr ? "today" : "yesterday"}
                  </span>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-7">

        {/* ═══════ THE HERO: PLAN YOUR DAY ═══════ */}
        <PlanOrbit todayData={todayData} calendarEvents={calendarEvents} stats={stats} sleepHistory={sleepHistory} stressData={stressData} />


        {/* Everything below the orbit is hidden -- the orbit IS the product */}
        {false && (
        <div>
        {/* ═══════ WHAT YOUR BODY IS SAYING — instant, data-driven ═══════ */}
        {latest && (() => {
          const insights: { text: string; type: "good" | "warn" | "bad"; question?: string }[] = [];
          const last3 = allChart.slice(-3);
          const last7 = allChart.slice(-7);
          const prior7 = allChart.slice(-14, -7);

          const avg7 = (key: string) => { const v = last7.filter((d: any) => d[key]); return v.length ? v.reduce((s: number, d: any) => s + d[key], 0) / v.length : 0; };
          const avgP7 = (key: string) => { const v = prior7.filter((d: any) => d[key]); return v.length ? v.reduce((s: number, d: any) => s + d[key], 0) / v.length : 0; };
          const avg3 = (key: string) => { const v = last3.filter((d: any) => d[key]); return v.length ? v.reduce((s: number, d: any) => s + d[key], 0) / v.length : 0; };

          // HRV trend
          const hrv7 = avg7("hrv"), hrvP = avgP7("hrv");
          if (hrvP > 0) {
            const hrvChg = ((hrv7 - hrvP) / hrvP * 100);
            if (hrvChg < -15) insights.push({ text: `Your HRV dropped ${Math.abs(Math.round(hrvChg))}% this week. Your nervous system is recovering slower than usual.`, type: "bad", question: "Have you been sleeping less or more stressed than normal?" });
            else if (hrvChg < -5) insights.push({ text: `HRV is down ${Math.abs(Math.round(hrvChg))}% from last week. Your body is working harder to recover.`, type: "warn" });
            else if (hrvChg > 10) insights.push({ text: `HRV is up ${Math.round(hrvChg)}% this week. Your body is recovering well.`, type: "good" });
          }

          // RHR trend (inverse — rising is bad)
          const rhr7 = avg7("avgHeartRate"), rhrP = avgP7("avgHeartRate");
          if (rhrP > 0) {
            const rhrChg = ((rhr7 - rhrP) / rhrP * 100);
            if (rhrChg > 5) insights.push({ text: `Resting heart rate is up ${Math.round(rhrChg)}%. When your heart works harder at rest, something is off.`, type: "bad", question: "Are you fighting off a cold, or training harder than usual?" });
            else if (rhr7 < 55) insights.push({ text: `Resting HR at ${Math.round(rhr7)} bpm. That's athlete-level. Your heart is efficient.`, type: "good" });
          }

          // Sleep duration
          const sleepHrs = avg7("totalSleepHours");
          const shortNights = last7.filter((d: any) => d.totalSleepHours && d.totalSleepHours < 6).length;
          if (shortNights >= 3) insights.push({ text: `${shortNights} out of 7 nights you slept under 6 hours. Sleep debt is real and it compounds.`, type: "bad", question: "What's keeping you up? Work, screens, or just not getting to bed early enough?" });
          else if (sleepHrs >= 7.5) insights.push({ text: `Averaging ${sleepHrs.toFixed(1)} hours of sleep. Your body has enough time to repair itself.`, type: "good" });
          else if (sleepHrs < 7) insights.push({ text: `Only ${sleepHrs.toFixed(1)} hours of sleep on average. Your brain needs 7+ hours to flush waste and consolidate memory.`, type: "warn" });

          // Deep sleep
          const deep7 = avg7("deepSleepMin");
          if (deep7 < 50) insights.push({ text: `Deep sleep averaging ${Math.round(deep7)} min. This is the phase where your body releases growth hormone and repairs tissue. You need more.`, type: "bad", question: "Are you eating or exercising too close to bedtime?" });
          else if (deep7 > 80) insights.push({ text: `${Math.round(deep7)} min of deep sleep per night. This is where your body rebuilds itself. You're in a good place.`, type: "good" });

          // Readiness
          const ready7 = avg7("readinessScore");
          const readyLow = last7.filter((d: any) => d.readinessScore && d.readinessScore < 65).length;
          if (readyLow >= 3) insights.push({ text: `Readiness below 65 on ${readyLow} of the last 7 days. Your body is telling you it needs a break.`, type: "bad", question: "Can you take one easier day this week? Sometimes slowing down is the fastest way forward." });
          else if (ready7 > 80) insights.push({ text: `Readiness averaging ${Math.round(ready7)}. Your body is ready to perform.`, type: "good" });

          // Stress
          const stress7 = avg7("stressMin");
          const highStress = last7.filter((d: any) => d.stressMin && d.stressMin > 120).length;
          if (highStress >= 3) insights.push({ text: `More than 2 hours of high stress on ${highStress} days this week. Chronic stress shrinks the part of your brain that handles memory and learning.`, type: "bad", question: "What's your biggest source of stress right now? Even naming it helps." });

          // Efficiency
          const eff7 = avg7("efficiency");
          if (eff7 > 0 && eff7 < 80) insights.push({ text: `Sleep efficiency at ${Math.round(eff7)}%. You're spending too much time in bed awake.`, type: "warn", question: "Do you lie in bed scrolling before sleep? Try getting in bed only when you're actually tired." });

          // Best day callout
          const bestDay = last7.reduce((best: any, d: any) => (!best || (d.readinessScore || 0) > (best.readinessScore || 0)) ? d : best, null);
          const worstDay = last7.reduce((worst: any, d: any) => (!worst || (d.readinessScore || 0) < (worst.readinessScore || 0) && d.readinessScore > 0) ? d : worst, null);

          if (insights.length === 0) {
            insights.push({ text: "Everything looks stable this week. Keep doing what you're doing.", type: "good" });
          }

          const colors = { good: { bg: "rgba(74,222,128,.06)", border: "rgba(74,222,128,.15)", text: "#4ADE80" }, warn: { bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.15)", text: "#FBBF24" }, bad: { bg: "rgba(248,113,113,.06)", border: "rgba(248,113,113,.15)", text: "#F87171" } };

          return (
            <Glass delay={120}>
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[.22em] mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Your weekly check-in
              </h3>
              <p className="text-xs text-slate-600 mb-4">No jargon. No charts to decode. Just what's going on with you right now and what to do about it.</p>
              <div className="space-y-3">
                {insights.map((ins, i) => {
                  const c = colors[ins.type];
                  return (
                    <div key={i} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                      <p className="text-sm text-slate-200 leading-relaxed">{ins.text}</p>
                      {ins.question && (
                        <p className="text-xs mt-2 italic" style={{ color: c.text }}>{ins.question}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Glass>
          );
        })()}

        {/* ═══════ VITAL GRID (4 key cards) ═══════ */}
        {chart.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Heart} label="Resting HR"
              subtitle="How chill your heart is at rest. Lower = fitter you."
              value={avgHR || "--"} unit="bpm"
              spark={sparkPoints(chart, "avgHeartRate")}
              change={pctChange(avgHR, overallAvgHR)}
              color="#F87171" daysLabel={daysLabel} delay={200} />
            <StatCard icon={Brain} label="HRV"
              subtitle="Your stress battery. Higher = more capacity to handle the day."
              value={avgHRV || "--"} unit="ms"
              spark={sparkPoints(chart, "hrv")}
              change={pctChange(avgHRV, overallAvgHRV)}
              color="#8B5CF6" daysLabel={daysLabel} delay={250} />
            <StatCard icon={Moon} label="Deep Sleep"
              subtitle="The phase where your body actually rebuilds. More = better recovery."
              value={avgDeep || "--"} unit="min"
              spark={sparkPoints(chart, "deepSleepMin")}
              change={pctChange(avgDeep, overallAvgDeep)}
              color="#38BDF8" daysLabel={daysLabel} delay={300} />
            <StatCard icon={TrendingUp} label="Readiness"
              subtitle="Should you go hard or take it easy today? This number tells you."
              value={avgReadiness || "--"} unit="/100"
              spark={sparkPoints(chart, "readinessScore")}
              change={pctChange(avgReadiness, overallAvgReadiness)}
              color="#4ADE80" daysLabel={daysLabel} delay={350} />
          </div>
        )}

        {/* ═══════ WHY THIS PLAN ═══════ */}
        <div className="pt-4">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-center mb-1" style={{ color: "rgba(139,92,246,0.5)" }}>Why this plan</p>
          <h3 className="text-xl font-bold text-white text-center mb-2">The data behind your recommendations</h3>
          <p className="text-xs text-slate-600 text-center max-w-md mx-auto mb-4">Every suggestion above comes from these trends. This is what your wearable has been tracking while you've been living your life.</p>
          <div className="flex items-center justify-center gap-1 mb-4">
            {(["7D", "14D", "30D", "ALL"] as Interval[]).map((iv) => (
              <button key={iv}
                onClick={() => setRange(iv)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border-0
                  ${range === iv ? "bg-violet-500/20 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,.15)]" : "text-slate-500 hover:text-slate-300 bg-transparent"}`}>
                {iv}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ SLEEP SCORE TREND ═══════ */}
        <Glass delay={350}>
          <SectionHeader icon={Moon} title="How you've been sleeping"
            description="Each dot is a night. Above 85 means you crushed it. Below 65 means something was off. Watch the trend, not the individual nights." />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={ti} />
              <YAxis yAxisId="score" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[40, 100]} />
              <YAxis yAxisId="hrv" orientation="right" tick={{ fill: "#8B5CF6", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <ReferenceLine yAxisId="score" y={65} stroke="#F87171" strokeDasharray="4 4" strokeOpacity={0.3} />
              {stats?.avgSleepScore && (
                <ReferenceLine yAxisId="score" y={stats.avgSleepScore} stroke="#3B82F6" strokeDasharray="6 4" strokeOpacity={0.3}
                  label={{ value: `Avg ${Math.round(stats.avgSleepScore)}`, fill: "#3B82F666", fontSize: 10, position: "insideTopRight" }} />
              )}
              <Area yAxisId="score" type="monotone" dataKey="sleepScore" stroke="#3B82F6" strokeWidth={2} fill="url(#sleepGrad)"
                dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "#0a0b0d", strokeWidth: 2 }} name="Sleep Score" />
              <Area yAxisId="hrv" type="monotone" dataKey="hrv" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 3"
                fill="none" dot={false} activeDot={{ r: 3, fill: "#8B5CF6" }} name="HRV (ms)" />
            </AreaChart>
          </ResponsiveContainer>
        </Glass>

        {/* Sleep Stages — hidden for demo flow */}
        {false && (
        <Glass delay={420}>
          <SectionHeader icon={Moon} title="Sleep Stages"
            description="Your sleep has 4 phases. Deep sleep fixes your body. REM processes your emotions and memories. Light sleep is filler. Awake time is wasted. You want more blue and purple." />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="sg-deep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.85} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="sg-rem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="sg-light" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#475569" stopOpacity={0.6} /><stop offset="100%" stopColor="#475569" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="sg-awake" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.7} /><stop offset="100%" stopColor="#F87171" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={ti} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="deepPct" stackId="1" stroke="#3B82F6" fill="url(#sg-deep)" name="Deep %" />
              <Area type="monotone" dataKey="remPct" stackId="1" stroke="#8B5CF6" fill="url(#sg-rem)" name="REM %" />
              <Area type="monotone" dataKey="lightPct" stackId="1" stroke="#475569" fill="url(#sg-light)" name="Light %" />
              <Area type="monotone" dataKey="awakePct" stackId="1" stroke="#F87171" fill="url(#sg-awake)" name="Awake %" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-3 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Deep</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> REM</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500" /> Light</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Awake</span>
          </div>
        </Glass>

        )}

        {/* ═══════ STRESS & RECOVERY ═══════ */}
        {stressChart.length > 0 && (
          <Glass delay={490}>
            <SectionHeader icon={Zap} title="Stress vs Recovery"
              description="Red days = your body was running on fumes. Green days = it was actually recharging. If you see too much red, that's exactly when YU steps in with a plan." />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stressChart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={tickInterval(stressChart.length)} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="stressMin" name="Stress min" radius={[4, 4, 0, 0]}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const s = (payload.summary ?? "").toLowerCase();
                    const c = s.includes("stress") ? "#F87171" : s.includes("restor") ? "#4ADE80" : "#F59E0B";
                    return <rect x={x} y={y} width={width} height={Math.max(height, 0)} rx={4} fill={c} fillOpacity={0.8} />;
                  }} />
                <Bar dataKey="recoveryMin" name="Recovery min" radius={[4, 4, 0, 0]} fill="#4ADE80" fillOpacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-5 mt-2 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Stressful</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/50" /> Recovery</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.04]">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Stressful Days</p>
                <p className="text-2xl font-black text-red-400">{stressChart.filter((d: any) => (d.summary ?? "").toLowerCase().includes("stress")).length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Avg Stress</p>
                <p className="text-2xl font-black text-slate-300">
                  {Math.round(stressChart.reduce((s: number, d: any) => s + (d.stressMin || 0), 0) / stressChart.length)}
                  <span className="text-xs text-slate-500 ml-1">min</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Worst Day</p>
                <p className="text-2xl font-black text-amber-400">
                  {Math.max(...stressChart.map((d: any) => d.stressMin || 0))}
                  <span className="text-xs text-slate-500 ml-1">min</span>
                </p>
              </div>
            </div>
          </Glass>
        )}

        {/* ═══════ 7. READINESS + ACTIVITY ═══════ */}
        <Glass delay={560}>
          <SectionHeader icon={TrendingUp} title="Are you overdoing it?"
            description="Blue = how hard you pushed. Green = how recovered you were. When blue keeps climbing but green drops, you're running a deficit. That's when burnout hits." />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart.filter((d: any) => d.activityScore > 0)} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="rdyG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.3} /><stop offset="100%" stopColor="#4ADE80" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="actG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={ti} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[30, 100]} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="readinessScore" stroke="#4ADE80" strokeWidth={2} fill="url(#rdyG)"
                dot={false} activeDot={{ r: 4, fill: "#4ADE80", stroke: "#0a0b0d", strokeWidth: 2 }} name="Readiness" />
              <Area type="monotone" dataKey="activityScore" stroke="#3B82F6" strokeWidth={2} fill="url(#actG)"
                dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "#0a0b0d", strokeWidth: 2 }} name="Activity" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-2 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Readiness</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Activity</span>
          </div>
        </Glass>

        {/* ═══════ GO DEEPER ═══════ */}
        <div className="pt-4">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-center mb-1" style={{ color: "rgba(16,185,129,0.6)" }}>Go deeper</p>
          <h3 className="text-xl font-bold text-white text-center mb-2">Build out your plan</h3>
          <p className="text-xs text-slate-600 text-center max-w-md mx-auto mb-6">Want more detail? Pick your workout type below and AI will program the full session based on exactly where your body is right now.</p>
        </div>

        {false && /* Deep-dive sections — available on /oura */  (<>
        <Glass delay={630}>
          <SectionHeader icon={Heart} title="Heart Rate & HRV"
            description="Two numbers that tell you how fit you are. Heart rate going down = your heart is getting stronger. HRV going up = your body handles stress better." />
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="hrG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.3} /><stop offset="100%" stopColor="#F87171" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="hrvG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={ti} />
              <YAxis yAxisId="hr" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="hrv" orientation="right" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <Area yAxisId="hr" type="monotone" dataKey="avgHeartRate" stroke="#F87171" strokeWidth={2} fill="url(#hrG)"
                dot={false} activeDot={{ r: 4, fill: "#F87171" }} name="HR bpm" />
              <Area yAxisId="hrv" type="monotone" dataKey="hrv" stroke="#8B5CF6" strokeWidth={2} fill="url(#hrvG2)"
                dot={false} activeDot={{ r: 4, fill: "#8B5CF6" }} name="HRV ms" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-2 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Heart Rate</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> HRV</span>
          </div>
        </Glass>

        {/* ═══════ 9. CARDIOVASCULAR AGE ═══════ */}
        {cardioChart.length > 0 && (
          <Glass delay={700}>
            <SectionHeader icon={Heart} title="Cardiovascular Age"
              description="How old is your heart compared to your real age? Lower = your heart is younger than you. That's the goal." />
            <div className="flex items-center gap-5 mb-5">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Actual</p>
                <p className="text-3xl font-black text-slate-300">{stats?.age ?? 36}</p>
              </div>
              <span className="text-slate-600 text-lg">&rarr;</span>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Vascular</p>
                <p className="text-3xl font-black text-emerald-400">{cardioChart[cardioChart.length - 1]?.vascularAge ?? "--"}</p>
              </div>
              {cardioChart[cardioChart.length - 1]?.vascularAge && (
                <span className="ml-2 px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide"
                  style={{ background: "rgba(74,222,128,.12)", color: "#4ADE80" }}>
                  {(stats?.age ?? 36) - cardioChart[cardioChart.length - 1].vascularAge} yrs younger
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cardioChart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="caG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F472B6" stopOpacity={0.3} /><stop offset="100%" stopColor="#F472B6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={tickInterval(cardioChart.length)} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[25, 40]} />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={stats?.age ?? 36} stroke="#64748b" strokeDasharray="6 4" strokeOpacity={0.4}
                  label={{ value: `Actual Age: ${stats?.age ?? 36}`, fill: "#64748b88", fontSize: 10, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="vascularAge" stroke="#F472B6" strokeWidth={2} fill="url(#caG)"
                  dot={false} activeDot={{ r: 4, fill: "#F472B6", stroke: "#0a0b0d", strokeWidth: 2 }} name="Vascular Age" />
              </AreaChart>
            </ResponsiveContainer>
          </Glass>
        )}

        {/* ═══════ 10. BEDTIME PATTERNS ═══════ */}
        {bedtimeData.length > 0 && (
          <Glass delay={770}>
            <SectionHeader icon={Clock} title="Bedtime Patterns"
              description="Your brain loves routine. Going to bed at the same time every night is one of the biggest sleep quality levers you have." />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bedtimeData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="btG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity={0.3} /><stop offset="100%" stopColor="#818CF8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={tickInterval(bedtimeData.length)} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} reversed
                  tickFormatter={(v: number) => {
                    let m = v; if (m < 0) m += 1440;
                    const h = Math.floor(m / 60) % 12 || 12;
                    const min = Math.round(m % 60);
                    const ampm = m >= 720 ? "PM" : "AM";
                    return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
                  }} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl border border-white/10 bg-[#0a0b0d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{label}</p>
                      <p className="text-sm font-bold text-indigo-400">{payload[0]?.payload?.time}</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="mins" stroke="#818CF8" strokeWidth={2} fill="url(#btG)"
                  dot={false} activeDot={{ r: 4, fill: "#818CF8", stroke: "#0a0b0d", strokeWidth: 2 }} name="Bedtime" />
              </AreaChart>
            </ResponsiveContainer>
          </Glass>
        )}

        {/* ═══════ 11. SCORE CONTRIBUTORS (Oura-style) ═══════ */}
        {contributors && (() => {
          const ContributorBar = ({ label, value, color }: { label: string; value: number | null; color: string }) => {
            const v = value ?? 0;
            const barColor = v >= 80 ? color : v >= 60 ? "#F59E0B" : "#EF4444";
            return (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-bold" style={{ color: barColor }}>{v}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${v}%`, background: barColor }} />
                </div>
              </div>
            );
          };

          const sc = contributors.sleep?.contributors;
          const rc = contributors.readiness?.contributors;
          const ac = contributors.activity?.contributors;
          const res = contributors.resilience;
          const spo2 = contributors.spo2;
          const st = contributors.sleepTime;

          return (
            <>
              {/* Sleep Contributors */}
              {sc && (
                <Glass delay={840}>
                  <SectionHeader icon={Moon} title="Sleep Score Breakdown"
                    description={`Score: ${contributors.sleep?.score ?? "--"}/100. The short bars are dragging your score down.`} />
                  <div className="space-y-2.5">
                    <ContributorBar label="Total Sleep" value={sc.total_sleep} color="#3B82F6" />
                    <ContributorBar label="Deep Sleep" value={sc.deep_sleep} color="#3B82F6" />
                    <ContributorBar label="REM Sleep" value={sc.rem_sleep} color="#8B5CF6" />
                    <ContributorBar label="Efficiency" value={sc.efficiency} color="#2DD4BF" />
                    <ContributorBar label="Restfulness" value={sc.restfulness} color="#818CF8" />
                    <ContributorBar label="Latency" value={sc.latency} color="#F59E0B" />
                    <ContributorBar label="Timing" value={sc.timing} color="#4ADE80" />
                  </div>
                </Glass>
              )}

              {/* Readiness Contributors */}
              {rc && (
                <Glass delay={880}>
                  <SectionHeader icon={Zap} title="Readiness Score Breakdown"
                    description={`Score: ${contributors.readiness?.score ?? "--"}/100. These factors determine how ready your body is today.`} />
                  <div className="space-y-2.5">
                    <ContributorBar label="Previous Night" value={rc.previous_night} color="#4ADE80" />
                    <ContributorBar label="Sleep Balance" value={rc.sleep_balance} color="#3B82F6" />
                    <ContributorBar label="Sleep Regularity" value={rc.sleep_regularity} color="#8B5CF6" />
                    <ContributorBar label="HRV Balance" value={rc.hrv_balance} color="#A78BFA" />
                    <ContributorBar label="Resting Heart Rate" value={rc.resting_heart_rate} color="#F87171" />
                    <ContributorBar label="Recovery Index" value={rc.recovery_index} color="#2DD4BF" />
                    <ContributorBar label="Body Temperature" value={rc.body_temperature} color="#FB923C" />
                    <ContributorBar label="Activity Balance" value={rc.activity_balance} color="#FBBF24" />
                    <ContributorBar label="Previous Day Activity" value={rc.previous_day_activity} color="#34D399" />
                  </div>
                  {contributors.readiness?.temperatureDeviation != null && (
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-4">
                      <div className="text-xs text-slate-500">Body Temp</div>
                      <div className="text-sm font-bold" style={{
                        color: Math.abs(contributors.readiness.temperatureDeviation) > 0.5 ? "#F87171" :
                               Math.abs(contributors.readiness.temperatureDeviation) > 0.2 ? "#FBBF24" : "#4ADE80"
                      }}>
                        {contributors.readiness.temperatureDeviation > 0 ? "+" : ""}{contributors.readiness.temperatureDeviation.toFixed(2)}°C
                      </div>
                      {contributors.readiness.temperatureTrendDeviation != null && (
                        <>
                          <div className="text-xs text-slate-500">Trend</div>
                          <div className="text-sm font-bold" style={{
                            color: Math.abs(contributors.readiness.temperatureTrendDeviation) > 0.3 ? "#F87171" : "#4ADE80"
                          }}>
                            {contributors.readiness.temperatureTrendDeviation > 0 ? "+" : ""}{contributors.readiness.temperatureTrendDeviation.toFixed(2)}°C
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Glass>
              )}

              {/* Activity Contributors */}
              {ac && (
                <Glass delay={920}>
                  <SectionHeader icon={Activity} title="Activity Score Breakdown"
                    description={`Score: ${contributors.activity?.score ?? "--"}/100. ${contributors.activity?.steps?.toLocaleString() ?? 0} steps, ${contributors.activity?.activeCalories ?? 0} active cal.`} />
                  <div className="space-y-2.5">
                    <ContributorBar label="Stay Active" value={ac.stay_active} color="#FB923C" />
                    <ContributorBar label="Move Every Hour" value={ac.move_every_hour} color="#FBBF24" />
                    <ContributorBar label="Meet Daily Targets" value={ac.meet_daily_targets} color="#4ADE80" />
                    <ContributorBar label="Training Frequency" value={ac.training_frequency} color="#3B82F6" />
                    <ContributorBar label="Training Volume" value={ac.training_volume} color="#8B5CF6" />
                    <ContributorBar label="Recovery Time" value={ac.recovery_time} color="#2DD4BF" />
                  </div>
                </Glass>
              )}

              {/* Resilience + SpO2 + Sleep Time row */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Resilience */}
                {res && (
                  <Glass delay={960}>
                    <SectionHeader icon={TrendingUp} title="Resilience"
                      description={`Level: ${(res.level || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}`} />
                    <div className="space-y-2.5">
                      <ContributorBar label="Sleep Recovery" value={Math.round(res.contributors?.sleep_recovery ?? 0)} color="#3B82F6" />
                      <ContributorBar label="Daytime Recovery" value={Math.round(res.contributors?.daytime_recovery ?? 0)} color="#4ADE80" />
                      <ContributorBar label="Stress Management" value={Math.round(res.contributors?.stress ?? 0)} color="#F59E0B" />
                    </div>
                  </Glass>
                )}

                {/* SpO2 + Breathing + Sleep Time */}
                <Glass delay={980}>
                  {spo2 && (
                    <div className="mb-5">
                      <SectionHeader icon={Droplets} title="Blood Oxygen"
                        description="Overnight SpO2 and breathing quality." />
                      <div className="flex items-center gap-6 mt-2">
                        <div>
                          <div className="text-2xl font-black text-blue-400">{spo2.average?.toFixed(1) ?? "--"}%</div>
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Avg SpO2</div>
                        </div>
                        {spo2.breathingDisturbanceIndex != null && (
                          <div>
                            <div className="text-2xl font-black" style={{
                              color: spo2.breathingDisturbanceIndex <= 2 ? "#4ADE80" :
                                     spo2.breathingDisturbanceIndex <= 5 ? "#FBBF24" : "#F87171"
                            }}>
                              {spo2.breathingDisturbanceIndex}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Breathing Index</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {st && (
                    <div>
                      <SectionHeader icon={Clock} title="Bedtime Guidance" description="" />
                      <div className="mt-2">
                        <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                          style={{
                            background: st.recommendation?.includes("earlier") ? "rgba(248,113,113,.12)" :
                                        st.recommendation?.includes("later") ? "rgba(245,158,11,.12)" : "rgba(74,222,128,.12)",
                            color: st.recommendation?.includes("earlier") ? "#F87171" :
                                   st.recommendation?.includes("later") ? "#F59E0B" : "#4ADE80",
                          }}>
                          {(st.recommendation || "no data").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  )}
                </Glass>
              </div>
            </>
          );
        })()}

        </>)}

        {/* Recent Workouts table — hidden for demo flow, available on /oura */}

        {/* ═══════ WORKOUT BUILDER ═══════ */}
        <Glass delay={950}>
          <SectionHeader icon={Dumbbell} title="What should I do today?"
            description="Pick what you're into. AI will program the exact session your body can handle right now, based on how you slept and how stressed you've been. No guessing." />

          {!workout ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 text-center">What do you want to do tomorrow?</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setWorkoutLoading(true);
                    setWorkout(null);
                    api.get("/api/oura/workout?session_type=crossfit")
                      .then(setWorkout)
                      .catch(() => setWorkout({ error: "Failed to generate" }))
                      .finally(() => setWorkoutLoading(false));
                  }}
                  disabled={workoutLoading}
                  className="rounded-2xl p-5 border cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)" }}>
                  <Dumbbell className="w-7 h-7 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">Home CrossFit</p>
                  <p className="text-[10px] text-slate-500 mt-1">AI programs intensity from your data</p>
                </button>
                <button
                  onClick={() => {
                    setWorkoutLoading(true);
                    setWorkout(null);
                    api.get("/api/oura/workout?session_type=yoga")
                      .then(setWorkout)
                      .catch(() => setWorkout({ error: "Failed to generate" }))
                      .finally(() => setWorkoutLoading(false));
                  }}
                  disabled={workoutLoading}
                  className="rounded-2xl p-5 border cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.2)" }}>
                  <Flame className="w-7 h-7 text-violet-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">Hot Flow Yoga</p>
                  <p className="text-[10px] text-slate-500 mt-1">Pre/post guidance for your state</p>
                </button>
                <button
                  onClick={() => {
                    setWorkoutLoading(true);
                    setWorkout(null);
                    api.get("/api/oura/workout?session_type=rest")
                      .then(setWorkout)
                      .catch(() => setWorkout({ error: "Failed to generate" }))
                      .finally(() => setWorkoutLoading(false));
                  }}
                  disabled={workoutLoading}
                  className="rounded-2xl p-5 border cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.2)" }}>
                  <Heart className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">Rest & Recover</p>
                  <p className="text-[10px] text-slate-500 mt-1">Micro-interventions to recharge</p>
                </button>
              </div>
              {workoutLoading && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-slate-500">Gemini is programming your workout...</span>
                </div>
              )}
            </div>
          ) : workout.error ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-400">{workout.error}</p>
              <button onClick={() => setWorkout(null)} className="text-xs text-slate-500 mt-2 underline cursor-pointer border-0 bg-transparent">Try again</button>
            </div>
          ) : workout.session_type === "yoga" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-white">{workout.title}</h4>
                <span className="text-xs text-violet-400 font-bold px-3 py-1 rounded-full" style={{ background: "rgba(139,92,246,.12)" }}>
                  ~{workout.duration_min} min / ~{workout.estimated_calories} kcal
                </span>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.15)" }}>
                <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold mb-1">Before class</p>
                <p className="text-sm text-slate-300">{workout.pre_session}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)" }}>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-1">After class</p>
                <p className="text-sm text-slate-300">{workout.post_session}</p>
              </div>
              {workout.hydration_note && (
                <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.15)" }}>
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1">Hydration</p>
                  <p className="text-sm text-slate-300">{workout.hydration_note}</p>
                </div>
              )}
              <p className="text-xs text-slate-400 italic">{workout.why_good_choice}</p>
              <button onClick={() => setWorkout(null)} className="text-xs text-slate-600 underline cursor-pointer border-0 bg-transparent">Change session type</button>
            </div>
          ) : workout.session_type === "rest" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-white">{workout.title}</h4>
                <span className="text-xs text-emerald-400 font-bold px-3 py-1 rounded-full" style={{ background: "rgba(74,222,128,.12)" }}>
                  Recovery Day
                </span>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(74,222,128,.04)", border: "1px solid rgba(74,222,128,.12)" }}>
                <p className="text-sm text-slate-300 italic">{workout.why_rest}</p>
              </div>
              {workout.micro_interventions?.map((item: any, i: number) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: item.color || "#94a3b8" }}>{item.category}</p>
                    {item.duration && <span className="text-[10px] text-slate-600">{item.duration}</span>}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.description}</p>
                  {item.science && <p className="text-[10px] text-slate-500 mt-2 italic">{item.science}</p>}
                </div>
              ))}
              {workout.walk && (
                <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,.04)", border: "1px solid rgba(59,130,246,.12)" }}>
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1">Optional Walk</p>
                  <p className="text-sm text-slate-300">{workout.walk}</p>
                </div>
              )}
              {workout.sleep_protocol && (
                <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,.04)", border: "1px solid rgba(139,92,246,.12)" }}>
                  <p className="text-[10px] text-violet-400 uppercase tracking-wider font-bold mb-1">Tonight's Sleep Protocol</p>
                  <p className="text-sm text-slate-300">{workout.sleep_protocol}</p>
                </div>
              )}
              <p className="text-[9px] text-slate-600">
                Generated by Gemini 2.5 Pro at {workout.generated_at ? new Date(workout.generated_at).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }) + " ET" : ""}
              </p>
              <button onClick={() => setWorkout(null)} className="text-xs text-slate-600 underline cursor-pointer border-0 bg-transparent">Change session type</button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xl font-black text-white">{workout.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: workout.intensity === "push" ? "rgba(239,68,68,.15)" : workout.intensity === "work" ? "rgba(245,158,11,.15)" : "rgba(74,222,128,.15)",
                        color: workout.intensity === "push" ? "#F87171" : workout.intensity === "work" ? "#FBBF24" : "#4ADE80",
                      }}>
                      {workout.intensity?.toUpperCase()} DAY
                    </span>
                    <span className="text-xs text-slate-500">{workout.format}</span>
                    <span className="text-xs text-slate-500">{workout.duration_min} min</span>
                    {workout.estimated_calories && <span className="text-xs text-slate-500">~{workout.estimated_calories} kcal</span>}
                  </div>
                </div>
              </div>

              {/* Why this workout */}
              <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.15)" }}>
                <p className="text-xs text-slate-300 italic">{workout.why_this_workout}</p>
              </div>

              {/* Mental challenge */}
              {workout.mental_challenge && (
                <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.15)" }}>
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Where you'll want to quit</p>
                  <p className="text-sm text-slate-300">{workout.mental_challenge}</p>
                </div>
              )}

              {/* Warmup */}
              {workout.warmup && (
                <div>
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-2">Warmup ({workout.warmup.duration_min} min)</p>
                  <div className="space-y-1">
                    {workout.warmup.movements?.map((m: string, i: number) => (
                      <p key={i} className="text-sm text-slate-400">{m}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Main workout */}
              {workout.workout && (
                <div>
                  {(() => {
                    const movements: string[] = workout.workout.movements || [];
                    const notes: string = workout.workout.notes || "";
                    const timeCap: string = workout.workout.time_cap || "";
                    const desc: string = workout.workout.description || "";
                    const fmt: string = workout.format || "";

                    // Detect multi-part (Strength + Metcon)
                    const isMultiPart = /strength\s*\+\s*metcon|Part\s+[AB]/i.test(fmt) || /Part\s+[AB]/i.test(desc);

                    if (isMultiPart) {
                      const metconStart = desc.toLowerCase().search(/part\s*b|metcon/i);
                      const strengthDesc = metconStart > 0 ? desc.slice(0, metconStart) : desc;
                      const metconDesc = metconStart > 0 ? desc.slice(metconStart) : "";

                      let splitIdx = 0;
                      for (let i = 0; i < movements.length; i++) {
                        const words = movements[i].toLowerCase().replace(/\(.*?\)/g, "").replace(/^\d+\s*/, "").trim();
                        if (strengthDesc.toLowerCase().includes(words.slice(0, 12))) splitIdx = i + 1;
                      }
                      if (splitIdx === 0 || splitIdx >= movements.length) splitIdx = Math.min(2, movements.length);

                      const sFmt = strengthDesc.match(/(?:E\d+MOM|Every\s+\d+\s+min\S*|EMOM)[^:]*(?:x\s*\d+|\(\d+\s*sets?\)|\d+\s*sets?)?/i);
                      const mFmt = metconDesc.match(/(\d+\s+Rounds?\s+For\s+Time|AMRAP\s+\d+|For\s+Time)/i);
                      const mTC = metconDesc.match(/(?:Time\s*Cap|TC)[:\s]*(\d+\s*min\S*)/i);

                      return (
                        <div className="space-y-5">
                          <div>
                            <p className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1">Strength</p>
                            {sFmt && <p className="text-xs text-slate-500 mb-2">{sFmt[0].trim()}</p>}
                            <div className="space-y-1">
                              {movements.slice(0, splitIdx).map((m: string, i: number) => (
                                <p key={i} className="text-sm text-slate-400">{m}</p>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">
                              Metcon{mFmt ? ` -- ${mFmt[1] || mFmt[0]}` : ""}
                            </p>
                            {(mTC || timeCap) && <p className="text-xs text-slate-500 mb-2">Time Cap: {mTC ? mTC[1] : timeCap}</p>}
                            <div className="space-y-1">
                              {movements.slice(splitIdx).map((m: string, i: number) => (
                                <p key={i} className="text-sm text-slate-400">{m}</p>
                              ))}
                            </div>
                          </div>
                          {notes && (
                            <div>
                              <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Coach Notes</p>
                              <p className="text-sm text-slate-500 leading-relaxed">{notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Single-part workout
                    const fmtMatch = desc.match(/(AMRAP\s+\d+\s*(?:min\S*)?|\d+\s+Rounds?\s+For\s+Time|For\s+Time|E\d+MOM\s*x?\s*\d*|EMOM\s+\d+\s*(?:min\S*)?)/i);
                    const tcMatch = desc.match(/(?:Time\s*Cap|TC)[:\s]*(\d+\s*min\S*)/i);

                    return (
                      <div className="space-y-5">
                        <div>
                          <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">
                            {fmtMatch ? fmtMatch[1] : (fmt || "WOD")}
                          </p>
                          {(tcMatch || timeCap) && <p className="text-xs text-slate-500 mb-2">Time Cap: {tcMatch ? tcMatch[1] : timeCap}</p>}
                          <div className="space-y-1">
                            {movements.map((m: string, i: number) => (
                              <p key={i} className="text-sm text-slate-400">{m}</p>
                            ))}
                          </div>
                        </div>
                        {notes && (
                          <div>
                            <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Coach Notes</p>
                            <p className="text-sm text-slate-500 leading-relaxed">{notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Cooldown */}
              {workout.cooldown && (
                <div>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-2">Cooldown ({workout.cooldown.duration_min} min)</p>
                  <div className="space-y-1">
                    {workout.cooldown.movements?.map((m: string, i: number) => (
                      <p key={i} className="text-sm text-slate-400">{m}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Target zones */}
              {workout.target_zones && (
                <div className="flex gap-3">
                  {workout.target_zones.zone2_min > 0 && <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: "rgba(59,130,246,.1)", color: "#60A5FA" }}>Z2: {workout.target_zones.zone2_min} min</span>}
                  {workout.target_zones.zone3_min > 0 && <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: "rgba(245,158,11,.1)", color: "#FBBF24" }}>Z3: {workout.target_zones.zone3_min} min</span>}
                  {workout.target_zones.zone4_min > 0 && <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: "rgba(239,68,68,.1)", color: "#F87171" }}>Z4: {workout.target_zones.zone4_min} min</span>}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => setWorkout(null)} className="text-xs text-slate-600 underline cursor-pointer border-0 bg-transparent">Change session type</button>
                  <button
                    onClick={async () => {
                      if (!workout?.log_id || workoutLoading) return;
                      setWorkoutLoading(true);
                      try {
                        const res = await api.post("/api/oura/workout/regenerate", {
                          log_id: workout.log_id,
                          session_type: workout.session_type || "crossfit",
                          reason: "user_requested_alternative",
                        });
                        if (res && !res.error) setWorkout(res);
                        else setWorkout({ error: res?.error || "Failed to regenerate" });
                      } catch {
                        setWorkout({ error: "Failed to regenerate" });
                      } finally {
                        setWorkoutLoading(false);
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer border-0"
                    style={{ background: "rgba(99,102,241,.15)", color: "#A5B4FC" }}
                    disabled={workoutLoading || !workout?.log_id}
                  >
                    {workoutLoading ? "Reprogramming..." : "Try another combo"}
                  </button>
                </div>
                <p className="text-[9px] text-slate-600">
                  Generated by Gemini 2.5 Pro at {workout.generated_at ? new Date(workout.generated_at).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }) + " ET" : ""}
                </p>
              </div>
            </div>
          )}
        </Glass>

        {/* Drift link removed — overtraining guardian handles this in the workout pipeline */}
        </div>
        )}

      </div>
    </div>
  );
};

export default OuraProfile;
