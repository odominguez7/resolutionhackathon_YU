import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  Brain, Radio, Eye, Crosshair, Zap, BarChart3,
  Play, CheckCircle2, AlertTriangle, TrendingUp,
  TrendingDown, ArrowRight, Bot, Sparkles, Clock,
  Activity, Heart, Moon, ShieldCheck, ChevronRight,
  History, RefreshCw, Globe,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

/* ── Keyframes ─────────────────────────────────────────── */
const keyframes = `
@keyframes agent-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.5)} 50%{box-shadow:0 0 0 14px rgba(59,130,246,0)} }
@keyframes agent-orbit { 0%{transform:rotate(0deg) translateX(28px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(28px) rotate(-360deg)} }
@keyframes agent-scan { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes phase-glow { 0%,100%{opacity:0.4} 50%{opacity:1} }
@keyframes ripple { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(2.5);opacity:0} }
@keyframes loop-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
`;

/* ── Types ─────────────────────────────────────────────── */
interface TickResult {
  phase: string;
  tick_number: number;
  duration_ms: number;
  timestamp: string;
  phases: {
    sense: { biometrics_available: number; date_range: string; latest_date: string; averages: Record<string, number> };
    think: { drift_detected: boolean; severity: string; consecutive_days: number; drivers: { metric: string; z_score: number }[]; baseline: Record<string, number> };
    decide: { reasoning: string; source: string; actions_planned: number; actions: { tool: string; params: Record<string, any>; why: string }[] };
    act: { actions_executed: number; details: { tool: string; why: string; result: Record<string, any> }[] };
    measure: { evaluations_completed: number; pending_evaluations: number; effectiveness_summary: Record<string, any>; evaluations: any[] };
  };
}

interface AgentStatus {
  agent: string; version: string; status: string;
  tick_count: number; last_tick: string | null;
  baseline: Record<string, number>;
  total_drifts_detected: number; total_interventions: number;
  pending_evaluations: number; effectiveness_summary: Record<string, any>;
  last_drift: any;
}

/* ── Config ────────────────────────────────────────────── */
const PHASES = [
  { key: "sense", label: "Sense", icon: Eye, color: "#3b82f6", desc: "Oura biometrics" },
  { key: "think", label: "Think", icon: Brain, color: "#8b5cf6", desc: "Drift detection + RAG" },
  { key: "decide", label: "Decide", icon: Crosshair, color: "#f59e0b", desc: "LLM + clinical research" },
  { key: "act", label: "Intervene", icon: Zap, color: "#22c55e", desc: "Micro-interventions" },
  { key: "collaborate", label: "Network", icon: Globe, color: "#06b6d4", desc: "Expert agents" },
  { key: "measure", label: "Measure", icon: BarChart3, color: "#ec4899", desc: "Closed loop" },
];
const SEVERITY_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e", none: "#6b7280" };
const METRIC_ICONS: Record<string, any> = { hrv: Activity, sleep_score: Moon, readiness: ShieldCheck, rhr: Heart, deep_sleep: Moon, stress: AlertTriangle };
const TOOL_LABELS: Record<string, string> = {
  send_coaching: "CBT Coaching", sleep_protocol: "Sleep Protocol",
  block_calendar: "Calendar Block", recommend_workout: "Workout Adjustment", no_action: "No Action Needed",
};
const METRIC_LABELS: Record<string, string> = {
  sleep_score: "Sleep Score", hrv: "HRV", readiness: "Readiness",
  rhr: "Resting HR", deep_sleep: "Deep Sleep", stress: "Stress",
};

/* ── Component ─────────────────────────────────────────── */
export default function Agent() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [tickResult, setTickResult] = useState<TickResult | null>(null);
  const [tickHistory, setTickHistory] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [activePhase, setActivePhase] = useState(-1);
  const [showResult, setShowResult] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const [dataStatus, setDataStatus] = useState<any>(null);
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    api.get("/api/agent/status").then(setStatus).catch(() => {});
    api.get("/api/agent/log").then(setTickHistory).catch(() => {});
    api.get("/api/oura/data-status").then(setDataStatus).catch(() => {});
  }, []);

  const triggerLoop = async () => {
    setRunning(true);
    setError("");
    setTickResult(null);
    setShowResult(false);
    setActivePhase(0);
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
    try {
      const phaseDelay = 600;
      PHASES.forEach((_, i) => {
        phaseTimers.current.push(setTimeout(() => setActivePhase(i), i * phaseDelay));
      });
      const result = await api.post("/api/agent/trigger");
      setTickResult(result);
      const remaining = Math.max(0, PHASES.length * phaseDelay - 800);
      setTimeout(() => { setActivePhase(5); setShowResult(true); }, remaining);
      const [s, h] = await Promise.all([api.get("/api/agent/status"), api.get("/api/agent/log")]);
      setStatus(s);
      setTickHistory(h);
    } catch (e: any) {
      setError(e.message || "Agent loop failed");
      setActivePhase(-1);
    } finally {
      setRunning(false);
    }
  };

  const severityColor = tickResult?.phases?.think?.severity
    ? SEVERITY_COLORS[tickResult.phases.think.severity] || "#6b7280" : "#6b7280";

  // Effectiveness chart data
  const effData = Object.entries(status?.effectiveness_summary || {}).map(([type, data]: [string, any]) => ({
    name: (TOOL_LABELS[type] || type).replace(" ", "\n"), rate: data.rate, total: data.total, positive: data.positive,
  }));

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(180deg,#060918 0%,#0b1120 40%,#0a0f1f 100%)" }}>
      <style>{keyframes}</style>

      {/* ── Hero ──────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ paddingTop: 50, paddingBottom: 32 }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }} />
        <div className="max-w-2xl mx-auto px-5 text-center relative z-10">
          {/* Agent avatar */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(59,130,246,0.2)", animation: "agent-pulse 3s ease-in-out infinite" }}>
                <Bot className="w-8 h-8" style={{ color: "#818cf8" }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center" style={{ animation: "agent-orbit 4s linear infinite" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#0f172a", border: "2px solid #22c55e" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5" style={{ color: "#f1f5f9" }}>
            YU Cortex
          </h1>
          <p className="text-xs md:text-sm mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Autonomous behavioral intelligence. Sense. Think. Decide. Act. Measure.
          </p>

          {/* Architecture badges */}
          <div className="flex items-center justify-center gap-1.5 mb-5 flex-wrap">
            {dataStatus && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.12)" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                Oura {dataStatus.total_days}d
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.12)" }}>
              RAG
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.12)" }}>
              LangGraph
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(236,72,153,0.08)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.12)" }}>
              Firestore
            </div>
            <a href="https://join39.org/chat/yu7" target="_blank" rel="noopener"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider no-underline"
              style={{ background: "rgba(6,182,212,0.08)", color: "rgba(6,182,212,0.6)", border: "1px solid rgba(6,182,212,0.1)" }}>
              <Globe className="w-3 h-3" /> NANDA
            </a>
          </div>

          {/* Stats */}
          {status && (
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Ticks", value: status.tick_count },
                { label: "Drifts", value: status.total_drifts_detected },
                { label: "Actions", value: status.total_interventions },
                { label: "Evals", value: status.pending_evaluations },
              ].map((s, i) => (
                <motion.div key={s.label} className="text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}>
                  <p className="text-lg md:text-xl font-extrabold tabular-nums"
                    style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {s.value}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>{s.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center justify-center gap-3">
            <motion.button onClick={triggerLoop} disabled={running}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="relative px-6 py-3 rounded-xl font-bold text-sm tracking-wide border-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: running ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))" : "linear-gradient(135deg, #3b82f6, #7c3aed)",
                color: "#fff", boxShadow: running ? "none" : "0 0 30px rgba(59,130,246,0.3)",
              }}>
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Running...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Run Agent Loop</span>
              )}
              {running && <span className="absolute inset-0 rounded-xl" style={{ border: "2px solid rgba(59,130,246,0.4)", animation: "ripple 1.5s ease-out infinite" }} />}
            </motion.button>

          </div>
          {false && (
            <p className="hidden">{/* removed */}</p>
          )}
        </div>
      </div>

      {/* ── Phase Pipeline ────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 mb-8">
        <div className="grid grid-cols-5 gap-1">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const isActive = activePhase === i;
            const isDone = activePhase > i;
            const isWaiting = activePhase < i;
            return (
              <motion.div key={phase.key} className="flex flex-col items-center"
                animate={{ scale: isActive ? 1.08 : 1, opacity: isWaiting && running ? 0.3 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-1 transition-all duration-500"
                  style={{
                    background: isDone ? `${phase.color}22` : isActive ? `${phase.color}30` : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${isDone || isActive ? phase.color + "60" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: isActive ? `0 0 20px ${phase.color}30` : "none",
                  }}>
                  {isDone ? <CheckCircle2 className="w-5 h-5" style={{ color: phase.color }} /> :
                    <Icon className="w-5 h-5" style={{ color: isActive ? phase.color : "rgba(255,255,255,0.2)", animation: isActive ? "phase-glow 1s ease-in-out infinite" : "none" }} />}
                </div>
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-center"
                  style={{ color: isDone || isActive ? phase.color : "rgba(255,255,255,0.15)" }}>
                  {phase.label}
                </span>
                <span className="text-[7px] md:text-[8px] hidden md:block mt-0.5 text-center"
                  style={{ color: "rgba(255,255,255,0.1)" }}>{phase.desc}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────── */}
      <AnimatePresence>
        {showResult && tickResult && (
          <motion.div className="max-w-2xl mx-auto px-5 space-y-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

            {/* SENSE */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.5 }}
              className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4" style={{ color: "#3b82f6" }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Sense</span>
                <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Latest: {tickResult.phases.sense.latest_date}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(() => {
                  const today = (tickResult.phases.sense as any).today || {};
                  const avgs = tickResult.phases.sense.averages;
                  const baseline = tickResult.phases.think.baseline;
                  const metrics = [
                    { key: "hrv", label: "HRV", unit: "ms", todayVal: today.hrv, avgVal: avgs.hrv, blKey: "hrv" },
                    { key: "sleep_score", label: "Sleep", unit: "", todayVal: today.sleep_score, avgVal: avgs.sleep_score, blKey: "sleepScore" },
                    { key: "readiness", label: "Readiness", unit: "", todayVal: today.readiness, avgVal: avgs.readiness, blKey: "readiness" },
                    { key: "rhr", label: "RHR", unit: "bpm", todayVal: today.rhr, avgVal: avgs.rhr, blKey: "rhr" },
                  ];
                  return metrics.map((m) => {
                    const val = m.todayVal ?? m.avgVal;
                    const bl = baseline[m.blKey] || 0;
                    const delta = bl ? (val - bl) : 0;
                    const deltaColor = m.key === "rhr" ? (delta < 0 ? "#22c55e" : "#ef4444") : (delta > 0 ? "#22c55e" : "#ef4444");
                    return (
                      <div key={m.key} className="text-center rounded-xl py-3" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.08)" }}>
                        <p className="text-lg font-extrabold tabular-nums" style={{ color: "#e2e8f0" }}>
                          {Math.round(val)}
                          <span className="text-[10px] font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{m.unit}</span>
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{m.label}</p>
                        {m.avgVal != null && m.todayVal != null && Math.round(m.todayVal) !== Math.round(m.avgVal) && (
                          <p className="text-[8px] tabular-nums mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
                            7d avg: {Math.round(m.avgVal)}
                          </p>
                        )}
                        {bl > 0 && (
                          <p className="text-[8px] font-bold tabular-nums" style={{ color: deltaColor }}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(1)} vs baseline
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>

            {/* THINK */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}
              className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${severityColor}20` }}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#8b5cf6" }}>Think</span>
                {tickResult.phases.think.drift_detected && (
                  <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: severityColor + "18", color: severityColor, border: `1px solid ${severityColor}30` }}>
                    {tickResult.phases.think.severity} drift
                  </span>
                )}
              </div>
              {tickResult.phases.think.drift_detected ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: severityColor }} />
                    <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <strong style={{ color: severityColor }}>{tickResult.phases.think.consecutive_days} consecutive days</strong> of decline across {tickResult.phases.think.drivers.length} signals.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {tickResult.phases.think.drivers.map((d) => {
                      const MetricIcon = METRIC_ICONS[d.metric] || Activity;
                      const pct = Math.min(Math.abs(d.z_score) / 2.5 * 100, 100);
                      return (
                        <div key={d.metric}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1.5">
                              <MetricIcon className="w-3 h-3" style={{ color: severityColor }} />
                              <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{METRIC_LABELS[d.metric] || d.metric}</span>
                            </span>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: severityColor }}>z = {d.z_score.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                              style={{ background: `linear-gradient(90deg, ${severityColor}60, ${severityColor})` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" style={{ color: "#22c55e" }} />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>No drift detected. Baseline is stable.</p>
                </div>
              )}
            </motion.div>

            {/* DECIDE */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.5 }}
              className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.03) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "agent-scan 3s linear infinite" }} />
              <div className="flex items-center gap-2 mb-3 relative z-10 flex-wrap">
                <Crosshair className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>Decide</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {tickResult.phases.decide.rag_used && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.15)" }}>
                      RAG {tickResult.phases.decide.rag_chunks} sources
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <Sparkles className="w-3 h-3" />
                    {tickResult.phases.decide.source === "gemini" ? "Gemini 2.5" : "Rules"}
                  </span>
                </div>
              </div>
              <div className="relative z-10 rounded-xl p-4 mb-3" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.08)" }}>
                <p className="text-[12px] md:text-[13px] leading-relaxed italic" style={{ color: "rgba(255,255,255,0.65)" }}>
                  "{tickResult.phases.decide.reasoning}"
                </p>
                {tickResult.phases.decide.rag_used && (
                  <p className="text-[9px] mt-2 pt-2 border-t" style={{ color: "rgba(139,92,246,0.4)", borderColor: "rgba(139,92,246,0.1)" }}>
                    Reasoning enriched with {tickResult.phases.decide.rag_chunks} clinical research passages (Meeusen et al., Plews et al., Buchheit)
                  </p>
                )}
              </div>
              <div className="relative z-10 space-y-2">
                {tickResult.phases.decide.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.15)" }}>
                      <span className="text-[10px] font-black" style={{ color: "#fbbf24" }}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{TOOL_LABELS[a.tool] || a.tool}</p>
                      <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{a.why}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.15)" }} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ACT */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.5 }}
              className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(34,197,94,0.12)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>Micro-Interventions</span>
                <span className="ml-auto text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{tickResult.phases.act.actions_executed} executed</span>
              </div>
              <div className="space-y-2">
                {tickResult.phases.act.details.map((d, i) => {
                  const msg = d.result?.message || d.result?.workout?.note || d.result?.description || (d.result?.event ? `Blocked: ${d.result.event.title}` : d.result?.status || "");
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.08 }}
                      className="rounded-xl p-3.5" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.08)" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                        <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{TOOL_LABELS[d.tool] || d.tool}</span>
                      </div>
                      {msg && <p className="text-[11px] leading-relaxed pl-5" style={{ color: "rgba(255,255,255,0.45)" }}>{msg}</p>}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* NANDA COLLABORATION */}
            {(tickResult.phases as any).collaborate && (() => {
              const collab = (tickResult.phases as any).collaborate;
              const consensus = collab.consensus || [];
              const upgraded = collab.upgraded_plan;
              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.5 }}
                  className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(6,182,212,0.12)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4" style={{ color: "#06b6d4" }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#06b6d4" }}>NANDA Network</span>
                    <span className="ml-auto text-[10px] font-bold" style={{ color: collab.peers_collaborated > 0 ? "#22c55e" : "#22d3ee" }}>
                      {collab.peers_collaborated > 0 ? `${collab.peers_collaborated} collaborated` : `${collab.peers_connected} connected`}
                    </span>
                  </div>

                  {/* Agent list */}
                  <div className="space-y-1.5 mb-4">
                    {(collab.collaborators || []).map((c: any, i: number) => {
                      const collaborated = c.status === "collaborated";
                      const connected = c.status === "connected" || collaborated;
                      const sc = collaborated ? "#22c55e" : connected ? "#22d3ee" : "#6b7280";
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: collaborated ? "rgba(34,197,94,0.03)" : "rgba(255,255,255,0.01)" }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                          <span className="text-[10px] font-semibold flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {c.agent} <span style={{ color: "rgba(6,182,212,0.3)" }}>{c.username}</span>
                          </span>
                          <span className="text-[8px] font-bold uppercase" style={{ color: sc }}>
                            {collaborated ? "Responded" : c.role === "self" ? "Self" : connected ? "Verified" : "Offline"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Peer responses */}
                  {(collab.network_insights || []).length > 0 && (
                    <div className="mb-4">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(6,182,212,0.4)" }}>
                        Agent Responses
                      </p>
                      <div className="space-y-2">
                        {collab.network_insights.map((ins: any, i: number) => (
                          <div key={i} className="rounded-lg px-3 py-2" style={{ background: "rgba(6,182,212,0.03)", border: "1px solid rgba(6,182,212,0.05)" }}>
                            <p className="text-[9px] font-bold mb-0.5" style={{ color: "#22d3ee" }}>{ins.source}</p>
                            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{ins.response}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Consensus bars */}
                  {consensus.length > 0 && (
                    <div className="mb-4 rounded-xl p-4" style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.08)" }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "#06b6d4" }}>
                        Network Consensus
                      </p>
                      <div className="space-y-2.5">
                        {consensus.map((t: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{t.theme}</span>
                              <span className="text-[10px] font-bold tabular-nums" style={{ color: t.pct >= 60 ? "#22c55e" : t.pct >= 40 ? "#06b6d4" : "rgba(255,255,255,0.3)" }}>
                                {t.count}/{t.total} agents ({t.pct}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <motion.div className="h-full rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${t.pct}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                                style={{ background: t.pct >= 60 ? "linear-gradient(90deg, #22c55e80, #22c55e)" : "linear-gradient(90deg, #06b6d480, #06b6d4)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Network-enhanced micro-interventions */}
                  {upgraded && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.15)" }}>
                      <div className="px-4 py-3" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(6,182,212,0.08))" }}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" style={{ color: "#22c55e" }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>
                            Network-Enhanced Micro-Interventions
                          </span>
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {upgraded.original_count} original + {upgraded.final_count - upgraded.original_count} from expert agents = {upgraded.final_count} total
                        </p>
                      </div>
                      <div className="px-4 py-3" style={{ background: "rgba(34,197,94,0.03)" }}>
                        <p className="text-[11px] italic mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                          "{upgraded.reasoning}"
                        </p>
                        <div className="space-y-2">
                          {(upgraded.new_actions || []).map((a: any, i: number) => (
                            <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                              style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.08)" }}>
                              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: "rgba(34,197,94,0.15)" }}>
                                <span className="text-[9px] font-black" style={{ color: "#22c55e" }}>+</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>{a.action}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                                  {a.confidence} -- {a.source_theme} -- from {(a.credited_to || []).join(", ")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[9px] mt-3 text-center" style={{ color: "rgba(6,182,212,0.15)" }}>
                    join39.org/chat/yu7
                  </p>
                </motion.div>
              );
            })()}

            {/* MEASURE — Closed Loop */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.5 }}
              className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(236,72,153,0.12)" }}>

              {/* Header */}
              <div className="px-5 py-3" style={{ background: "rgba(236,72,153,0.06)" }}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: "#ec4899" }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ec4899" }}>Closed Loop</span>
                  <span className="text-[9px] ml-1" style={{ color: "rgba(236,72,153,0.4)" }}>Did the micro-interventions work?</span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-4" style={{ background: "rgba(255,255,255,0.015)" }}>

                {/* How it works explanation */}
                <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(236,72,153,0.03)", border: "1px solid rgba(236,72,153,0.06)" }}>
                  <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(236,72,153,0.4)" }} />
                  <div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                      YU Cortex snapshots your biometrics <strong style={{ color: "rgba(255,255,255,0.6)" }}>before</strong> each micro-intervention.
                      After 24h, it pulls fresh Oura data and compares: did HRV improve? Sleep score? Readiness?
                      Each intervention gets a verdict: <strong style={{ color: "#22c55e" }}>worked</strong>, <strong style={{ color: "#6b7280" }}>neutral</strong>, or <strong style={{ color: "#ef4444" }}>ineffective</strong>.
                      This feedback trains future decisions.
                    </p>
                  </div>
                </div>

                {/* Completed evaluations */}
                {tickResult.phases.measure.evaluations_completed > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#ec4899" }}>
                      Results -- {tickResult.phases.measure.evaluations_completed} evaluated
                    </p>
                    <div className="space-y-2">
                      {tickResult.phases.measure.evaluations.map((ev: any, i: number) => {
                        const isGood = ev.score > 0;
                        const isBad = ev.score < 0;
                        const color = isGood ? "#22c55e" : isBad ? "#ef4444" : "#6b7280";
                        const label = isGood ? "Worked" : isBad ? "Ineffective" : "Neutral";
                        const toolName = TOOL_LABELS[ev.intervention_id?.split("_").slice(1).join("_")] || ev.intervention_id;
                        return (
                          <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}18` }}>
                            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: `${color}08` }}>
                              {isGood ? <TrendingUp className="w-4 h-4" style={{ color }} /> : isBad ? <TrendingDown className="w-4 h-4" style={{ color }} /> : <Activity className="w-4 h-4" style={{ color }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>{toolName}</p>
                              </div>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>{label}</span>
                              <span className="text-lg font-extrabold tabular-nums" style={{ color }}>
                                {ev.score > 0 ? "+" : ""}{ev.score}
                              </span>
                            </div>
                            {ev.signals?.length > 0 && (
                              <div className="px-4 py-2 border-t" style={{ borderColor: `${color}10` }}>
                                {ev.signals.map((s: string, j: number) => (
                                  <p key={j} className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{s}</p>
                                ))}
                              </div>
                            )}
                            {ev.pre_metrics && ev.post_metrics && (
                              <div className="px-4 py-2 border-t grid grid-cols-4 gap-2" style={{ borderColor: `${color}10` }}>
                                {[
                                  { label: "HRV", pre: ev.pre_metrics.hrv, post: ev.post_metrics.hrv, unit: "ms", good: "up" },
                                  { label: "Sleep", pre: ev.pre_metrics.sleep_score, post: ev.post_metrics.sleep_score, unit: "", good: "up" },
                                  { label: "Ready", pre: ev.pre_metrics.readiness, post: ev.post_metrics.readiness, unit: "", good: "up" },
                                  { label: "RHR", pre: ev.pre_metrics.rhr, post: ev.post_metrics.rhr, unit: "bpm", good: "down" },
                                ].map((m, k) => {
                                  if (!m.pre && !m.post) return null;
                                  const delta = (m.post || 0) - (m.pre || 0);
                                  const improved = m.good === "up" ? delta > 0 : delta < 0;
                                  return (
                                    <div key={k} className="text-center">
                                      <p className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>{m.label}</p>
                                      <p className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
                                        {Math.round(m.pre || 0)} → <span style={{ color: improved ? "#22c55e" : delta === 0 ? "rgba(255,255,255,0.4)" : "#ef4444" }}>{Math.round(m.post || 0)}</span>
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending evaluations */}
                {tickResult.phases.measure.pending_evaluations > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(236,72,153,0.4)" }}>
                      Awaiting Oura data -- {tickResult.phases.measure.pending_evaluations} pending
                    </p>
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(236,72,153,0.03)", border: "1px solid rgba(236,72,153,0.06)" }}>
                      <div className="relative w-8 h-8 flex-shrink-0">
                        <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: "rgba(236,72,153,0.1)" }} />
                        <div className="absolute inset-0 rounded-full border-2 border-t-pink-500" style={{ animation: "loop-spin 3s linear infinite" }} />
                        <Clock className="absolute inset-0 m-auto w-3.5 h-3.5" style={{ color: "rgba(236,72,153,0.4)" }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Biometric snapshot saved. Waiting for 24h of new Oura data.
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                          When fresh data arrives, YU Cortex compares pre vs post and scores each micro-intervention.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cumulative effectiveness */}
                {effData.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(236,72,153,0.4)" }}>
                      Cumulative -- Which micro-interventions work for you?
                    </p>
                    <div style={{ height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={effData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                            formatter={(value: any, name: any, props: any) => [`${value}% (${props.payload.positive}/${props.payload.total})`, "Effective"]} />
                          <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                            {effData.map((entry, i) => (
                              <Cell key={i} fill={entry.rate >= 60 ? "#22c55e" : entry.rate >= 30 ? "#f59e0b" : "#ef4444"} fillOpacity={0.7} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Tick meta */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-center text-[10px] font-semibold tabular-nums pt-1 pb-1" style={{ color: "rgba(255,255,255,0.12)" }}>
              Tick #{tickResult.tick_number} -- {tickResult.duration_ms}ms -- {(tickResult as any).orchestration || "sequential"} orchestration
            </motion.p>

            {/* Contextual next steps */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-3 pb-2">
              {tickResult.phases.think.drift_detected && (
                <Link to="/drift" className="no-underline">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold border-0 cursor-pointer"
                    style={{ background: `${severityColor}12`, color: severityColor, border: `1px solid ${severityColor}20` }}>
                    <AlertTriangle className="w-3.5 h-3.5" /> View Drift Details
                  </button>
                </Link>
              )}
              {tickResult.phases.think.drift_detected && (
                <Link to="/recovery" className="no-underline">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold border-0 cursor-pointer"
                    style={{ background: "rgba(34,197,94,0.08)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <Zap className="w-3.5 h-3.5" /> Recovery Plan
                  </button>
                </Link>
              )}
              <Link to="/ask" className="no-underline">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold border-0 cursor-pointer"
                  style={{ background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <Brain className="w-3.5 h-3.5" /> Ask YU
                </button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tick History ──────────────────────────────── */}
      {tickHistory.length > 0 && (
        <div className="max-w-2xl mx-auto px-5 mt-6">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-left border-0 cursor-pointer"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
            <History className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-widest flex-1">Agent History</span>
            <span className="text-[10px] tabular-nums font-semibold">{tickHistory.length} ticks</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform" style={{ transform: showHistory ? "rotate(90deg)" : "rotate(0)" }} />
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className="space-y-1.5 pt-2">
                  {tickHistory.slice(0, 10).map((tick: any, i: number) => {
                    const severity = tick.phases?.think?.severity || "none";
                    const sc = SEVERITY_COLORS[severity] || "#6b7280";
                    const actions = tick.phases?.act?.actions_executed || 0;
                    const evals = tick.phases?.measure?.evaluations_completed || 0;
                    const source = tick.phases?.decide?.source || "?";
                    return (
                      <motion.div key={tick.tick_number || i}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${sc}15`, border: `1px solid ${sc}25` }}>
                          <span className="text-[9px] font-black" style={{ color: sc }}>#{tick.tick_number}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase" style={{ color: sc }}>{severity}</span>
                            <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
                            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>{actions} actions</span>
                            {evals > 0 && <span className="text-[9px]" style={{ color: "#ec4899" }}>{evals} evals</span>}
                          </div>
                        </div>
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ background: source === "gemini" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", color: source === "gemini" ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>
                          {source === "gemini" ? "LLM" : "Rules"}
                        </span>
                        <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.15)" }}>
                          {tick.duration_ms}ms
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Empty state with workflow explanation ───────── */}
      {!showResult && !running && tickHistory.length === 0 && (
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
          <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <Radio className="w-7 h-7 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm font-bold mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>YU Cortex standing by</p>
            <p className="text-[11px] mb-0" style={{ color: "rgba(255,255,255,0.15)" }}>
              Hit "Run Agent Loop" to execute one autonomous cycle
            </p>
          </div>

          {/* Workflow explanation */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 text-center" style={{ color: "rgba(255,255,255,0.15)" }}>How the autonomous loop works</p>
            <div className="space-y-3">
              {[
                { icon: "1", color: "#3b82f6", title: "Sense", desc: "Pulls passive biometric data from your Oura Ring: HRV, sleep score, readiness, resting heart rate, deep sleep, and stress minutes." },
                { icon: "2", color: "#8b5cf6", title: "Think", desc: "Runs drift detection using a 28-day personal baseline and weighted z-scores across 6 signals. RAG retrieves relevant clinical research (Meeusen, Plews, Buchheit) from an embedded knowledge base to inform the analysis." },
                { icon: "3", color: "#f59e0b", title: "Decide", desc: "Gemini LLM reasons about which micro-interventions to deploy based on drift severity, your intervention history, and retrieved clinical literature. Selects from: CBT coaching, sleep protocols, calendar blocks, and workout adjustments." },
                { icon: "4", color: "#22c55e", title: "Micro-Interventions", desc: "Executes CBT-grounded micro-interventions automatically. These are small, specific, actionable steps designed to shift your baseline back toward recovery within 24-48 hours." },
                { icon: "5", color: "#06b6d4", title: "Network Enrichment", desc: "Queries expert agents on the NANDA network (Join39.org). Each peer agent contributes a unique recovery insight. YU Cortex calculates consensus and autonomously adds network-sourced micro-interventions to the plan." },
                { icon: "6", color: "#ec4899", title: "Measure (Closed Loop)", desc: "After 24 hours, compares your post-intervention biometrics against pre-intervention baseline. Scores whether each micro-intervention actually worked. Feeds results back into future decisions." },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${step.color}15`, border: `1px solid ${step.color}25` }}>
                    <span className="text-[10px] font-black" style={{ color: step.color }}>{step.icon}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: step.color }}>{step.title}</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-center mt-4" style={{ color: "rgba(255,255,255,0.08)" }}>
              Runs autonomously every 24 hours. All data from Oura Ring API. Clinical research via RAG. Agent network via NANDA/Join39.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto px-5 mt-4">
          <div className="rounded-xl p-4 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "#f87171" }}>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
