import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Dumbbell, Footprints, Wind, Moon, AlertTriangle, Zap, ChevronDown, Check, Eye, Lock } from "lucide-react";
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
    const progress = total > 0 ? (sessionMovIdx / total) * 100 : 0;
    const setsForCurrent = Object.keys(loggedSets).filter(k => k.startsWith((current?.name || "") + "_")).length;
    const blockColors: Record<string,string> = { warmup: "#FFC36B", strength: "#FF5C35", metcon: "#6EE7FF", workout: "#FF5C35", cooldown: "#A78BFA" };
    const blockColor = blockColors[current?.block || ""] || color;

    // Ring SVG for rest timer
    const restR = 70, restStroke = 6, restCirc = 2 * Math.PI * restR;
    const restPct = restRunning && restTimer > 0 ? restTimer / 90 : 0;

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0b0d" }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSessionActive(false); if (restRef.current) clearInterval(restRef.current); }}
            className="text-xs font-bold cursor-pointer border-0 bg-transparent px-3 py-1.5 rounded-lg"
            style={{ color: "#94A3B8", background: "rgba(255,255,255,0.04)" }}>Exit</button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>{workout?.title}</p>
            <p className="text-xs font-black text-white">{sessionMovIdx + 1} of {total}</p>
          </div>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        {/* Progress bar with block color */}
        <div className="h-1.5 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <motion.div className="h-full" style={{ background: `linear-gradient(90deg, ${blockColor}, ${blockColor}90)` }}
            initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {current && (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            {restRunning ? (
              /* ── REST STATE: circular timer ── */
              <motion.div className="flex flex-col items-center gap-6"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                <div className="relative" style={{ width: 180, height: 180 }}>
                  {/* Pulsing glow */}
                  <div className="absolute inset-0 rounded-full" style={{
                    background: `radial-gradient(circle, ${restTimer <= 10 ? "rgba(255,92,53,0.12)" : "rgba(110,231,255,0.08)"} 0%, transparent 70%)`,
                    animation: restTimer <= 5 ? "glow-breathe 0.5s ease-in-out infinite" : restTimer <= 10 ? "glow-breathe 1s ease-in-out infinite" : "none",
                  }} />
                  <svg width="180" height="180" viewBox="0 0 180 180" className="relative z-10">
                    <circle cx="90" cy="90" r={restR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={restStroke} />
                    <circle cx="90" cy="90" r={restR} fill="none"
                      stroke={restTimer <= 10 ? "#FF5C35" : "#6EE7FF"}
                      strokeWidth={restStroke} strokeLinecap="round"
                      transform="rotate(-90 90 90)"
                      strokeDasharray={restCirc}
                      strokeDashoffset={restCirc * (1 - restPct)}
                      style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }} />
                    <text x="90" y="82" textAnchor="middle" fill="white" fontSize="42" fontWeight="900"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{restTimer}</text>
                    <text x="90" y="105" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11"
                      fontWeight="700" letterSpacing="2">REST</text>
                  </svg>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Up next: {allMovs[sessionMovIdx + 1]?.name || "finish"}
                </p>
                <button onClick={() => { clearInterval(restRef.current); setRestRunning(false); setRestTimer(0); }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer border-0"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.06)" }}>
                  Skip rest
                </button>
              </motion.div>
            ) : (
              /* ── ACTIVE STATE: movement display ── */
              <motion.div className="flex flex-col items-center gap-5 w-full max-w-sm"
                key={sessionMovIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                {/* Block label */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: blockColor }} />
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: `${blockColor}90` }}>{current.block}</p>
                </div>

                {/* Movement name + reps */}
                <div className="text-center">
                  {current.reps && (
                    <p className="text-6xl font-black text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em" }}>
                      {current.reps}
                    </p>
                  )}
                  <p className="text-xl font-black text-white">{current.name}</p>
                  {current.load && (
                    <p className="text-sm mt-1 font-bold" style={{ color: `${blockColor}80` }}>{current.load}</p>
                  )}
                </div>

                {/* Set history for this movement */}
                {setsForCurrent > 0 && (
                  <div className="flex gap-2">
                    {Array.from({ length: setsForCurrent }, (_, i) => {
                      const key = `${current.name}_s${i + 1}`;
                      const set = loggedSets[key];
                      return (
                        <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black"
                          style={{ background: "rgba(194,255,74,0.12)", color: "#C2FF4A" }}>
                          {set?.rpe || "✓"}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* RPE slider */}
                <div className="w-full rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>Effort (RPE)</span>
                    <span className="text-lg font-black" style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: logForm.rpe >= 9 ? "#FF5C35" : logForm.rpe >= 7 ? "#FFC36B" : "#C2FF4A",
                    }}>{logForm.rpe}</span>
                  </div>
                  <input type="range" min={1} max={10} value={logForm.rpe}
                    onChange={e => setLogForm(f => ({ ...f, rpe: Number(e.target.value) }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(90deg, #C2FF4A, #FFC36B, #FF5C35)`, opacity: 0.6 }} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>Easy</span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>Max effort</span>
                  </div>
                </div>

                {/* Log + Rest button */}
                <button onClick={async () => { await logSet(current.name); setSessionSetNum(prev => prev + 1); startRest(90); }}
                  className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.25)" }}>
                  <Check className="w-4 h-4" /> Log Set · Rest 90s
                </button>

                {/* Navigation */}
                <div className="flex gap-3 w-full">
                  <button onClick={() => { setSessionMovIdx(Math.max(0, sessionMovIdx - 1)); setSessionSetNum(1); }}
                    disabled={sessionMovIdx === 0}
                    className="flex-1 py-3 rounded-xl text-xs font-bold cursor-pointer border-0"
                    style={{ background: "rgba(255,255,255,0.03)", color: sessionMovIdx === 0 ? "rgba(255,255,255,0.1)" : "#94A3B8", border: "1px solid rgba(255,255,255,0.06)" }}>
                    Prev
                  </button>
                  <button onClick={() => {
                    if (sessionMovIdx >= total - 1) { setSessionActive(false); submitFeedback("yes"); return; }
                    setSessionMovIdx(sessionMovIdx + 1); setSessionSetNum(1); if (restRef.current) clearInterval(restRef.current); setRestRunning(false);
                  }}
                    className="flex-1 py-3 rounded-xl text-xs font-black cursor-pointer border-0"
                    style={{
                      background: sessionMovIdx >= total - 1 ? "rgba(194,255,74,0.1)" : "rgba(255,255,255,0.03)",
                      color: sessionMovIdx >= total - 1 ? "#C2FF4A" : "#A5B4FC",
                      border: `1px solid ${sessionMovIdx >= total - 1 ? "rgba(194,255,74,0.2)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    {sessionMovIdx >= total - 1 ? "Finish ✓" : "Next →"}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Bottom safe area */}
        <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    );
  }

  // ── PHASE 1: MORNING CHECK-IN (before biometrics) ──
  if (phase === "checkin" && !feedback) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#0a0b0d" }}>
        {/* Subtle ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,92,53,0.06) 0%, transparent 70%)" }} />
        <motion.div className="w-full max-w-md text-center space-y-10 relative z-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "rgba(255,92,53,0.5)" }}>Readiness check</p>
            <p className="text-3xl font-black text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em", lineHeight: 1.15 }}>How ready are you to perform?</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Your perception first. Then we compare it to the data.</p>
          </div>
          <div className="flex justify-center gap-3">
            {[
              { score: 1, label: "Drained", emoji: "🔻", color: "#FF5D6C" },
              { score: 2, label: "Low", emoji: "△", color: "#FFC36B" },
              { score: 3, label: "Okay", emoji: "●", color: "#94A3B8" },
              { score: 4, label: "Good", emoji: "▲", color: "#6EE7FF" },
              { score: 5, label: "Peak", emoji: "⚡", color: "#C2FF4A" },
            ].map(e => (
              <motion.button key={e.score}
                onClick={() => submitCheckin(e.score)}
                className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl cursor-pointer border-0"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", minWidth: 68 }}
                whileHover={{ scale: 1.08, borderColor: `${e.color}50`, background: `${e.color}08` }}
                whileTap={{ scale: 0.93 }}>
                <span className="text-3xl font-black" style={{ color: e.color }}>{e.score}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${e.color}70` }}>{e.label}</span>
              </motion.button>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.12)" }}>One tap. Your data is waiting on the other side.</p>
        </motion.div>
      </div>
    );
  }

  // ── PHASE 2: CURIOSITY GAP + REVEAL ──
  // Prediction-confirmation: compare felt state to biometric reality
  const energyLabel = energy === 5 ? "Peak" : energy === 4 ? "Good" : energy === 3 ? "Okay" : energy === 2 ? "Low" : "Drained";
  const readiness = body.readiness || 0;
  const bodyAgrees = (energy && energy >= 4 && readiness >= 70) || (energy && energy <= 2 && readiness < 60);
  const confirmationMsg = bodyAgrees
    ? `You said "${energyLabel}" — your body data backs that up.`
    : energy && energy >= 4 && readiness < 60
    ? `You feel ${energyLabel.toLowerCase()}, but your recovery is lagging. The plan adjusts for that.`
    : energy && energy <= 2 && readiness >= 70
    ? `You feel ${energyLabel.toLowerCase()}, but your biometrics look solid. Trust the process.`
    : null;

  if (phase === "reveal") {
    const hrvDisplay = body.hrv ? `${body.hrv}` : "--";
    const readinessDisplay = body.readiness || "--";
    const sleepDisplay = body.sleep_score || "--";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{ background: "#0a0b0d" }}>
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 500, height: 500, borderRadius: "50%", background: isAnomaly ? "radial-gradient(circle, rgba(255,92,53,0.08) 0%, transparent 60%)" : "radial-gradient(circle, rgba(110,231,255,0.05) 0%, transparent 60%)" }} />

        <motion.div className="w-full max-w-sm text-center space-y-8 relative z-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>

          {/* Prediction-confirmation header */}
          {confirmationMsg && (
            <motion.p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              {confirmationMsg}
            </motion.p>
          )}

          {/* Blurred metric tease — reveals on stagger */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "HRV", value: hrvDisplay, unit: "ms", color: "#6EE7FF", delay: 0.4 },
              { label: "Readiness", value: readinessDisplay, unit: "", color: "#C2FF4A", delay: 0.7 },
              { label: "Sleep", value: sleepDisplay, unit: "", color: "#A78BFA", delay: 1.0 },
            ].map(m => (
              <motion.div key={m.label} className="rounded-2xl p-4 relative overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                initial={{ opacity: 0, filter: "blur(16px)", scale: 0.9 }}
                animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                transition={{ delay: m.delay, duration: 0.6, ease }}>
                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none" style={{ background: `radial-gradient(circle at 100% 0%, ${m.color}10, transparent 70%)` }} />
                <p className="text-[9px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: `${m.color}80` }}>{m.label}</p>
                <p className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{m.value}</p>
                {m.unit && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{m.unit}</span>}
              </motion.div>
            ))}
          </div>

          {/* Fusion insight (if available) */}
          {fusion && (
            <motion.div className="rounded-xl p-4 text-left" style={{ background: "rgba(110,231,255,0.04)", border: "1px solid rgba(110,231,255,0.1)" }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{fusion.message}</p>
            </motion.div>
          )}

          {/* Curiosity gap tease + CTA */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
            <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {isAnomaly
                ? "Something shifted in your overnight recovery."
                : "Within your normal range. Ready to move."}
            </p>
            <motion.button
              onClick={() => setPhase("action")}
              className="px-8 py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2 mx-auto"
              style={{
                background: isAnomaly ? "linear-gradient(135deg, #FF5C35, #FF8040)" : "rgba(255,255,255,0.06)",
                color: isAnomaly ? "#fff" : "#94A3B8",
                boxShadow: isAnomaly ? "0 8px 32px rgba(255,92,53,0.25)" : "none",
              }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Eye className="w-4 h-4" />
              {isAnomaly ? "Reveal your plan" : "See today's plan"}
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── PHASE 3: ACTION (the main /today content) ──
  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto" style={{ background: "#0a0b0d" }}>

      {/* BODY CONTEXT — individual baselines with EWMA-style range */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Your body right now</p>
          {confirmationMsg && (
            <motion.p className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{
              background: bodyAgrees ? "rgba(194,255,74,0.08)" : "rgba(255,195,107,0.08)",
              color: bodyAgrees ? "#C2FF4A" : "#FFC36B",
            }} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              {bodyAgrees ? "Body confirms" : "Mismatch detected"}
            </motion.p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "HRV", value: body.hrv ? `${body.hrv}` : "--", unit: "ms", baseline: body.hrv_baseline ? Math.round(body.hrv_baseline) : null, color: "#6EE7FF", delta: body.hrv && body.hrv_baseline ? body.hrv - body.hrv_baseline : null },
            { label: "Readiness", value: body.readiness || "--", unit: "", baseline: null, color: "#C2FF4A", delta: null },
            { label: "Sleep", value: body.sleep_score || "--", unit: "", baseline: null, color: "#A78BFA", delta: null },
            { label: "Stress", value: body.stress_min != null ? `${body.stress_min}` : "--", unit: "min", baseline: null, color: "#FF5D6C", delta: null },
          ].map((m, i) => (
            <motion.div key={m.label} className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, ease }}>
              {/* Subtle color glow */}
              <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none" style={{ background: `radial-gradient(circle at 100% 0%, ${m.color}08, transparent 70%)` }} />
              <p className="text-[9px] uppercase tracking-[0.15em] font-bold mb-2" style={{ color: `${m.color}80` }}>{m.label}</p>
              <div className="flex items-baseline gap-1">
                <p className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>{m.value}</p>
                {m.unit && <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>{m.unit}</span>}
              </div>
              {/* Individual baseline band (EWMA) */}
              {m.baseline != null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full relative overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="absolute inset-y-0 rounded-full" style={{
                      background: `${m.color}25`,
                      left: `${Math.max(0, Math.min(100, ((m.baseline - 15) / (m.baseline + 15)) * 100))}%`,
                      right: `${Math.max(0, 100 - Math.min(100, ((m.baseline + 15) / (m.baseline + 15)) * 100))}%`,
                    }} />
                    {/* Current position dot */}
                    {body.hrv && (
                      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{
                        background: m.color,
                        left: `${Math.max(2, Math.min(95, ((Number(m.value) || 0) / ((m.baseline || 50) * 2)) * 100))}%`,
                        boxShadow: `0 0 6px ${m.color}60`,
                      }} />
                    )}
                  </div>
                  <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>~{m.baseline}</span>
                </div>
              )}
              {m.delta != null && m.delta !== 0 && (
                <p className="text-[10px] font-bold mt-1.5" style={{ color: m.delta > 0 ? "#C2FF4A" : "#FF5D6C" }}>
                  {m.delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(m.delta))} vs your baseline
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ANOMALY ALERT — behavior-triggered, not scheduled */}
      {isAnomaly && body.hrv && body.hrv_baseline && (
        <motion.div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
          style={{ background: "rgba(255,92,53,0.06)", border: "1px solid rgba(255,92,53,0.15)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, ease }}>
          <div className="absolute top-0 left-0 w-full h-1" style={{ background: "linear-gradient(90deg, #FF5C35, #FF8040)" }} />
          <div className="flex items-center gap-2 mb-2 mt-1">
            <AlertTriangle className="w-4 h-4" style={{ color: "#FF5C35" }} />
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#FF5C35" }}>Anomaly detected</p>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Your HRV ({body.hrv}ms) deviated significantly from your personal baseline (~{Math.round(body.hrv_baseline)}ms).
            {body.hrv < body.hrv_baseline
              ? " Your autonomic system is under more load than usual. Today's session has been auto-adjusted."
              : " Your recovery capacity is elevated. The system may push harder today."}
          </p>
        </motion.div>
      )}

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
                  const blockColors: Record<string,string> = { warmup: "#FFC36B", strength: "#FF5C35", metcon: "#6EE7FF", workout: "#FF5C35", cooldown: "#A78BFA" };
                  const bc = blockColors[bk] || color;
                  return (
                    <div key={bk} className="rounded-xl p-4 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${bc}40` }}>
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: `${bc}90` }}>
                        {bk}{block.sets ? ` · ${block.sets} sets` : ""}{block.rounds ? ` · ${block.rounds} rounds` : ""}
                      </p>
                      <div className="space-y-2">
                        {block.movements.map((m: any, i: number) => {
                          const name = typeof m === "object" ? (m.movement_name || m.name || "") : String(m);
                          const reps = typeof m === "object" ? (m.reps || "") : "";
                          const load = typeof m === "object" ? (m.load || "") : "";
                          return (
                            <div key={i} className="flex items-baseline gap-2 pl-1">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: `${bc}50` }} />
                              <div>
                                <p className="text-sm font-semibold text-white">{name}</p>
                                {(reps || load) && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{reps}{load ? ` · ${load}` : ""}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {block.rest && <p className="text-[10px] mt-3 pt-2" style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>Rest: {block.rest}</p>}
                      {block.time_cap && <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Time Cap: {block.time_cap}{typeof block.time_cap === "number" ? " min" : ""}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* START SESSION */}
            {!feedback && (
              <button onClick={() => setSessionActive(true)}
                className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 mb-2 transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.25)" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(255,92,53,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(255,92,53,0.25)"; }}>
                <Zap className="w-4 h-4 inline mr-2" /> Start Session
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
        <motion.div className="rounded-2xl p-6 mb-4 text-center relative overflow-hidden"
          style={{ background: feedback === "yes" ? "rgba(194,255,74,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${feedback === "yes" ? "rgba(194,255,74,0.12)" : "rgba(255,255,255,0.06)"}` }}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease }}>
          {feedback === "yes" && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 30%, rgba(194,255,74,0.06) 0%, transparent 60%)" }} />
          )}
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: feedback === "yes" ? "rgba(194,255,74,0.12)" : "rgba(255,255,255,0.06)" }}>
              <Check className="w-6 h-6" style={{ color: feedback === "yes" ? "#C2FF4A" : "#94A3B8" }} />
            </div>
            <p className="text-sm font-bold text-white mb-1">
              {feedback === "yes" ? "Work logged." : feedback === "partial" ? "Partial effort — adaptation still happens." : "Strategic rest. Recovery is training."}
            </p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {feedback === "yes" ? "Tomorrow's capacity adjusts based on today's output." : "The system recalibrates. Nothing is wasted."}
            </p>
          </div>
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
              return <p className="text-xs" style={{ color: "rgba(194,255,74,0.6)" }}>Adaptation signal: HRV up {slope}ms/week. Your capacity is expanding.</p>;
            }
            if (dir === "declining") {
              return <p className="text-xs" style={{ color: "rgba(255,93,108,0.5)" }}>HRV trending down {Math.abs(slope)}ms/week. Load auto-adjusting to protect gains.</p>;
            }
            // Flat or mild — silence. Premium apps don't fill space with noise.
            return null;
          })()}
        </motion.div>
      )}
    </div>
  );
}
