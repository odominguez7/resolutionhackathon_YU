import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Dumbbell, Footprints, Wind, Moon, AlertTriangle, Zap, ChevronDown, Check } from "lucide-react";
import { api } from "@/lib/api";
import WorkoutSkeleton from "@/components/WorkoutSkeleton";

const ease = [0.2, 0.8, 0.2, 1] as const;
const API = (import.meta as any).env?.VITE_API_BASE || "";

const ACTION_ICONS: Record<string, any> = { workout: Dumbbell, walk: Footprints, stretch: Wind, rest: Moon };
const ACTION_COLORS: Record<string, string> = { workout: "#FF5C35", walk: "#6EE7FF", stretch: "#C2FF4A", rest: "#A78BFA" };
const ACTION_LABELS: Record<string, string> = { workout: "Workout", walk: "Zone 2 Walk", stretch: "Stretch & Breathwork", rest: "Active Rest" };

export default function Today() {
  const [todayData, setTodayData] = useState<any>(null);
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Morning check-in state (self-report BEFORE biometrics)
  const [phase, setPhase] = useState<"checkin" | "reveal" | "action">("checkin");
  const [energy, setEnergy] = useState<number | null>(null);
  const [fusion, setFusion] = useState<any>(null);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [rpe, setRpe] = useState(7);
  const [showRpe, setShowRpe] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const [fuelAnswer, setFuelAnswer] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Session mode state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMovIdx, setSessionMovIdx] = useState(0);
  const [sessionSetNum, setSessionSetNum] = useState(1);
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [loggedSets, setLoggedSets] = useState<Record<string, any>>({});
  const [logForm, setLogForm] = useState<{ reps: string; load: string; rpe: number }>({ reps: "", load: "", rpe: 7 });
  const restRef = useRef<any>(null);

  useEffect(() => {
    api.get("/api/oura/daily-action").then(d => {
      setTodayData(d);
      const actionType = d?.action?.action;
      if (actionType === "workout" && d?.existing_workout?.full_workout) {
        setWorkout(d.existing_workout.full_workout);
        if (d.existing_workout.user_feedback?.completed) {
          setFeedback(d.existing_workout.user_feedback.completed);
          setPhase("action"); // already completed today — skip check-in
        }
      } else {
        setWorkout(null);
      }
      // Detect anomaly for curiosity gap
      const body = d?.body || {};
      const bl = body.hrv_baseline;
      const hrv = body.hrv;
      if (hrv && bl && Math.abs(hrv - bl) > 5) setIsAnomaly(true);
      if (d?.strategy?.strategy === "pull_back" || d?.strategy?.strategy === "recover") setIsAnomaly(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const generateWorkout = async (sessionType: string = "crossfit") => {
    setGenerating(true);
    setWorkout(null);  // clear any stale workout before generating
    try {
      const w = await api.get(`/api/oura/workout?session_type=${sessionType}`);
      if (w && !w.error) {
        setWorkout(w);
      }
    } catch {}
    setGenerating(false);
  };

  const submitFeedback = async (completed: string, skipReason?: string) => {
    setFeedback(completed);
    setShowSkipReasons(false);
    if (completed === "yes") setShowRpe(true);
    const logId = todayData?.existing_workout?.id || workout?.log_id;
    if (logId) {
      await fetch(`${API}/api/oura/workout/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, completed, skip_reason: skipReason, rpe: completed === "yes" ? rpe : undefined }),
      }).catch(() => {});
    }
  };

  const submitRpe = async () => {
    setShowRpe(false);
    const logId = todayData?.existing_workout?.id || workout?.log_id;
    if (logId) {
      await fetch(`${API}/api/oura/workout/rpe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, movement_name: "overall_session", set_number: 0, rpe }),
      }).catch(() => {});
    }
  };

  const playBeep = (freq: number = 880, dur: number = 150) => {
    try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = freq; g.gain.value = 0.3; o.start(); o.stop(c.currentTime + dur / 1000); } catch {}
    try { navigator.vibrate?.(200); } catch {}
  };

  const startRest = (sec: number = 90) => {
    setRestTimer(sec); setRestRunning(true);
    if (restRef.current) clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) { clearInterval(restRef.current); setRestRunning(false); playBeep(1046, 300); try { navigator.vibrate?.([200, 100, 200]); } catch {} return 0; }
        if (prev <= 4) playBeep(660, 80);
        return prev - 1;
      });
    }, 1000);
  };

  const logSet = async (movName: string) => {
    const setNum = Object.keys(loggedSets).filter(k => k.startsWith(movName + "_")).length + 1;
    const key = `${movName}_s${setNum}`;
    const logId = todayData?.existing_workout?.id || workout?.log_id;
    if (logId) {
      await fetch(`${API}/api/oura/workout/rpe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, movement_name: movName, set_number: setNum, reps_actual: logForm.reps, load_actual: logForm.load, rpe: logForm.rpe }),
      }).catch(() => {});
    }
    setLoggedSets(prev => ({ ...prev, [key]: { reps: logForm.reps, load: logForm.load, rpe: logForm.rpe } }));
    setLogForm({ reps: "", load: "", rpe: 7 });
  };

  const getAllMovements = () => {
    if (!workout) return [];
    const all: any[] = [];
    for (const bk of ["warmup", "strength", "metcon", "workout", "cooldown"]) {
      const block = workout[bk];
      if (!block?.movements) continue;
      for (const m of block.movements) {
        const name = typeof m === "object" ? (m.movement_name || m.name || "") : String(m);
        const reps = typeof m === "object" ? (m.reps || "") : "";
        const load = typeof m === "object" ? (m.load || "") : "";
        all.push({ name, reps, load, block: bk });
      }
    }
    return all;
  };

  const submitCheckin = async (score: number) => {
    setEnergy(score);
    try {
      const res = await api.post("/api/oura/checkin", { energy: score });
      if (res?.fusion) setFusion(res.fusion);
    } catch {}
    setPhase("reveal");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0b0d" }}><div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#FF5C35" }} /></div>;

  const action = todayData?.action || {};
  const body = todayData?.body || {};
  const week = todayData?.week || {};
  const Icon = ACTION_ICONS[action.action] || Activity;
  const color = ACTION_COLORS[action.action] || "#FF5C35";

  // Session mode overlay
  if (sessionActive) {
    const allMovs = getAllMovements();
    const current = allMovs[sessionMovIdx];
    const total = allMovs.length;
    const progress = total > 0 ? Math.round((sessionMovIdx / total) * 100) : 0;

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0b0d" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSessionActive(false); if (restRef.current) clearInterval(restRef.current); }} className="text-xs text-slate-500 cursor-pointer border-0 bg-transparent">Exit</button>
          <p className="text-xs text-slate-400">{sessionMovIdx + 1} / {total}</p>
          <p className="text-xs text-slate-500">{workout?.title}</p>
        </div>
        <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.04)" }}><div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: "#FF5C35" }} /></div>
        {current && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: `${color}80` }}>{current.block}</p>
            {current.reps && <p className="text-5xl font-black text-white">{current.reps}</p>}
            <p className="text-xl font-bold text-white">{current.name}</p>
            {current.load && <p className="text-sm text-slate-400">{current.load}</p>}
            {restRunning ? (
              <>
                <p className="text-4xl font-black" style={{ color: restTimer <= 10 ? "#FF5C35" : "#6EE7FF" }}>{restTimer}s</p>
                <button onClick={() => { clearInterval(restRef.current); setRestRunning(false); setRestTimer(0); }} className="text-xs text-slate-500 cursor-pointer border-0 bg-transparent">Skip rest</button>
              </>
            ) : (
              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">RPE</span>
                  <input type="range" min={1} max={10} value={logForm.rpe} onChange={e => setLogForm(f => ({ ...f, rpe: Number(e.target.value) }))} className="w-32 h-1" />
                  <span className="text-sm font-bold" style={{ color: logForm.rpe >= 9 ? "#FF5C35" : logForm.rpe >= 7 ? "#FFC36B" : "#C2FF4A" }}>{logForm.rpe}</span>
                </div>
                <button onClick={async () => { await logSet(current.name); setSessionSetNum(prev => prev + 1); startRest(90); }}
                  className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0" style={{ background: "#FF5C35", color: "#fff" }}>
                  Log Set + Rest 90s
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setSessionMovIdx(Math.max(0, sessionMovIdx - 1)); setSessionSetNum(1); }}
                    disabled={sessionMovIdx === 0} className="flex-1 py-2 rounded-lg text-xs cursor-pointer border-0" style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8" }}>Prev</button>
                  <button onClick={() => {
                    if (sessionMovIdx >= total - 1) { setSessionActive(false); submitFeedback("yes"); return; }
                    setSessionMovIdx(sessionMovIdx + 1); setSessionSetNum(1); if (restRef.current) clearInterval(restRef.current); setRestRunning(false);
                  }} className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer border-0"
                    style={{ background: sessionMovIdx >= total - 1 ? "rgba(194,255,74,0.15)" : "rgba(255,255,255,0.06)", color: sessionMovIdx >= total - 1 ? "#C2FF4A" : "#A5B4FC" }}>
                    {sessionMovIdx >= total - 1 ? "Finish" : "Next"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── PHASE 1: MORNING CHECK-IN (before biometrics) ──
  if (phase === "checkin" && !feedback) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0a0b0d" }}>
        <motion.div className="w-full max-w-sm text-center space-y-8"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          <div>
            <p className="text-2xl font-black text-white mb-2">How are you showing up today?</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Before we show you the data. Your felt state matters.</p>
          </div>
          <div className="flex justify-center gap-3">
            {[
              { score: 1, label: "Drained", color: "#FF5D6C" },
              { score: 2, label: "Low", color: "#FFC36B" },
              { score: 3, label: "Okay", color: "#94A3B8" },
              { score: 4, label: "Good", color: "#6EE7FF" },
              { score: 5, label: "Peak", color: "#C2FF4A" },
            ].map(e => (
              <motion.button key={e.score}
                onClick={() => submitCheckin(e.score)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer border-0"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                whileHover={{ scale: 1.05, borderColor: `${e.color}40` }}
                whileTap={{ scale: 0.95 }}>
                <span className="text-2xl font-black" style={{ color: e.color }}>{e.score}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${e.color}80` }}>{e.label}</span>
              </motion.button>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.1)" }}>2 taps. Under 10 seconds.</p>
        </motion.div>
      </div>
    );
  }

  // ── PHASE 2: CURIOSITY GAP + REVEAL ──
  if (phase === "reveal") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#0a0b0d" }}>
        <motion.div className="w-full max-w-sm text-center space-y-6"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          {/* Fusion insight (if available) */}
          {fusion && (
            <motion.div className="rounded-xl p-4 text-left" style={{ background: "rgba(110,231,255,0.04)", border: "1px solid rgba(110,231,255,0.1)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{fusion.message}</p>
            </motion.div>
          )}

          {/* Curiosity gap */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isAnomaly
                ? "Something shifted in your overnight recovery."
                : "Your biometrics are within your normal range. Steady as you go."}
            </p>
            <motion.button
              onClick={() => setPhase("action")}
              className="px-8 py-3.5 rounded-xl text-sm font-black cursor-pointer border-0"
              style={{ background: isAnomaly ? "#FF5C35" : "rgba(255,255,255,0.06)", color: isAnomaly ? "#fff" : "#94A3B8" }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {isAnomaly ? "Reveal your data" : "See today's plan"}
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── PHASE 3: ACTION (the main /today content) ──
  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto" style={{ background: "#0a0b0d" }}>

      {/* BODY CONTEXT */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
        <p className="text-[10px] uppercase tracking-wider font-bold mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>Your body right now</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "HRV", value: body.hrv ? `${body.hrv}ms` : "--", sub: body.hrv_baseline ? `bl ${Math.round(body.hrv_baseline)}` : "" },
            { label: "Ready", value: body.readiness || "--" },
            { label: "Sleep", value: body.sleep_score || "--" },
            { label: "Stress", value: body.stress_min != null ? `${body.stress_min}m` : "--" },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-xl font-black text-white">{m.value}</p>
              <p className="text-[8px] uppercase tracking-wider font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>{m.label}</p>
              {m.sub && <p className="text-[8px]" style={{ color: "rgba(255,255,255,0.1)" }}>{m.sub}</p>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* FUEL PROMPT */}
      {action.fuel_prompt && !fuelAnswer && (
        <motion.div className="rounded-xl p-3.5 mb-4 flex items-center gap-3" style={{ background: "rgba(255,195,107,0.06)", border: "1px solid rgba(255,195,107,0.15)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ease }}>
          <p className="text-xs text-amber-200 flex-1">Did you eat enough yesterday to push today?</p>
          <div className="flex gap-1.5">
            <button onClick={() => setFuelAnswer("yes")} className="text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(194,255,74,.15)", color: "#C2FF4A" }}>Yes</button>
            <button onClick={() => setFuelAnswer("no")} className="text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(255,93,108,.15)", color: "#FF5D6C" }}>Not really</button>
          </div>
        </motion.div>
      )}

      {/* HRV STRATEGY — multi-week context */}
      {todayData?.strategy?.reasoning && (
        <motion.div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(110,231,255,0.04)", border: "1px solid rgba(110,231,255,0.1)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, ease }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-3.5 h-3.5" style={{ color: "#6EE7FF" }} />
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#6EE7FF" }}>
              HRV Strategy: {todayData.strategy.strategy?.replace("_", " ")}
            </p>
            {todayData.strategy.hrv_trend && (
              <span className="text-[9px] px-2 py-0.5 rounded-full ml-auto" style={{
                background: todayData.strategy.hrv_trend.direction === "improving" ? "rgba(194,255,74,.12)" :
                           todayData.strategy.hrv_trend.direction === "declining" ? "rgba(255,93,108,.12)" : "rgba(255,255,255,.04)",
                color: todayData.strategy.hrv_trend.direction === "improving" ? "#C2FF4A" :
                       todayData.strategy.hrv_trend.direction === "declining" ? "#FF5D6C" : "#94A3B8",
              }}>{todayData.strategy.hrv_trend.direction} {todayData.strategy.hrv_trend.slope_ms_per_week > 0 ? "+" : ""}{todayData.strategy.hrv_trend.slope_ms_per_week}ms/wk</span>
            )}
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{todayData.strategy.reasoning}</p>
        </motion.div>
      )}

      {/* TODAY'S ACTION */}
      <motion.div className="rounded-2xl p-5 mb-4" style={{ background: `${color}06`, border: `1.5px solid ${color}18` }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }}>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-lg font-black text-white">{ACTION_LABELS[action.action] || "Your Session"}</p>
            {action.intensity && <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}90` }}>{action.intensity} day · {action.duration_min}min</p>}
          </div>
        </div>

        <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{action.reasoning}</p>

        {/* WORKOUT CONTENT (only for actual workout action with crossfit-style blocks) */}
        {action.action === "workout" && workout && !generating && workout.session_type !== "rest" && (
          <>
            <div className="mb-3">
              <p className="text-sm font-black text-white">{workout.title}</p>
              <p className="text-[10px] text-slate-500">{workout.format} · {workout.duration_min}min</p>
            </div>

            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-slate-400 cursor-pointer border-0 bg-transparent flex items-center gap-1 mb-3">
              <ChevronDown className="w-3 h-3" style={{ transform: expanded ? "rotate(180deg)" : "" }} />
              {expanded ? "Hide details" : "Show full workout"}
            </button>

            {expanded && (
              <div className="space-y-3 mb-4">
                {["warmup", "strength", "metcon", "workout", "cooldown"].map(bk => {
                  const block = workout[bk];
                  if (!block?.movements?.length) return null;
                  return (
                    <div key={bk} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: `${color}80` }}>
                        {bk}{block.sets ? ` · ${block.sets} sets` : ""}{block.rounds ? ` · ${block.rounds} rounds` : ""}
                      </p>
                      {block.movements.map((m: any, i: number) => (
                        <p key={i} className="text-xs text-slate-300 pl-2">
                          {typeof m === "object" ? `${m.reps || ""} ${m.movement_name || ""} ${m.load ? `(${m.load})` : ""}`.trim() : m}
                        </p>
                      ))}
                      {block.rest && <p className="text-[10px] text-slate-500 mt-1">Rest: {block.rest}</p>}
                      {block.time_cap && <p className="text-[10px] text-slate-500 mt-1">Time Cap: {block.time_cap}{typeof block.time_cap === "number" ? " min" : ""}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* START SESSION */}
            {!feedback && (
              <button onClick={() => setSessionActive(true)}
                className="w-full py-3.5 rounded-xl text-sm font-black cursor-pointer border-0 mb-2"
                style={{ background: "#FF5C35", color: "#fff" }}>
                <Zap className="w-4 h-4 inline mr-1" /> Start Session
              </button>
            )}
          </>
        )}

        {/* GENERATE BUTTON (if no workout yet) */}
        {action.action === "workout" && !workout && !generating && (
          <button onClick={() => generateWorkout("crossfit")}
            className="w-full py-3.5 rounded-xl text-sm font-black cursor-pointer border-0"
            style={{ background: "#FF5C35", color: "#fff" }}>
            Generate my workout
          </button>
        )}

        {generating && <WorkoutSkeleton />}

        {/* STRETCH / WALK / REST — generate a real session via Gemini */}
        {action.action !== "workout" && !workout && !generating && !overriding && (
          <button onClick={() => generateWorkout("rest")}
            className="w-full py-3.5 rounded-xl text-sm font-black cursor-pointer border-0"
            style={{ background: color, color: "#fff" }}>
            Generate my {ACTION_LABELS[action.action] || "session"}
          </button>
        )}

        {action.action !== "workout" && workout && !generating && (
          <>
            <div className="mb-3">
              <p className="text-sm font-black text-white">{workout.title}</p>
              <p className="text-[10px] text-slate-500">{workout.session_type || action.action} · {workout.duration_min || action.duration_min}min</p>
            </div>

            {expanded && (
              <div className="space-y-3 mb-4">
                {/* Rest/stretch/walk sessions use different block names */}
                {workout.micro_interventions && (
                  <div className="space-y-2">
                    {workout.micro_interventions.map((item: any, i: number) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: item.color || color }} />
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}90` }}>{item.category || item.title}</p>
                          {item.duration && <p className="text-[9px] text-slate-500">{item.duration}</p>}
                        </div>
                        <p className="text-xs text-slate-300">{item.description || item.title}</p>
                        {item.science && <p className="text-[9px] text-slate-500 italic mt-1">{item.science}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {workout.why_rest && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: `${color}80` }}>Why this matters</p>
                    <p className="text-xs text-slate-300">{workout.why_rest}</p>
                  </div>
                )}
                {workout.walk && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: `${color}80` }}>Walk protocol</p>
                    <p className="text-xs text-slate-300">{workout.walk}</p>
                  </div>
                )}
                {workout.sleep_protocol && (
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: `${color}80` }}>Tonight</p>
                    <p className="text-xs text-slate-300">{workout.sleep_protocol}</p>
                  </div>
                )}
                {/* Fallback: show any warmup/workout/cooldown blocks if present */}
                {["warmup", "workout", "cooldown"].map(bk => {
                  const block = workout[bk];
                  if (!block?.movements?.length) return null;
                  return (
                    <div key={bk} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: `${color}80` }}>{bk}</p>
                      {block.movements.map((m: any, i: number) => (
                        <p key={i} className="text-xs text-slate-300 pl-2">
                          {typeof m === "object" ? `${m.reps || ""} ${m.movement_name || ""} ${m.load ? `(${m.load})` : ""}`.trim() : m}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-slate-400 cursor-pointer border-0 bg-transparent flex items-center gap-1 mb-2">
              <ChevronDown className="w-3 h-3" style={{ transform: expanded ? "rotate(180deg)" : "" }} />
              {expanded ? "Hide details" : "Show full session"}
            </button>
          </>
        )}

        {action.action !== "workout" && generating && <WorkoutSkeleton />}

        {/* OVERRIDE */}
        {action.override_warning && !overriding && !feedback && (
          <button onClick={() => setOverriding(true)}
            className="w-full mt-3 py-2 rounded-lg text-[10px] cursor-pointer border-0 flex items-center justify-center gap-1"
            style={{ background: "rgba(255,255,255,0.03)", color: "#64748B", border: "1px solid rgba(255,255,255,0.06)" }}>
            <AlertTriangle className="w-3 h-3" /> Override — I want to train anyway
          </button>
        )}

        {overriding && action.override_warning && (
          <motion.div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,93,108,0.06)", border: "1px solid rgba(255,93,108,0.15)" }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs text-red-300 mb-2">{action.override_warning}</p>
            <button onClick={() => generateWorkout("crossfit")}
              className="w-full py-2.5 rounded-lg text-xs font-bold cursor-pointer border-0"
              style={{ background: "rgba(255,93,108,0.15)", color: "#FCA5A5" }}>
              Understood — generate workout anyway
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* FEEDBACK */}
      {(workout || action.action !== "workout") && !feedback && !generating && (
        <motion.div className="rounded-xl p-4 mb-4" style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <p className="text-xs font-bold text-indigo-300 mb-2">Did you do it?</p>
          <div className="flex gap-2">
            <button onClick={() => submitFeedback("yes")} className="text-[10px] font-bold px-4 py-1.5 rounded-full cursor-pointer border-0" style={{ background: "rgba(194,255,74,.15)", color: "#C2FF4A" }}>Yes</button>
            <button onClick={() => submitFeedback("partial")} className="text-[10px] font-bold px-4 py-1.5 rounded-full cursor-pointer border-0" style={{ background: "rgba(255,195,107,.15)", color: "#FFC36B" }}>Partial</button>
            <button onClick={() => setShowSkipReasons(true)} className="text-[10px] font-bold px-4 py-1.5 rounded-full cursor-pointer border-0" style={{ background: "rgba(255,93,108,.15)", color: "#FF5D6C" }}>Skipped</button>
          </div>
          {showSkipReasons && (
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {["travel", "illness", "work_overload", "low_motivation"].map(r => (
                <button key={r} onClick={() => submitFeedback("no", r)} className="text-[9px] px-2.5 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(255,93,108,.1)", color: "#FCA5A5" }}>
                  {r.replace("_", " ")}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* RPE AFTER YES */}
      {showRpe && (
        <motion.div className="rounded-xl p-4 mb-4" style={{ background: "rgba(194,255,74,0.04)", border: "1px solid rgba(194,255,74,0.1)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold mb-2" style={{ color: "#C2FF4A" }}>How hard did it feel? (RPE)</p>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-slate-500">Easy</span>
            <input type="range" min={1} max={10} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="flex-1 h-1" />
            <span className="text-sm font-black" style={{ color: rpe >= 9 ? "#FF5C35" : rpe >= 7 ? "#FFC36B" : "#C2FF4A" }}>{rpe}</span>
            <span className="text-[9px] text-slate-500">Max</span>
          </div>
          <button onClick={submitRpe} className="w-full mt-2 py-2 rounded-lg text-xs font-bold cursor-pointer border-0" style={{ background: "rgba(194,255,74,.12)", color: "#C2FF4A" }}>
            Log RPE
          </button>
        </motion.div>
      )}

      {/* FEEDBACK CONFIRMED */}
      {feedback && !showRpe && (
        <motion.div className="text-center py-2 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Check className="w-5 h-5 mx-auto mb-1" style={{ color: "#C2FF4A" }} />
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Logged: {feedback === "yes" ? "completed" : feedback === "partial" ? "partial" : "skipped"}. Tomorrow's session will account for this.
          </p>
        </motion.div>
      )}

      {/* COMPETENCE SIGNAL (not streak counter) */}
      {todayData?.strategy?.hrv_trend && (
        <motion.div className="py-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {(() => {
            const trend = todayData.strategy.hrv_trend;
            const slope = trend.slope_ms_per_week || 0;
            const dir = trend.direction;
            if (dir === "improving" && slope > 0.5) {
              return <p className="text-xs" style={{ color: "rgba(194,255,74,0.6)" }}>Your HRV improved {slope}ms/week over the last month. Your training is working.</p>;
            }
            if (dir === "declining") {
              return <p className="text-xs" style={{ color: "rgba(255,93,108,0.5)" }}>HRV trending down {Math.abs(slope)}ms/week. The system is adjusting your load.</p>;
            }
            // Flat or mild — show nothing. Silence on quiet days is premium.
            return null;
          })()}
        </motion.div>
      )}
    </div>
  );
}
