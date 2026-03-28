import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import EnergyCurve from "@/components/optimize/EnergyCurve";
import {
  Sun, Coffee, Dumbbell, Moon, Wind, Bed, Thermometer, Shield,
  TrendingUp, TrendingDown, Minus, Zap, Target, Activity, Heart,
  Brain, Flame, Clock, CheckCircle, Loader2, Play, AlertTriangle,
  Info, Droplet, UtensilsCrossed, Monitor, Users, Footprints,
  CalendarDays,
} from "lucide-react";

/* ─── Constants ─── */
const C = {
  blue: "#3b82f6", purple: "#8b5cf6", green: "#10b981",
  amber: "#f59e0b", red: "#ef4444", cyan: "#06b6d4", pink: "#ec4899",
};

const statusColors: Record<string, string> = { green: C.green, amber: C.amber, red: C.red };

const iconMap: Record<string, any> = {
  sunrise: Sun, coffee: Coffee, dumbbell: Dumbbell, moon: Moon,
  wind: Wind, bed: Bed, thermometer: Thermometer, shield: Shield,
  clock: Clock, droplet: Droplet, utensils: UtensilsCrossed,
  "monitor-off": Monitor, target: Target, brain: Brain, heart: Heart,
  footprints: Footprints, users: Users, circle: Zap,
  calendar: CalendarDays, "alert-triangle": AlertTriangle,
};

const kpiIconMap: Record<string, any> = {
  moon: Moon, activity: Activity, brain: Brain, zap: Zap,
  flame: Flame, target: Target, heart: Heart, clock: Clock,
};

const sourceColors: Record<string, string> = {
  schedule: C.amber, nutrition: C.cyan, recovery: C.purple,
  focus: C.blue, calendar: "#64748b",
};

const colorMap: Record<string, string> = {
  amber: C.amber, blue: C.blue, purple: C.purple, green: C.green,
  cyan: C.cyan, red: C.red, gray: "#64748b", pink: C.pink,
};

const trendIcon = (t: string) => {
  if (t === "improving") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (t === "declining") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
};

function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
    const t = setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

/* ─── Tabs ─── */
const TABS = ["My Day", "Energy", "Workout", "Goals"] as const;
type Tab = typeof TABS[number];

/* ─── Main ─── */
const Optimize = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("My Day");
  const [mood, setMood] = useState<string>("balanced");
  const [executing, setExecuting] = useState<Record<number, "loading" | "done">>({});

  const fetchData = (m: string) => {
    setLoading(true);
    api.get(`/api/optimize/full-day?mood=${m}`).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(mood); }, []);

  const handleMoodChange = (m: string) => {
    setMood(m);
    fetchData(m);
  };

  const handleExecute = async (idx: number) => {
    setExecuting((p) => ({ ...p, [idx]: "loading" }));
    try {
      await api.post(`/api/optimize/execute/${idx}`);
      setExecuting((p) => ({ ...p, [idx]: "done" }));
    } catch {
      setExecuting((p) => ({ ...p, [idx]: "done" }));
    }
  };

  const glass = "rounded-2xl border border-white/[0.08]";
  const glassBg = { background: "rgba(15, 22, 49, 0.6)", backdropFilter: "blur(24px)" };

  const ref0 = useFadeIn(0);
  const ref1 = useFadeIn(100);
  const ref2 = useFadeIn(200);

  if (loading || !data) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />)}
        </div>
      </div>
    );
  }

  const { hero, timeline, energy_curve, calendar, workout, kpis, interactive } = data;

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 50%, #0d1229 100%)" }}>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ═══════ HERO ═══════ */}
        <div ref={ref0}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Performance Engine</span>
            </div>
            {!calendar?.connected && (
              <button
                onClick={() => api.get("/api/optimize/google/auth-url").then((d: any) => d.url && window.open(d.url, "_blank"))}
                className="text-[10px] text-blue-400 border border-blue-400/20 px-3 py-1 rounded-full hover:bg-blue-400/10 transition"
              >
                Connect Google Calendar
              </button>
            )}
          </div>

          {/* Greeting */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            {interactive?.greeting || "Your Next 24 Hours"}
          </h1>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: "Sleep", value: hero?.sleep_score, color: (hero?.sleep_score || 0) >= 80 ? C.green : C.amber },
              { label: "Readiness", value: hero?.readiness, color: (hero?.readiness || 0) >= 75 ? C.green : C.amber },
              { label: "HRV", value: `${hero?.hrv}ms`, color: (hero?.hrv || 0) >= 35 ? C.green : C.red },
              { label: "Hours", value: `${hero?.sleep_hours}h`, color: (hero?.sleep_hours || 0) >= 7 ? C.green : C.amber },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06]" style={{ background: "rgba(15,22,49,0.4)" }}>
                <span className="text-[10px] text-slate-500 uppercase font-medium">{s.label}</span>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Mood Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Mode:</span>
            {[
              { id: "recovery", label: "🌙 Coast", desc: "Recovery focus" },
              { id: "balanced", label: "⚡ Balanced", desc: "Sustainable grind" },
              { id: "push", label: "🔥 Push", desc: "Max output" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => handleMoodChange(m.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mood === m.id
                    ? "text-white border-amber-500/30 bg-amber-500/15"
                    : "text-slate-500 border-white/[0.06] hover:text-white hover:bg-white/5"
                } border`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ TABS ═══════ */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                tab === t
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ═══════ TAB: MY DAY ═══════ */}
        {tab === "My Day" && (
          <div ref={ref1} className="space-y-8">
            {/* Mini energy curve */}
            <EnergyCurve
              curve={energy_curve || []}
              events={calendar?.events || []}
              peakWindows={calendar?.peak_windows || []}
              dipWindows={calendar?.dip_windows || []}
            />

            {/* Unified Timeline */}
            <div>
              <h2 className="text-lg font-bold text-white mb-5">Your Day</h2>
              <div className="relative">
                <div className="absolute left-[19px] top-4 bottom-4 w-[2px]"
                     style={{ background: "linear-gradient(to bottom, #f59e0b, #06b6d4, #8b5cf6, #3b82f6)" }} />
                <div className="space-y-3">
                  {(timeline || []).map((item: any, i: number) => {
                    const Icon = iconMap[item.icon] || Zap;
                    const color = item.source === "calendar" ? (colorMap[item.color] || "#64748b") : (sourceColors[item.source] || colorMap[item.color] || C.amber);
                    const hasAction = !!item.action;
                    const execState = executing[i];

                    return (
                      <div key={i} className="relative flex gap-4">
                        <div className="relative z-10 flex-shrink-0 w-10 flex justify-center pt-4">
                          <div className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: color, background: `${color}20` }}>
                            <div className="w-1 h-1 rounded-full mx-auto mt-[3px]" style={{ background: color }} />
                          </div>
                        </div>
                        <div className={`flex-1 ${glass} p-4 transition-all hover:border-white/[0.12]`} style={glassBg}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                   style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                                <Icon className="w-4 h-4" style={{ color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-mono text-slate-500">{item.time}{item.end_time ? ` - ${item.end_time}` : ""}</span>
                                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                                        style={{ color: `${color}90`, background: `${color}10` }}>
                                    {item.source}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-white">{item.title}</h3>
                                {item.description && <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{item.description}</p>}
                              </div>
                            </div>
                            {hasAction && (
                              <div className="flex-shrink-0">
                                {execState === "done" ? (
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  </div>
                                ) : execState === "loading" ? (
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                  </div>
                                ) : (
                                  <button onClick={() => handleExecute(i)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                                    style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                                    <Play className="w-3 h-3" style={{ color }} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB: ENERGY ═══════ */}
        {tab === "Energy" && (
          <div ref={ref1} className="space-y-6">
            <EnergyCurve
              curve={energy_curve || []}
              events={calendar?.events || []}
              peakWindows={calendar?.peak_windows || []}
              dipWindows={calendar?.dip_windows || []}
            />

            {/* Focus Blocks */}
            {(calendar?.focus_blocks || []).length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Deep Work Windows</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {calendar.focus_blocks.map((b: any, i: number) => (
                    <div key={i} className={`${glass} p-4 flex items-center justify-between`} style={glassBg}>
                      <div>
                        <p className="text-xs font-bold text-blue-400">{b.label}</p>
                        <p className="text-xs text-slate-400">{b.start} - {b.end} ({b.duration_min}min) | Energy {b.energy_avg}%</p>
                      </div>
                      <button className="text-[10px] font-bold text-blue-400 border border-blue-400/20 px-3 py-1.5 rounded-lg hover:bg-blue-400/10 transition">
                        Block It
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar Audit */}
            {(calendar?.events || []).some((e: any) => e.flag) && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Calendar Audit</h3>
                <div className="space-y-2">
                  {calendar.events.filter((e: any) => e.flag).map((e: any, i: number) => (
                    <div key={i} className={`${glass} p-4 flex items-start gap-3`}
                         style={{ ...glassBg, borderColor: e.flag === "reschedule" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)" }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5"
                                     style={{ color: e.flag === "reschedule" ? C.red : C.amber }} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{e.summary} ({e.start}-{e.end})</p>
                        <p className="text-xs text-slate-400 mt-0.5">{e.suggestion}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md"
                            style={{
                              color: e.flag === "reschedule" ? C.red : C.amber,
                              background: e.flag === "reschedule" ? `${C.red}10` : `${C.amber}10`,
                            }}>
                        {e.flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TAB: WORKOUT ═══════ */}
        {tab === "Workout" && workout && (
          <div ref={ref1} className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">Today's Workout</h2>
              <span className="text-xs px-2.5 py-1 rounded-lg font-bold uppercase"
                    style={{ color: C.amber, background: `${C.amber}15`, border: `1px solid ${C.amber}25` }}>
                {workout.format}
              </span>
              <span className="text-xs text-slate-500">{workout.duration_min}min | RPE {workout.target_rpe} | {workout.db_weight_lbs}lb</span>
            </div>

            {workout.adjustments?.length > 0 && (
              <div className="space-y-2">
                {workout.adjustments.map((adj: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-amber-500/10"
                       style={{ background: "rgba(245,158,11,0.05)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-300/80">{adj}</p>
                  </div>
                ))}
              </div>
            )}

            {workout.biometric_flags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {workout.biometric_flags.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
                       style={{
                         color: f.type === "good" ? C.green : f.type === "caution" ? C.amber : C.red,
                         background: `${f.type === "good" ? C.green : f.type === "caution" ? C.amber : C.red}10`,
                         borderColor: `${f.type === "good" ? C.green : f.type === "caution" ? C.amber : C.red}25`,
                       }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: f.type === "good" ? C.green : f.type === "caution" ? C.amber : C.red }} />
                    <span className="text-[10px] font-medium">{f.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              <div className={`${glass} p-5`} style={glassBg}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Warm-Up</h3>
                <div className="space-y-2">
                  {(workout.warmup || []).map((line: string, i: number) => (
                    <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-600 font-mono text-[10px] mt-0.5">{i + 1}</span>{line}
                    </p>
                  ))}
                </div>
              </div>
              <div className={`${glass} p-5`} style={{ ...glassBg, border: "1px solid rgba(245,158,11,0.15)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">{workout.format} — {workout.duration_min}min</h3>
                <pre className="text-sm text-white leading-relaxed whitespace-pre-wrap font-mono">{workout.workout_text}</pre>
                {workout.pacing_note && (
                  <div className="flex items-start gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                    <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-blue-300/70">{workout.pacing_note}</p>
                  </div>
                )}
              </div>
              <div className={`${glass} p-5`} style={glassBg}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Cooldown</h3>
                <div className="space-y-2">
                  {(workout.cooldown || []).map((line: string, i: number) => (
                    <p key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-600 font-mono text-[10px] mt-0.5">{i + 1}</span>{line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-6">
              <span className="text-xs text-slate-600">Est. Calories: <b className="text-slate-400">{workout.estimated_calories} kcal</b></span>
              <span className="text-xs text-slate-600">Movements: <b className="text-slate-400">{workout.movements?.length}</b></span>
            </div>
          </div>
        )}

        {/* ═══════ TAB: GOALS ═══════ */}
        {tab === "Goals" && (
          <div ref={ref2}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Optimization Goals</h2>
              <span className="text-xs text-slate-500">All measured by Oura Ring</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(kpis || []).map((kpi: any, i: number) => {
                const Icon = kpiIconMap[kpi.icon] || Target;
                const color = statusColors[kpi.status] || C.amber;
                const sparkData = (kpi.sparkline || []).map((v: number, idx: number) => ({ v, i: idx }));
                return (
                  <div key={kpi.id} className={`${glass} p-4 transition-all hover:border-white/[0.15]`} style={glassBg}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-400">{kpi.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {trendIcon(kpi.trend)}
                        <span className="text-[10px] text-slate-500">{kpi.trend_pct > 0 ? "+" : ""}{kpi.trend_pct}%</span>
                      </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-2xl font-black tabular-nums" style={{ color }}>{kpi.current}</span>
                      <span className="text-xs text-slate-500 mb-1">{kpi.unit}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] text-slate-600">baseline: {kpi.baseline}</span>
                      <span className="text-[10px] text-slate-600">target: {kpi.inverted ? "≤" : "≥"}{kpi.target}</span>
                    </div>
                    {sparkData.length > 0 && (
                      <div className="h-10 mb-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkData}>
                            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 leading-relaxed">{kpi.action}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ NAV FOOTER ═══════ */}
        <div className="flex flex-wrap gap-3 justify-center pt-4">
          {[
            { to: "/dashboard", label: "Dashboard" },
            { to: "/checkin", label: "Check-In" },
            { to: "/drift", label: "Drift Analysis" },
            { to: "/oura", label: "Oura Profile" },
          ].map((l) => (
            <Link key={l.to} to={l.to}>
              <Button variant="outline" className="text-xs text-slate-400 border-white/10 rounded-xl px-5 py-4">{l.label}</Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Optimize;
