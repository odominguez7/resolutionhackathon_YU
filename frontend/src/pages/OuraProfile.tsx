import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, ScatterChart, Scatter,
} from "recharts";
import {
  Activity, Heart, Moon, Brain, Flame, Dumbbell, Clock, TrendingUp,
  ArrowLeft, Zap, Wind, Droplets, Footprints, Gauge,
} from "lucide-react";

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

function tickInterval(len: number): number {
  if (len <= 10) return 0;
  if (len <= 20) return 1;
  if (len <= 40) return 3;
  if (len <= 80) return 5;
  return Math.floor(len / 14);
}

function sparkPoints(data: any[], key: string, max = 14): number[] {
  const slice = data.slice(-max);
  return slice.map((d: any) => d[key] ?? 0);
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

/* ── Section Title ── */
const Title = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[.22em] mb-5 flex items-center gap-2">
    <Icon className="w-4 h-4 text-slate-500" /> {title}
  </h3>
);

/* ── Tooltip ── */
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0e27]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
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
const StatCard = ({ icon: Icon, label, value, unit, spark, change, color, delay = 0 }: {
  icon: any; label: string; value: string | number; unit: string; spark: number[]; change: number; color: string; delay?: number;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Interval>("ALL");

  useEffect(() => {
    Promise.all([
      api.get("/api/oura/sleep-history"),
      api.get("/api/oura/stats"),
      api.get("/api/oura/workouts"),
      api.get("/api/oura/stress-detail"),
      api.get("/api/oura/cardiovascular-age"),
    ])
      .then(([sh, st, wo, sd, ca]) => {
        setSleepHistory(sh.data ?? []);
        setStats(st);
        setWorkouts(wo.data ?? []);
        setStressData(sd.data ?? []);
        setCardioAge(ca.data ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  /* ── derived data ── */
  const allChart = useMemo(() => sleepHistory.map((d: any) => ({
    ...d,
    label: fmtDate(d.day),
    deepPct: Math.round((d.deepSleepPct ?? 0) * 100),
    remPct: Math.round((d.remSleepPct ?? 0) * 100),
    lightPct: Math.round((d.lightSleepPct ?? 0) * 100),
    awakePct: Math.round((d.awakePct ?? 0) * 100),
    sleepHrs: d.totalSleepSeconds ? +(d.totalSleepSeconds / 3600).toFixed(1) : 0,
  })), [sleepHistory]);

  const chart = useMemo(() => sliceDays(allChart, range), [allChart, range]);
  const stressChart = useMemo(() => sliceDays(stressData, range).map((d: any) => ({ ...d, label: fmtDate(d.day) })), [stressData, range]);
  const cardioChart = useMemo(() => sliceDays(cardioAge, range).map((d: any) => ({ ...d, label: fmtDate(d.day) })), [cardioAge, range]);

  const latest = allChart.length ? allChart[allChart.length - 1] : null;
  const ti = tickInterval(chart.length);

  /* ── bedtime data ── */
  const bedtimeData = useMemo(() => {
    return sliceDays(sleepHistory, range)
      .filter((d: any) => d.bedtimeStart)
      .map((d: any) => {
        const dt = new Date(d.bedtimeStart);
        let mins = dt.getHours() * 60 + dt.getMinutes();
        if (mins > 720) mins -= 1440;
        return { label: fmtDate(d.day), mins, time: fmtTime(d.bedtimeStart) };
      });
  }, [sleepHistory, range]);

  /* ── loading / error ── */
  if (loading) return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a0e27,#111638)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 space-y-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "rgba(30,41,59,.4)" }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e27" }}>
      <div className="text-center space-y-4">
        <p className="text-xl font-bold text-red-400">Failed to load Oura data</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <Link to="/dashboard"><Button variant="ghost">Back</Button></Link>
      </div>
    </div>
  );

  const dateRange = allChart.length > 1 ? `${fmtDate(allChart[0].day)} — ${fmtDate(allChart[allChart.length - 1].day)}` : "";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a0e27 0%,#111638 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-7">

        {/* ═══════ 1. HEADER ═══════ */}
        <Glass delay={0} className="text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 50% 20%, rgba(74,222,128,.06) 0%, transparent 70%)",
          }} />
          <div className="relative z-10 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full p-4" style={{ background: "rgba(74,222,128,.1)" }}>
                <Activity className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              OMAR'S OURA RING
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest"
                style={{ background: "rgba(74,222,128,.12)", color: "#4ADE80" }}>
                <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "oura-pulse-dot 1.5s ease-in-out infinite" }} />
                Live Data
              </span>
              <span className="text-slate-500 text-xs">{stats?.totalDays ?? allChart.length} days total &middot; {dateRange} &middot; Showing {chart.length} days</span>
            </div>

            {/* interval toggle */}
            <div className="flex items-center justify-center gap-1 pt-2">
              {(["7D", "14D", "30D", "ALL"] as Interval[]).map((iv) => (
                <button key={iv}
                  onClick={() => setRange(iv)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border-0
                    ${range === iv ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.15)]" : "text-slate-500 hover:text-slate-300 bg-transparent"}`}>
                  {iv}
                </button>
              ))}
            </div>
          </div>
        </Glass>

        {/* ═══════ 2. HERO RING GAUGES ═══════ */}
        {latest && (
          <div className="grid grid-cols-3 gap-4 md:gap-8 justify-items-center py-2"
            style={{ animation: "oura-fade-up .7s ease-out 100ms both" }}>
            <RingGauge value={latest.sleepScore ?? 0} max={100} label="Sleep" color={scoreClr(latest.sleepScore ?? 0)}
              avg={stats?.avgSleepScore} delay={100} />
            <RingGauge value={latest.readinessScore ?? 0} max={100} label="Readiness" color={scoreClr(latest.readinessScore ?? 0)}
              avg={stats?.avgReadiness} delay={200} />
            <RingGauge value={latest.hrv ?? 0} max={120} label="HRV" unit="ms" color="#8B5CF6"
              avg={stats?.avgHRV} delay={300} />
          </div>
        )}

        {/* ═══════ 3. VITAL GRID ═══════ */}
        {latest && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Heart} label="Heart Rate" value={latest.avgHeartRate ?? "--"} unit="bpm"
              spark={sparkPoints(chart, "avgHeartRate")} change={pctChange(latest.avgHeartRate ?? 0, stats.avgHeartRate ?? 0)}
              color="#F87171" delay={200} />
            <StatCard icon={Wind} label="Resp Rate" value={latest.avgRespRate != null ? (+latest.avgRespRate).toFixed(1) : "--"} unit="br/m"
              spark={sparkPoints(chart, "avgRespRate")} change={0} color="#38BDF8" delay={250} />
            <StatCard icon={Droplets} label="SpO2" value={latest.spo2Avg ?? "--"} unit="%"
              spark={sparkPoints(chart, "spo2Avg")} change={0} color="#A78BFA" delay={300} />
            <StatCard icon={Moon} label="Deep Sleep" value={latest.deepSleepMin ?? "--"} unit="min"
              spark={sparkPoints(chart, "deepSleepMin")} change={pctChange(latest.deepSleepPct ?? 0, stats.avgDeepPct ?? 0)}
              color="#3B82F6" delay={350} />
            <StatCard icon={Footprints} label="Steps" value={latest.steps != null ? latest.steps.toLocaleString() : "--"} unit=""
              spark={sparkPoints(chart, "steps")} change={0} color="#4ADE80" delay={400} />
            <StatCard icon={Flame} label="Active Cal" value={latest.activeCalories ?? "--"} unit="kcal"
              spark={sparkPoints(chart, "activeCalories")} change={0} color="#FB923C" delay={450} />
            <StatCard icon={Heart} label="Vascular Age"
              value={stats.latestVascularAge ?? "--"} unit="yrs"
              spark={sparkPoints(cardioAge.map((d: any) => ({ v: d.vascularAge })), "v")}
              change={stats.latestVascularAge ? -Math.round(36 - (stats.latestVascularAge ?? 36)) : 0}
              color="#F472B6" delay={500} />
            <StatCard icon={Gauge} label="Efficiency" value={latest.efficiency ?? "--"} unit="%"
              spark={sparkPoints(chart, "efficiency")} change={0} color="#2DD4BF" delay={550} />
          </div>
        )}

        {/* ═══════ 4. SLEEP SCORE TREND ═══════ */}
        <Glass delay={350}>
          <Title icon={Moon} title="Sleep Score Trend" />
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
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} domain={[40, 100]} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={65} stroke="#F87171" strokeDasharray="4 4" strokeOpacity={0.3} />
              {stats?.avgSleepScore && (
                <ReferenceLine y={stats.avgSleepScore} stroke="#3B82F6" strokeDasharray="6 4" strokeOpacity={0.3}
                  label={{ value: `Avg ${Math.round(stats.avgSleepScore)}`, fill: "#3B82F666", fontSize: 10, position: "insideTopRight" }} />
              )}
              <Area type="monotone" dataKey="sleepScore" stroke="#3B82F6" strokeWidth={2} fill="url(#sleepGrad)"
                dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "#0a0e27", strokeWidth: 2 }} name="Sleep Score" />
              <Area type="monotone" dataKey="hrv" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 3"
                fill="none" dot={false} activeDot={{ r: 3, fill: "#8B5CF6" }} name="HRV" />
            </AreaChart>
          </ResponsiveContainer>
        </Glass>

        {/* ═══════ 5. SLEEP STAGES ═══════ */}
        <Glass delay={420}>
          <Title icon={Moon} title="Sleep Stages" />
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

        {/* ═══════ 6. STRESS & RECOVERY ═══════ */}
        {stressChart.length > 0 && (
          <Glass delay={490}>
            <Title icon={Zap} title="Stress & Recovery" />
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
          <Title icon={TrendingUp} title="Readiness + Activity" />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
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
                dot={false} activeDot={{ r: 4, fill: "#4ADE80", stroke: "#0a0e27", strokeWidth: 2 }} name="Readiness" />
              <Area type="monotone" dataKey="activityScore" stroke="#3B82F6" strokeWidth={2} fill="url(#actG)"
                dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "#0a0e27", strokeWidth: 2 }} name="Activity" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-2 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Readiness</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Activity</span>
          </div>
        </Glass>

        {/* ═══════ 8. HEART RATE & HRV DETAIL ═══════ */}
        <Glass delay={630}>
          <Title icon={Heart} title="Heart Rate & HRV" />
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
            <Title icon={Heart} title="Cardiovascular Age" />
            <div className="flex items-center gap-5 mb-5">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Actual</p>
                <p className="text-3xl font-black text-slate-300">36</p>
              </div>
              <span className="text-slate-600 text-lg">&rarr;</span>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Vascular</p>
                <p className="text-3xl font-black text-emerald-400">{cardioChart[cardioChart.length - 1]?.vascularAge ?? "--"}</p>
              </div>
              {cardioChart[cardioChart.length - 1]?.vascularAge && (
                <span className="ml-2 px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide"
                  style={{ background: "rgba(74,222,128,.12)", color: "#4ADE80" }}>
                  {36 - cardioChart[cardioChart.length - 1].vascularAge} yrs younger
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
                <ReferenceLine y={36} stroke="#64748b" strokeDasharray="6 4" strokeOpacity={0.4}
                  label={{ value: "Actual Age: 36", fill: "#64748b88", fontSize: 10, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="vascularAge" stroke="#F472B6" strokeWidth={2} fill="url(#caG)"
                  dot={false} activeDot={{ r: 4, fill: "#F472B6", stroke: "#0a0e27", strokeWidth: 2 }} name="Vascular Age" />
              </AreaChart>
            </ResponsiveContainer>
          </Glass>
        )}

        {/* ═══════ 10. BEDTIME PATTERNS ═══════ */}
        {bedtimeData.length > 0 && (
          <Glass delay={770}>
            <Title icon={Clock} title="Bedtime Patterns" />
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
                    <div className="rounded-xl border border-white/10 bg-[#0a0e27]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">{label}</p>
                      <p className="text-sm font-bold text-indigo-400">{payload[0]?.payload?.time}</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="mins" stroke="#818CF8" strokeWidth={2} fill="url(#btG)"
                  dot={false} activeDot={{ r: 4, fill: "#818CF8", stroke: "#0a0e27", strokeWidth: 2 }} name="Bedtime" />
              </AreaChart>
            </ResponsiveContainer>
          </Glass>
        )}

        {/* ═══════ 11. RECENT WORKOUTS ═══════ */}
        {workouts.length > 0 && (
          <Glass delay={840}>
            <Title icon={Dumbbell} title="Recent Workouts" />
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/[0.05]">
                    <th className="text-left py-2.5 px-3 font-semibold">Date</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Activity</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Dur</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Cal</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Avg HR</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {workouts.slice(-10).reverse().map((w: any, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-slate-400 text-xs">{fmtDate(w.day)}</td>
                      <td className="py-2 px-3 text-white font-semibold text-xs">
                        {(w.activity || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300 text-xs">{w.duration ? `${Math.round(w.duration / 60)}m` : "--"}</td>
                      <td className="py-2 px-3 text-right text-amber-400 font-semibold text-xs">{w.calories ? Math.round(w.calories) : "--"}</td>
                      <td className="py-2 px-3 text-right text-red-400 text-xs">{w.avgHeartRate ?? "--"}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            background: w.intensity === "high" ? "rgba(248,113,113,.15)" : w.intensity === "medium" ? "rgba(245,158,11,.15)" : "rgba(74,222,128,.12)",
                            color: w.intensity === "high" ? "#F87171" : w.intensity === "medium" ? "#F59E0B" : "#4ADE80",
                          }}>
                          {w.intensity || "low"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Glass>
        )}

        {/* ═══════ 12. SLEEP CONTRIBUTORS ═══════ */}
        {latest && (
          <Glass delay={910}>
            <Title icon={Moon} title="Sleep Contributors (Latest)" />
            <div className="space-y-3">
              {[
                { label: "Deep Sleep", key: "deepSleepPct", max: 25, color: "#3B82F6" },
                { label: "REM Sleep", key: "remSleepPct", max: 30, color: "#8B5CF6" },
                { label: "Efficiency", key: "efficiency", max: 100, color: "#2DD4BF" },
                { label: "Latency", key: "latency", max: 30, color: "#F59E0B", invert: true },
                { label: "Total Sleep", key: "sleepHrs", max: 9, color: "#4ADE80", suffix: "hrs" },
                { label: "Restfulness", key: "tnt", max: 60, color: "#818CF8", invert: true },
              ].map((c) => {
                const raw = latest[c.key] ?? 0;
                const pct = (c as any).invert ? Math.max(0, 100 - (raw / c.max * 100)) : Math.min(100, (raw / c.max * 100));
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 font-semibold">{c.label}</span>
                      <span className="text-xs font-bold text-white">{typeof raw === "number" ? (Number.isInteger(raw) ? raw : raw.toFixed(1)) : raw}{(c as any).suffix ? ` ${(c as any).suffix}` : ""}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Glass>
        )}

        {/* ═══════ NAVIGATION ═══════ */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-10"
          style={{ animation: "oura-fade-up .7s ease-out 1000ms both" }}>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="border-slate-700 text-slate-300 hover:border-slate-500 gap-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Button>
          </Link>
          <Link to="/drift">
            <button className="px-8 py-3 rounded-2xl text-sm font-extrabold text-white cursor-pointer border-0"
              style={{ background: "linear-gradient(135deg,#4ADE80,#22C55E)", boxShadow: "0 4px 24px rgba(74,222,128,.25)", transition: "transform .2s,box-shadow .2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(74,222,128,.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(74,222,128,.25)"; }}>
              View Drift Analysis &rarr;
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default OuraProfile;
