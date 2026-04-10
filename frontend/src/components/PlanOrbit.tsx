import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Calendar, Moon, Heart, Dumbbell, Brain, Zap, MapPin, Coffee, Flame, Sparkles, ChevronRight, Activity, Send, MessageCircle, Target, ArrowRight, Check, Clock, Beaker } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API = typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : "http://localhost:8000";

const ICON_MAP: Record<string, any> = {
  sunrise: Zap, dumbbell: Dumbbell, shield: Heart, coffee: Coffee, moon: Moon,
  wind: Moon, thermometer: Flame, bed: Moon, utensils: Coffee, heart: Heart,
  target: Target, calendar: Calendar, "alert-triangle": Flame, circle: Sparkles,
  clock: Clock, activity: Activity,
};
const COLOR_MAP: Record<string, string> = {
  amber: "#FBBF24", blue: "#3B82F6", green: "#4ADE80", purple: "#8B5CF6",
  red: "#F87171", gray: "#94A3B8", indigo: "#818CF8",
};

type Props = { todayData: any; calendarEvents: any[]; stats: any; sleepHistory?: any[]; stressData?: any[] };

export default function PlanOrbit({ todayData, calendarEvents, stats, sleepHistory = [], stressData = [] }: Props) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "goal" | "plan">("idle");
  const [scanStep, setScanStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [selectedDay, setSelectedDay] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [aiWorkout, setAiWorkout] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [workoutFeedback, setWorkoutFeedback] = useState<string | null>(null); // yes / partial / no
  const [workoutBacklog, setWorkoutBacklog] = useState<any[]>([]);
  const [showBacklog, setShowBacklog] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [loggedSets, setLoggedSets] = useState<Record<string, any>>({});
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [logForm, setLogForm] = useState<{ reps: string; load: string; rpe: number }>({ reps: "", load: "", rpe: 7 });
  // In-session mode
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionMovIdx, setSessionMovIdx] = useState(0);
  const [sessionSetNum, setSessionSetNum] = useState(1);
  const [restTimer, setRestTimer] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const restRef = useRef<any>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "yu"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [fullDay, setFullDay] = useState<any>(null);
  const [fullDayLoading, setFullDayLoading] = useState(false);
  const [experimentsDone, setExperimentsDone] = useState<Record<string, boolean | null>>({});
  const [shareStatus, setShareStatus] = useState<"idle" | "sending" | "sent" | "copied">("idle");

  // Fetch full-day plan when entering plan phase
  useEffect(() => {
    if (phase === "plan" && !fullDay && !fullDayLoading) {
      setFullDayLoading(true);
      fetch(`${API}/api/optimize/full-day?mood=balanced`)
        .then(r => r.json())
        .then(d => { setFullDay(d); setFullDayLoading(false); })
        .catch(() => setFullDayLoading(false));
    }
  }, [phase]);

  const readiness = todayData?.readinessScore ?? 70;
  const sleepScore = todayData?.sleepScore ?? 70;
  const stressMin = todayData?.stressMin ?? 0;
  const hrv = todayData?.hrv ?? "--";
  const rColor = readiness >= 75 ? "#4ADE80" : readiness >= 60 ? "#FBBF24" : "#F87171";
  const ringCirc = 2 * Math.PI * 128;

  const sendChat = async (msg?: string) => {
    const text = msg || chatInput.trim();
    if (!text || chatSending) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text }]);
    setChatSending(true);
    try {
      const resp = await fetch(`${API}/api/calendar/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text + (goal ? ` (My goal: ${goal})` : "") + (aiWorkout ? ` (Current planned workout: ${aiWorkout.title || aiWorkout.session_name || workoutType}, ${aiWorkout.duration_min || 30}min. Movements: ${JSON.stringify(aiWorkout.main_set?.movements || aiWorkout.workout?.movements || []).slice(0, 300)})` : ""),
          biometrics: `Sleep: ${sleepScore}, Readiness: ${readiness}, HRV: ${hrv} ms, Stress: ${stressMin} min`,
        }),
      });
      const data = await resp.json();
      setChatMessages(prev => [...prev, { role: "yu", text: data.reply || "Could not respond." }]);
    } catch { setChatMessages(prev => [...prev, { role: "yu", text: "Connection error." }]); }
    setChatSending(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const loadWorkout = (type: string) => {
    setWorkoutType(type);
    setAiLoading(true);
    setWorkoutFeedback(null);
    fetch(`${API}/api/oura/workout?session_type=${type}`)
      .then(r => r.json())
      .then((w) => {
        setAiWorkout(w);
        setWorkoutLogId(w?.log_id || null);
        loadBacklog();
      })
      .catch(() => setAiWorkout({ error: true }))
      .finally(() => setAiLoading(false));
  };

  const loadBacklog = () => {
    fetch(`${API}/api/oura/workout/log?days=7`)
      .then(r => r.json())
      .then(d => setWorkoutBacklog((d?.entries || []).slice().reverse()))
      .catch(() => {});
  };

  const regenerateWorkout = async () => {
    if (!workoutLogId || regenLoading) return;
    setRegenLoading(true);
    try {
      const resp = await fetch(`${API}/api/oura/workout/regenerate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: workoutLogId, session_type: workoutType || "crossfit", reason: "user_requested_alternative" }),
      });
      const data = await resp.json();
      if (data && !data.error) {
        setAiWorkout(data);
        setWorkoutLogId(data?.log_id || null);
        setWorkoutFeedback(null);
        loadBacklog();
      } else {
        setAiWorkout({ error: true });
      }
    } catch { setAiWorkout({ error: true }); }
    finally { setRegenLoading(false); }
  };

  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const [skipNote, setSkipNote] = useState("");
  const [selectedSkipReason, setSelectedSkipReason] = useState<string | null>(null);

  const sendWorkoutFeedback = async (completed: "yes" | "partial" | "no", skipReason?: string) => {
    if (!workoutLogId) return;
    setWorkoutFeedback(completed);
    setShowSkipReasons(false);
    setSelectedSkipReason(null);
    try {
      await fetch(`${API}/api/oura/workout/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: workoutLogId, completed, skip_reason: skipReason || null, notes: skipNote || null }),
      });
      setSkipNote("");
      loadBacklog();
    } catch {}
  };

  // All movements across all blocks for session mode
  const getAllMovements = () => {
    if (!aiWorkout) return [];
    const all: any[] = [];
    for (const bk of ["warmup", "strength", "metcon", "workout", "cooldown"]) {
      const block = aiWorkout[bk];
      if (!block?.movements) continue;
      for (const m of block.movements) {
        const name = typeof m === "object" ? (m.movement_name || m.name || "") : String(m);
        const reps = typeof m === "object" ? (m.reps || "") : "";
        const load = typeof m === "object" ? (m.load || "") : "";
        all.push({ name, reps, load, block: bk, raw: m });
      }
    }
    return all;
  };

  const startSession = () => {
    setSessionActive(true);
    setSessionMovIdx(0);
    setSessionSetNum(1);
    setRestTimer(0);
    setRestRunning(false);
    setLogForm({ reps: "", load: "", rpe: 7 });
  };

  const playBeep = (freq: number = 880, dur: number = 150) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + dur / 1000);
    } catch {}
    try { navigator.vibrate?.(200); } catch {}
  };

  const startRest = (seconds: number = 90) => {
    setRestTimer(seconds);
    setRestRunning(true);
    if (restRef.current) clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          clearInterval(restRef.current);
          setRestRunning(false);
          playBeep(1046, 300); // C6 — rest over
          try { navigator.vibrate?.([200, 100, 200]); } catch {}
          return 0;
        }
        if (prev <= 4) playBeep(660, 80); // countdown beep at 3, 2, 1
        return prev - 1;
      });
    }, 1000);
  };

  const endSession = () => {
    setSessionActive(false);
    if (restRef.current) clearInterval(restRef.current);
    setRestRunning(false);
  };

  const logSet = async (movementName: string) => {
    if (!workoutLogId) return;
    const setNum = Object.keys(loggedSets).filter(k => k.startsWith(movementName + "_")).length + 1;
    const key = `${movementName}_s${setNum}`;
    try {
      await fetch(`${API}/api/oura/workout/rpe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_id: workoutLogId,
          movement_name: movementName,
          set_number: setNum,
          reps_actual: logForm.reps || null,
          load_actual: logForm.load || null,
          rpe: logForm.rpe,
        }),
      });
      setLoggedSets(prev => ({ ...prev, [key]: { reps: logForm.reps, load: logForm.load, rpe: logForm.rpe } }));
      setActiveLog(null);
      setLogForm({ reps: "", load: "", rpe: 7 });
    } catch {}
  };

  // On mount: restore today's workout if it exists, and load the backlog
  useEffect(() => {
    fetch(`${API}/api/oura/workout/today`)
      .then(r => r.json())
      .then((d) => {
        const e = d?.workout;
        if (e?.full_workout) {
          setWorkoutType(e.session_type || "crossfit");
          setAiWorkout(e.full_workout);
          setWorkoutLogId(e.id);
          if (e.user_feedback?.completed) setWorkoutFeedback(e.user_feedback.completed);
        }
      })
      .catch(() => {});
    loadBacklog();
  }, []);

  const scanSources = [
    { label: "Oura Ring", detail: `Sleep ${sleepScore} · HRV ${hrv}ms · Readiness ${readiness}`, icon: Brain, color: "#A78BFA" },
    { label: "iCloud Calendar", detail: `${calendarEvents.length} events this week`, icon: Calendar, color: "#3B82F6" },
    { label: "Workout history", detail: "Recovery-aware programming", icon: Dumbbell, color: "#F87171" },
    { label: "Gemini 2.5 Pro", detail: "Building your personalized plan", icon: Sparkles, color: "#4ADE80" },
  ];

  const handlePlan = () => {
    if (phase !== "idle") return;
    setPhase("scanning"); setScanStep(0);
    setGoal("Crush my week");
    let step = 0;
    const iv = setInterval(() => { step++; setScanStep(step); if (step >= scanSources.length) { clearInterval(iv); setTimeout(() => setPhase("plan"), 600); } }, 500);
  };

  const goals = [
    { label: "Crush my week", desc: "Peak performance mode", icon: Zap, color: "#F87171" },
    { label: "Stay balanced", desc: "Productive but sustainable", icon: Heart, color: "#4ADE80" },
    { label: "Recover hard", desc: "I'm running on empty", icon: Moon, color: "#818CF8" },
  ];

  // Chart data
  const last14 = sleepHistory.slice(-14).map((d: any) => ({ ...d, label: new Date(d.day + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
  const stressChart = stressData.slice(-14).map((d: any) => ({ ...d, label: new Date(d.day + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));

  const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (<div className="rounded-lg bg-[#0a0e27]/95 backdrop-blur px-3 py-2 border border-white/10 shadow-xl">
      <p className="text-[9px] text-slate-500">{label}</p>
      {payload.map((p: any, i: number) => <p key={i} className="text-[11px] font-bold" style={{ color: p.color }}>{p.name}: {Math.round(p.value)}</p>)}
    </div>);
  };

  // Plan sections
  const todayEvents = calendarEvents.filter(e => {
    const sd = e.start?.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const tmrw = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return sd === today || sd === tmrw;
  });

  return (
    <div>
      <style>{`@keyframes ring-glow { 0%,100% { filter: drop-shadow(0 0 8px ${rColor}30); } 50% { filter: drop-shadow(0 0 25px ${rColor}60); } }`}</style>

      <div className="flex flex-col items-center">
        <AnimatePresence mode="wait">

          {/* ═══ IDLE ═══ */}
          {phase === "idle" && (
            <motion.div key="idle" className="flex flex-col items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <div className="relative cursor-pointer mb-4" onClick={handlePlan}>
                <div className="absolute -inset-10 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${rColor}08 0%, transparent 70%)`, animation: "ring-glow 3s ease-in-out infinite" }} />
                {[0, 0.8].map(d => <motion.div key={d} className="absolute -inset-3 rounded-full border pointer-events-none" style={{ borderColor: `${rColor}06` }} animate={{ scale: [1, 1.25], opacity: [0.3, 0] }} transition={{ duration: 3, repeat: Infinity, delay: d }} />)}
                <svg viewBox="0 0 270 270" className="absolute -inset-[3px] w-full h-full" style={{ animation: "ring-glow 3s ease-in-out infinite", transform: "rotate(-90deg)" }}>
                  <circle cx={135} cy={135} r={128} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={6} />
                  <motion.circle cx={135} cy={135} r={128} fill="none" stroke={rColor} strokeWidth={6} strokeLinecap="round" strokeDasharray={ringCirc}
                    initial={{ strokeDashoffset: ringCirc }} animate={{ strokeDashoffset: ringCirc * (1 - readiness / 100) }} transition={{ duration: 2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }} />
                  <motion.circle cx={135} cy={135} r={128} fill="none" stroke={rColor} strokeWidth={3} strokeLinecap="round" strokeOpacity={0.4} strokeDasharray={ringCirc}
                    initial={{ strokeDashoffset: ringCirc }} animate={{ strokeDashoffset: ringCirc * (1 - readiness / 100) }} transition={{ duration: 2, delay: 0.5 }} style={{ filter: "blur(6px)" }} />
                </svg>
                <motion.div className="w-[180px] h-[180px] md:w-[264px] md:h-[264px] rounded-full overflow-hidden relative" style={{ border: `3px solid ${rColor}20`, boxShadow: `0 0 50px rgba(0,0,0,0.4), 0 0 30px ${rColor}08` }}
                  whileHover={{ scale: 1.03, borderColor: `${rColor}40` }} whileTap={{ scale: 0.97 }}>
                  <img src="/me.png" alt="You" className="w-full h-full object-cover" style={{ filter: "brightness(0.85) contrast(1.1)" }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4) 100%)" }} />
                </motion.div>
                <motion.div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full" style={{ background: `${rColor}12`, border: `1.5px solid ${rColor}25`, backdropFilter: "blur(16px)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
                  <span className="text-lg font-black" style={{ color: rColor }}>{readiness}</span>
                  <span className="text-[10px] text-slate-400 ml-1">ready</span>
                </motion.div>
              </div>
              <motion.div className="text-center mt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <motion.button className="px-10 py-4 md:px-14 md:py-5 rounded-2xl cursor-pointer border-0" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))", border: "1.5px solid rgba(59,130,246,0.15)" }}
                  whileHover={{ scale: 1.04, boxShadow: "0 0 50px rgba(59,130,246,0.15)" }} whileTap={{ scale: 0.97 }} onClick={handlePlan}
                  animate={{ boxShadow: ["0 0 15px rgba(59,130,246,0.05)", "0 0 35px rgba(59,130,246,0.1)", "0 0 15px rgba(59,130,246,0.05)"] }} transition={{ boxShadow: { duration: 3, repeat: Infinity } }}>
                  <span className="text-lg md:text-xl font-black text-white">Plan my day</span>
                </motion.button>
                <div className="flex items-center justify-center gap-3 md:gap-4 mt-4 flex-wrap">
                  {[{ icon: Brain, l: "Oura Ring", c: "#A78BFA" }, { icon: Calendar, l: "Calendar", c: "#3B82F6" }, { icon: Sparkles, l: "Gemini AI", c: "#4ADE80" }].map(s => (
                    <div key={s.l} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${s.c}06`, border: `1px solid ${s.c}08` }}>
                      <s.icon className="w-3 h-3" style={{ color: s.c, opacity: 0.6 }} />
                      <span className="text-[9px] md:text-[10px] font-semibold" style={{ color: `${s.c}60` }}>{s.l}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ SCANNING — WOW EFFECT ═══ */}
          {phase === "scanning" && (
            <motion.div key="scan" className="flex flex-col items-center w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>

              {/* Center photo with orbiting source icons */}
              <div className="relative mb-6" style={{ width: 280, height: 280 }}>
                {/* Expanding pulse rings */}
                {[0, 0.6, 1.2].map(d => (
                  <motion.div key={d} className="absolute rounded-full" style={{ inset: 20, border: "1px solid rgba(59,130,246,0.08)" }}
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: d, ease: "easeOut" }} />
                ))}

                {/* Spinning outer ring */}
                <motion.svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 280"
                  animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <circle cx={140} cy={140} r={130} fill="none" stroke="rgba(59,130,246,0.08)" strokeWidth={1.5} strokeDasharray="6 14" />
                  <circle cx={140} cy={140} r={110} fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth={1} strokeDasharray="4 12" />
                </motion.svg>

                {/* Source icons orbiting around photo */}
                {scanSources.map((src, i) => {
                  const angle = (i / scanSources.length) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const orbitR = 120;
                  const x = 140 + Math.cos(rad) * orbitR;
                  const y = 140 + Math.sin(rad) * orbitR;
                  const isDone = scanStep > i;
                  const isActive = scanStep === i;

                  return (
                    <motion.div key={src.label} className="absolute" style={{ left: x - 20, top: y - 20 }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: isDone || isActive ? 1 : 0.3, scale: isDone || isActive ? 1 : 0.7 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}>

                      {/* Connection line to center */}
                      {isDone && (
                        <motion.svg className="absolute" style={{ left: 20, top: 20, width: 1, height: 1, overflow: "visible", zIndex: 0 }}>
                          <motion.line x1={0} y1={0} x2={140 - x} y2={140 - y}
                            stroke={src.color} strokeWidth={1.5} strokeOpacity={0.3}
                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                        </motion.svg>
                      )}

                      <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center relative z-10"
                        style={{
                          background: isDone ? `${src.color}15` : isActive ? `${src.color}10` : "rgba(255,255,255,0.03)",
                          border: `1.5px solid ${isDone ? src.color + "40" : isActive ? src.color + "30" : "rgba(255,255,255,0.05)"}`,
                          boxShadow: isDone ? `0 0 20px ${src.color}20` : "none",
                        }}
                        animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                        transition={isActive ? { duration: 0.6, repeat: Infinity } : {}}>
                        {isActive ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                            <src.icon className="w-4.5 h-4.5" style={{ color: src.color }} />
                          </motion.div>
                        ) : isDone ? (
                          <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400 }}>
                            <Zap className="w-4 h-4 text-emerald-400" />
                          </motion.div>
                        ) : (
                          <src.icon className="w-4 h-4" style={{ color: src.color, opacity: 0.3 }} />
                        )}
                      </motion.div>

                      {/* Label */}
                      <motion.p className="text-center text-[8px] font-bold uppercase tracking-wider mt-1 whitespace-nowrap"
                        style={{ color: isDone ? src.color : isActive ? src.color : "rgba(255,255,255,0.15)" }}
                        animate={isDone ? { opacity: 1 } : {}}>
                        {isDone ? "Done" : src.label.split(" ")[0]}
                      </motion.p>
                    </motion.div>
                  );
                })}

                {/* Center photo */}
                <motion.div className="absolute rounded-full overflow-hidden"
                  style={{ left: 90, top: 90, width: 100, height: 100, border: "2px solid rgba(59,130,246,0.3)", boxShadow: "0 0 50px rgba(59,130,246,0.15)" }}
                  initial={{ scale: 2 }} animate={{ scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  <img src="/me.png" alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.75)" }} />
                  <motion.div className="absolute inset-0" style={{ background: "rgba(59,130,246,0.08)" }}
                    animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                </motion.div>
              </div>

              {/* Status text */}
              <AnimatePresence mode="wait">
                <motion.div key={scanStep} className="text-center mb-3" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.3 }}>
                  {scanStep < scanSources.length ? (
                    <>
                      <p className="text-lg font-black text-white">{scanSources[scanStep]?.label}</p>
                      <p className="text-xs" style={{ color: scanSources[scanStep]?.color }}>{scanSources[scanStep]?.detail}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-black text-emerald-400">All connected</p>
                      <p className="text-xs text-slate-500">Building your plan...</p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${scanSources.map(s => s.color).join(", ")})` }}
                  animate={{ width: `${(scanStep / scanSources.length) * 100}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
              </div>
            </motion.div>
          )}

          {/* ═══ GOAL ═══ */}
          {phase === "goal" && (
            <motion.div key="goal" className="flex flex-col items-center w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Sparkles className="w-10 h-10 text-emerald-400 mb-4" />
              <h2 className="text-3xl font-black text-white mb-2">What's the vibe?</h2>
              <p className="text-base text-slate-400 mb-8">This shapes your entire week.</p>
              <div className="space-y-3 w-full">
                {goals.map(g => (
                  <motion.button key={g.label} className="w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer border-0 text-left"
                    style={{ background: `${g.color}06`, border: `1.5px solid ${g.color}15` }}
                    whileHover={{ scale: 1.02, borderColor: `${g.color}30` }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setGoal(g.label); setPhase("plan"); }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${g.color}12` }}>
                      <g.icon className="w-7 h-7" style={{ color: g.color }} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-white">{g.label}</p>
                      <p className="text-sm text-slate-400">{g.desc}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-700 ml-auto" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ PLAN ═══ */}
          {phase === "plan" && (() => {
            const timeline = fullDay?.timeline || [];
            const heroData = fullDay?.hero || {};
            const sleepExperiments = fullDay?.sleep_experiments || [];
            const workoutStatus = fullDay?.workout_status || {};
            const kpis = fullDay?.kpis || [];

            // Only calendar events
            const calendarItems = timeline.filter((t: any) => t.source === "calendar");

            // Helper to format 24h time to readable
            const fmt = (t: string) => {
              if (!t) return "";
              const [h, m] = t.split(":").map(Number);
              const ampm = h >= 12 ? "PM" : "AM";
              return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
            };

            return (
            <motion.div key="plan" className="w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

              {/* ═══════ IN-SESSION MODE (full-screen overlay) ═══════ */}
              {sessionActive && (() => {
                const allMovs = getAllMovements();
                const current = allMovs[sessionMovIdx];
                const total = allMovs.length;
                const setsLogged = current ? Object.keys(loggedSets).filter(k => k.startsWith(current.name + "_")).length : 0;
                const progress = total > 0 ? Math.round(((sessionMovIdx) / total) * 100) : 0;

                return (
                  <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0b0d" }}>
                    {/* Top bar */}
                    <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <button onClick={endSession} className="text-xs text-slate-500 cursor-pointer border-0 bg-transparent">Exit Session</button>
                      <p className="text-xs text-slate-400">{sessionMovIdx + 1} / {total}</p>
                      <p className="text-xs text-slate-500">{aiWorkout?.title}</p>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: "#FF5C35" }} />
                    </div>

                    {/* Current movement */}
                    {current ? (
                      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
                        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "rgba(255,92,53,0.6)" }}>{current.block}</p>
                        <div className="text-center">
                          {current.reps && <p className="text-5xl font-black text-white mb-2">{current.reps}</p>}
                          <p className="text-xl font-bold text-white">{current.name}</p>
                          {current.load && <p className="text-sm text-slate-400 mt-1">{current.load}</p>}
                        </div>
                        <p className="text-xs text-slate-500">Set {sessionSetNum} {setsLogged > 0 ? `(${setsLogged} logged)` : ""}</p>

                        {/* Rest timer */}
                        {restRunning && (
                          <div className="text-center">
                            <p className="text-4xl font-black" style={{ color: restTimer <= 10 ? "#FF5C35" : "#6EE7FF" }}>{restTimer}s</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Rest</p>
                          </div>
                        )}

                        {/* RPE input */}
                        {!restRunning && (
                          <div className="w-full max-w-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">RPE</span>
                              <div className="flex items-center gap-2">
                                <input type="range" min={1} max={10} value={logForm.rpe}
                                  onChange={e => setLogForm(f => ({ ...f, rpe: Number(e.target.value) }))}
                                  className="w-32 h-1 accent-orange-500" />
                                <span className="text-sm font-bold w-6 text-center" style={{ color: logForm.rpe >= 9 ? "#FF5C35" : logForm.rpe >= 7 ? "#FBBF24" : "#C2FF4A" }}>{logForm.rpe}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <input type="text" placeholder="Reps" value={logForm.reps || current.reps}
                                onChange={e => setLogForm(f => ({ ...f, reps: e.target.value }))}
                                className="flex-1 text-sm px-3 py-2 rounded-lg bg-transparent text-white text-center"
                                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                              <input type="text" placeholder="Load" value={logForm.load || current.load}
                                onChange={e => setLogForm(f => ({ ...f, load: e.target.value }))}
                                className="flex-1 text-sm px-3 py-2 rounded-lg bg-transparent text-white text-center"
                                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                            </div>

                            {/* Log + Rest button */}
                            <button
                              onClick={async () => {
                                await logSet(current.name);
                                setSessionSetNum(prev => prev + 1);
                                startRest(90);
                              }}
                              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0"
                              style={{ background: "#FF5C35", color: "#fff" }}>
                              Log Set + Rest 90s
                            </button>

                            {/* Navigation */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setSessionMovIdx(Math.max(0, sessionMovIdx - 1)); setSessionSetNum(1); setLogForm({ reps: "", load: "", rpe: 7 }); }}
                                disabled={sessionMovIdx === 0}
                                className="flex-1 py-2 rounded-lg text-xs cursor-pointer border-0"
                                style={{ background: "rgba(255,255,255,0.04)", color: sessionMovIdx === 0 ? "#333" : "#94A3B8" }}>
                                Prev
                              </button>
                              <button
                                onClick={() => {
                                  if (sessionMovIdx >= total - 1) { endSession(); sendWorkoutFeedback("yes"); return; }
                                  setSessionMovIdx(sessionMovIdx + 1); setSessionSetNum(1); setLogForm({ reps: "", load: "", rpe: 7 });
                                  if (restRef.current) clearInterval(restRef.current);
                                  setRestRunning(false); setRestTimer(0);
                                }}
                                className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer border-0"
                                style={{ background: sessionMovIdx >= total - 1 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", color: sessionMovIdx >= total - 1 ? "#C2FF4A" : "#A5B4FC" }}>
                                {sessionMovIdx >= total - 1 ? "Finish Workout" : "Next Movement"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Skip rest */}
                        {restRunning && (
                          <button onClick={() => { clearInterval(restRef.current); setRestRunning(false); setRestTimer(0); }}
                            className="text-xs text-slate-500 cursor-pointer border-0 bg-transparent">
                            Skip rest
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-slate-400">No movements found</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {fullDayLoading ? (
                <div className="flex flex-col items-center py-20 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Sparkles className="w-8 h-8 text-emerald-400" /></motion.div>
                  <p className="text-sm text-slate-400">Building your day from Oura + Calendar data...</p>
                </div>
              ) : (
              <>
              {/* Header */}
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden relative flex-shrink-0" style={{ border: `2.5px solid ${rColor}30` }}>
                  <img src="/me.png" alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.85)" }} />
                  <svg className="absolute inset-0" viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={24} cy={24} r={21} fill="none" stroke={rColor} strokeWidth={2.5} strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 21} strokeDashoffset={2 * Math.PI * 21 * (1 - readiness / 100)} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-black text-white truncate">{heroData.headline || "Your day"}</h2>
                  <p className="text-[10px] md:text-xs text-slate-500">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                </div>
                <button onClick={() => { setPhase("idle"); setActiveSection(null); setWorkoutType(null); setAiWorkout(null); setSelectedDay(0); setFullDay(null); setExperimentsDone({}); }}
                  className="text-[10px] md:text-xs text-slate-600 cursor-pointer border-0 bg-transparent hover:text-slate-400 px-2 py-1 md:px-3 md:py-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.02)" }}>Reset</button>
              </div>

              {/* TWO COLUMN LAYOUT */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">

                {/* LEFT */}
                <div className="space-y-3">

                  {/* Biometric bar - compact */}
                  <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                    {[
                      { icon: Moon, label: "Sleep", value: sleepScore, color: "#818CF8" },
                      { icon: Heart, label: "Ready", value: readiness, color: "#4ADE80" },
                      { icon: Brain, label: "HRV", value: hrv, color: "#A78BFA" },
                      { icon: Flame, label: "Stress", value: stressMin, color: "#FBBF24" },
                    ].map(m => (
                      <div key={m.label} className="rounded-xl p-2 md:p-2.5 text-center" style={{ background: `${m.color}06`, border: `1px solid ${m.color}10` }}>
                        <p className="text-xl md:text-2xl font-black text-white leading-none">{m.value}</p>
                        <p className="text-[7px] md:text-[8px] font-bold uppercase mt-0.5" style={{ color: `${m.color}70` }}>{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* TODAY'S MOVEMENT — only show as 'workout' if it crosses the
                       intensity threshold. Light walks (<10 min, <80 cal,
                       activity=walking) count as movement, not the session. */}
                  {(() => {
                    if (!workoutStatus.worked_out) return null;
                    const act = (workoutStatus.activity || "").toLowerCase();
                    const dur = workoutStatus.duration_min || 0;
                    const cal = workoutStatus.calories || 0;
                    const isLightWalk = act.includes("walk") && (dur < 10 || cal < 80);
                    if (isLightWalk) {
                      return (
                        <motion.div className="rounded-2xl p-3" style={{ background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                          <p className="text-[11px] text-slate-500">
                            <span className="text-slate-400">Movement so far today:</span> {(workoutStatus.activity || "").replace(/([A-Z])/g, " $1").trim()}
                            {dur > 0 && ` · ${dur}min`}{cal > 0 && ` · ${Math.round(cal)} cal`}
                            <span className="text-slate-600"> — not your main session</span>
                          </p>
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div className="rounded-2xl p-4" style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.1)" }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-emerald-400" />
                          <h3 className="text-base font-black text-white">Today's workout</h3>
                          <span className="text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ml-auto" style={{ background: "rgba(74,222,128,.1)", color: "#4ADE80" }}>Done</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                          {(workoutStatus.activity || "").replace(/([A-Z])/g, " $1").trim()}
                          {dur > 0 && ` · ${dur}min`}
                          {cal > 0 && ` · ${Math.round(cal)} cal`}
                        </p>
                      </motion.div>
                    );
                  })()}

                  {/* YOUR NEXT SESSION — generated from live data, refreshable */}
                  <motion.div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "rgba(248,113,113,0.04)", border: "1.5px solid rgba(248,113,113,0.12)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Dumbbell className="w-5 h-5 text-red-400" />
                      <h3 className="text-lg font-black text-white">Your next session</h3>
                    </div>
                    <p className="text-[11px] md:text-xs text-slate-500 mb-4">Built from your data right now. Tap <span className="text-slate-300 font-semibold">Refresh from current data</span> right before you start so the AI uses your freshest readiness.</p>

                  {(() => {
                  const recType = readiness >= 75 ? "crossfit" : readiness >= 60 ? "yoga" : "rest";
                  const recWhy = readiness >= 75
                    ? `Readiness ${readiness}, HRV ${hrv}ms. Body is primed for intensity tomorrow.`
                    : readiness >= 60
                    ? `Readiness ${readiness}. Moderate recovery. Yoga or lighter session is smart.`
                    : `Readiness ${readiness}, HRV ${hrv}ms. Recovery day. Don't push it.`;

                  return <>
                  {/* YU Recommendation */}
                  {!workoutType && (
                    <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-emerald-400 font-bold mb-0.5">YU recommends: {recType === "crossfit" ? "Home Workout" : recType === "yoga" ? "Hot Yoga" : "Active Rest"}</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{recWhy}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!workoutType ? (
                    <div className="space-y-2">
                      {[
                        { type: "crossfit", label: "Home Workout", desc: "Full session built from your biometrics by Gemini", icon: Dumbbell, color: "#F87171" },
                        { type: "yoga", label: "Hot Yoga", desc: "Down Under Yoga classes matched to your recovery", icon: Activity, color: "#A78BFA" },
                        { type: "rest", label: "Active Rest", desc: "Walk, stretch, mobility", icon: Heart, color: "#4ADE80" },
                      ].map(opt => (
                        <motion.button key={opt.type} className="w-full flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border-0 text-left"
                          style={{ background: opt.type === recType ? `${opt.color}08` : "rgba(255,255,255,0.015)", border: `1.5px solid ${opt.type === recType ? `${opt.color}20` : "rgba(255,255,255,0.04)"}` }}
                          whileHover={{ scale: 1.01, borderColor: `${opt.color}30` }} whileTap={{ scale: 0.98 }}
                          onClick={() => { if (opt.type === "yoga") { setWorkoutType("yoga"); } else { loadWorkout(opt.type); } }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${opt.color}10` }}>
                            <opt.icon className="w-5 h-5" style={{ color: opt.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white">{opt.label}</p>
                              {opt.type === recType && <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(16,185,129,.08)", color: "#4ADE80" }}>Recommended</span>}
                            </div>
                            <p className="text-[10px] text-slate-500">{opt.desc}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </div>

                  ) : workoutType === "yoga" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-1">
                        <Activity className="w-5 h-5 text-violet-400" />
                        <div>
                          <p className="text-base font-black text-white">Down Under Yoga</p>
                          <p className="text-[10px] text-slate-500">Kendall Square, Cambridge</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">Tomorrow's classes ranked by recovery state:</p>
                      {[
                        { time: "12:00 PM", name: "Power Vinyasa", dur: "60 min", temp: "95F", instructor: "Sarah M.", best: readiness >= 75, why: "High readiness = handle the heat" },
                        { time: "4:30 PM", name: "Hot Flow", dur: "75 min", temp: "100F", instructor: "James K.", best: false, why: "Good afternoon energy window" },
                        { time: "6:15 PM", name: "Yin Restore", dur: "60 min", temp: "85F", instructor: "Ana L.", best: readiness < 75, why: "Lower temp, restorative. Best for recovery" },
                        { time: "7:30 PM", name: "Hot 26", dur: "90 min", temp: "105F", instructor: "David R.", best: false, why: "Intense 90min. Only if readiness 80+" },
                      ].map((cls, i) => (
                        <a key={i} href="https://www.downunderyoga.com/schedule" target="_blank" rel="noopener noreferrer" className="block no-underline">
                          <motion.div className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                            style={{ background: cls.best ? "rgba(167,139,250,.06)" : "rgba(255,255,255,0.015)", border: `1px solid ${cls.best ? "rgba(167,139,250,.15)" : "rgba(255,255,255,0.03)"}` }}
                            whileHover={{ scale: 1.01, borderColor: "rgba(167,139,250,.25)" }}>
                            <div className="text-center flex-shrink-0 w-[55px]">
                              <p className="text-xs font-bold text-white">{cls.time}</p>
                              <p className="text-[8px] text-slate-600">{cls.dur}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white">{cls.name}</p>
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,.06)", color: "#F87171" }}>{cls.temp}</span>
                                {cls.best && <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(16,185,129,.08)", color: "#4ADE80" }}>Best for you</span>}
                              </div>
                              <p className="text-[10px] text-slate-500">{cls.why}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-violet-400/40 flex-shrink-0" />
                          </motion.div>
                        </a>
                      ))}
                      <div className="flex items-center justify-between mt-1">
                        <button onClick={() => setWorkoutType(null)} className="text-[10px] text-blue-400 cursor-pointer border-0 bg-transparent">Change type</button>
                        <a href="https://www.downunderyoga.com/schedule" target="_blank" rel="noopener noreferrer" className="text-[10px] text-violet-400 font-bold no-underline hover:text-violet-300">Book on downunderyoga.com</a>
                      </div>
                    </div>

                  ) : aiLoading ? (
                    <div className="flex flex-col items-center py-8 gap-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Sparkles className="w-7 h-7 text-red-400" /></motion.div>
                      <p className="text-sm text-slate-400">Gemini is building your session...</p>
                      <p className="text-[10px] text-slate-600">Readiness {readiness} + HRV {hrv}ms + Sleep {sleepScore}</p>
                    </div>
                  ) : aiWorkout && !aiWorkout.error ? (
                    (() => {
                      // Staleness check — encourage a refresh if the workout
                      // is older than 2 hours so the AI can re-read live HRV.
                      const genAt = aiWorkout.generated_at ? new Date(aiWorkout.generated_at).getTime() : 0;
                      const ageMin = genAt ? Math.round((Date.now() - genAt) / 60000) : 0;
                      const isStale = ageMin >= 120;
                      const ageLabel = !genAt ? "" : ageMin < 60 ? `${ageMin} min ago` : `${Math.round(ageMin / 60)}h ago`;

                      // Section block renderer following the formatting rules
                      const SectionBlock = ({ label, color, durationOrMeta, children }: { label: string; color: string; durationOrMeta?: string; children: React.ReactNode }) => (
                        <div className="rounded-xl p-3.5" style={{ background: `${color}07`, border: `1px solid ${color}14` }}>
                          <p className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: `${color}CC`, letterSpacing: "0.08em" }}>
                            {label}{durationOrMeta ? ` (${durationOrMeta})` : ""}
                          </p>
                          {children}
                        </div>
                      );

                      // Detect if main is a "strength + metcon" combo so we
                      // render two separate sections rather than one block.
                      const main = aiWorkout.main_set || aiWorkout.workout || {};
                      const mainFormat = (aiWorkout.format || main.format || "").toString();
                      const isCombo = /strength\s*\+\s*metcon/i.test(mainFormat);
                      const strengthBlock = aiWorkout.strength || (isCombo ? main.strength : null);
                      const metconBlock = aiWorkout.metcon || (isCombo ? main.metcon : null);

                      const Bullet = ({ children }: { children: React.ReactNode }) => (
                        <li className="text-sm text-slate-200 leading-relaxed pl-1">{children}</li>
                      );

                      // Movement renderer — STRICT structured fields + inline set logger.
                      const renderMovement = (m: any, key: number) => {
                        const movName = (m && typeof m === "object") ? (m.movement_name || m.name || m.movement || "") : String(m);
                        const reps = (m && typeof m === "object") ? (m.reps || m.rep_scheme || "") : "";
                        const load = (m && typeof m === "object") ? (m.load || m.weight || "") : "";
                        const notes = (m && typeof m === "object") ? (m.notes || "") : "";
                        const setCount = Object.keys(loggedSets).filter(k => k.startsWith(movName + "_")).length;
                        const isActive = activeLog === movName;

                        return (
                          <li key={key} className="text-sm text-slate-200 leading-relaxed pl-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>
                                {reps && <span className="text-white font-bold">{reps} </span>}
                                {movName}
                                {load && <span className="text-slate-400"> ({load})</span>}
                                {notes && <span className="text-slate-500 italic"> — {notes}</span>}
                              </span>
                              {workoutLogId && (
                                <button
                                  onClick={() => { setActiveLog(isActive ? null : movName); setLogForm({ reps: reps, load: load, rpe: 7 }); }}
                                  className="text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer border-0"
                                  style={{ background: setCount > 0 ? "rgba(74,222,128,.12)" : "rgba(99,102,241,.12)", color: setCount > 0 ? "#4ADE80" : "#A5B4FC" }}>
                                  {setCount > 0 ? `${setCount} logged` : "Log"}
                                </button>
                              )}
                            </div>
                            {isActive && (
                              <div className="flex items-center gap-2 flex-wrap ml-2 mt-1 p-2 rounded-lg" style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.12)" }}>
                                <input
                                  type="text" placeholder="Reps" value={logForm.reps}
                                  onChange={e => setLogForm(f => ({ ...f, reps: e.target.value }))}
                                  className="w-14 text-[10px] px-2 py-1 rounded-md bg-transparent text-white border"
                                  style={{ borderColor: "rgba(255,255,255,.1)" }} />
                                <input
                                  type="text" placeholder="Load" value={logForm.load}
                                  onChange={e => setLogForm(f => ({ ...f, load: e.target.value }))}
                                  className="w-20 text-[10px] px-2 py-1 rounded-md bg-transparent text-white border"
                                  style={{ borderColor: "rgba(255,255,255,.1)" }} />
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-500">RPE</span>
                                  <input
                                    type="range" min={1} max={10} value={logForm.rpe}
                                    onChange={e => setLogForm(f => ({ ...f, rpe: Number(e.target.value) }))}
                                    className="w-16 h-1 accent-indigo-400" />
                                  <span className="text-[10px] font-bold" style={{ color: logForm.rpe >= 9 ? "#F87171" : logForm.rpe >= 7 ? "#FBBF24" : "#4ADE80" }}>{logForm.rpe}</span>
                                </div>
                                <button
                                  onClick={() => logSet(movName)}
                                  className="text-[9px] font-bold px-2.5 py-1 rounded-md cursor-pointer border-0"
                                  style={{ background: "rgba(74,222,128,.15)", color: "#4ADE80" }}>
                                  Save
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      };

                      // Header builders following the brief
                      const strengthHeader = (b: any) => {
                        const sets = b?.sets ? `${b.sets} SETS` : "";
                        const ft = b?.for_time ? "FOR TIME" : "NOT FOR TIME";
                        return `STRENGTH${sets ? ` — ${sets}` : ""}, ${ft}`;
                      };
                      const metconHeader = (b: any) => {
                        const name = b?.name ? ` — "${String(b.name).toUpperCase()}"` : "";
                        const rounds = b?.rounds ? ` — ${b.rounds} ROUNDS` : "";
                        const ft = b?.time_cap ? ` FOR TIME` : "";
                        return `METCON${name}${rounds}${ft}`;
                      };
                      const mainHeader = () => {
                        const fmt = (mainFormat || "MAIN").toUpperCase();
                        const rounds = main?.rounds ? ` — ${main.rounds} ROUNDS` : "";
                        return `${fmt}${rounds}`;
                      };

                      return (
                    <div className="space-y-4">
                      {/* TITLE BAR */}
                      <div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xl font-black text-white">{aiWorkout.title || aiWorkout.session_name || "Your Session"}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {aiWorkout.intensity && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{
                                background: aiWorkout.intensity === "push" ? "rgba(239,68,68,.15)" : aiWorkout.intensity === "work" ? "rgba(245,158,11,.15)" : "rgba(74,222,128,.15)",
                                color: aiWorkout.intensity === "push" ? "#F87171" : aiWorkout.intensity === "work" ? "#FBBF24" : "#4ADE80",
                              }}>{aiWorkout.intensity} day</span>
                            )}
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(248,113,113,.08)", color: "#F87171" }}>{aiWorkout.duration_min || 30} min</span>
                          </div>
                        </div>
                        {ageLabel && (
                          <p className={`text-[10px] mt-1 ${isStale ? "text-amber-400" : "text-slate-600"}`}>
                            {isStale ? "⚠ " : ""}Generated {ageLabel}{isStale ? " — refresh before starting" : ""}
                          </p>
                        )}
                      </div>

                      {/* WHY (coach context) */}
                      {aiWorkout.why_this_workout && (
                        <div className="rounded-xl p-3" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.06)" }}>
                          <p className="text-[10px] font-bold uppercase text-emerald-400/60 mb-1 tracking-wider">Why this session</p>
                          <p className="text-xs text-slate-300 leading-relaxed">{aiWorkout.why_this_workout}</p>
                        </div>
                      )}

                      {/* WARMUP */}
                      {aiWorkout.warmup && (aiWorkout.warmup.movements?.length || 0) > 0 && (
                        <SectionBlock label="Warmup" color="#F59E0B" durationOrMeta={`${aiWorkout.warmup.duration_min || 5} min`}>
                          <ul className="list-disc list-inside space-y-1 marker:text-amber-400/40">
                            {aiWorkout.warmup.movements.map((m: string, i: number) => <Bullet key={i}>{m}</Bullet>)}
                          </ul>
                        </SectionBlock>
                      )}

                      {/* STRENGTH — strict structured fields, NO description text */}
                      {strengthBlock && (strengthBlock.movements?.length || 0) > 0 && (
                        <SectionBlock label={strengthHeader(strengthBlock)} color="#3B82F6">
                          <ul className="list-disc list-inside space-y-1 marker:text-blue-400/40">
                            {strengthBlock.movements.map((m: any, i: number) => renderMovement(m, i))}
                          </ul>
                          {strengthBlock.rest && (
                            <p className="text-[11px] text-slate-400 mt-2"><span className="font-bold text-slate-300">Rest:</span> {strengthBlock.rest}</p>
                          )}
                        </SectionBlock>
                      )}

                      {/* METCON — strict structured fields, NO description text */}
                      {metconBlock && (metconBlock.movements?.length || 0) > 0 && (
                        <SectionBlock label={metconHeader(metconBlock)} color="#EF4444">
                          <ul className="list-disc list-inside space-y-1 marker:text-red-400/40">
                            {metconBlock.movements.map((m: any, i: number) => renderMovement(m, i))}
                          </ul>
                          {metconBlock.time_cap && (
                            <p className="text-[11px] text-slate-400 mt-2"><span className="font-bold text-slate-300">Time Cap:</span> {metconBlock.time_cap}{typeof metconBlock.time_cap === "number" ? " min" : ""}</p>
                          )}
                        </SectionBlock>
                      )}

                      {/* MAIN — only when there's no strength/metcon split */}
                      {!strengthBlock && !metconBlock && main && (main.movements?.length || 0) > 0 && (
                        <SectionBlock label={mainHeader()} color="#EF4444">
                          <ul className="list-disc list-inside space-y-1 marker:text-red-400/40">
                            {main.movements.map((m: any, i: number) => renderMovement(m, i))}
                          </ul>
                          {main.time_cap && (
                            <p className="text-[11px] text-slate-400 mt-2"><span className="font-bold text-slate-300">Time Cap:</span> {main.time_cap}{typeof main.time_cap === "number" ? " min" : ""}</p>
                          )}
                          {main.notes && (
                            <p className="text-[11px] text-slate-500 mt-2 italic"><span className="not-italic font-bold text-slate-400">Coach's Note:</span> {main.notes}</p>
                          )}
                        </SectionBlock>
                      )}

                      {/* COOLDOWN */}
                      {aiWorkout.cooldown && (aiWorkout.cooldown.movements?.length || 0) > 0 && (
                        <SectionBlock label="Cooldown" color="#4ADE80" durationOrMeta={`${aiWorkout.cooldown.duration_min || 5} min`}>
                          <ul className="list-disc list-inside space-y-1 marker:text-emerald-400/40">
                            {aiWorkout.cooldown.movements.map((m: string, i: number) => <Bullet key={i}>{m}</Bullet>)}
                          </ul>
                        </SectionBlock>
                      )}

                      {/* MENTAL CHALLENGE */}
                      {aiWorkout.mental_challenge && (
                        <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.06)" }}>
                          <p className="text-[10px] font-bold uppercase text-amber-400/60 mb-1 tracking-wider">The hard part</p>
                          <p className="text-sm text-slate-300 italic"><span className="not-italic font-bold text-slate-400">Coach's Note:</span> {aiWorkout.mental_challenge}</p>
                        </div>
                      )}

                      {/* REFRESH FROM CURRENT DATA — the timing fix */}
                      <button
                        onClick={() => loadWorkout(workoutType || "crossfit")}
                        disabled={aiLoading}
                        className="w-full text-xs font-bold py-2.5 rounded-xl cursor-pointer border-0 flex items-center justify-center gap-2"
                        style={{
                          background: isStale ? "rgba(245,158,11,.18)" : "rgba(99,102,241,.10)",
                          color: isStale ? "#FBBF24" : "#A5B4FC",
                          border: `1px solid ${isStale ? "rgba(245,158,11,.35)" : "rgba(99,102,241,.20)"}`,
                        }}>
                        <Sparkles className="w-3.5 h-3.5" />
                        {aiLoading ? "Reading your latest data..." : isStale ? "Refresh — your data has changed since this was made" : "Refresh from current data before you start"}
                      </button>

                      {/* START SESSION button */}
                      {workoutLogId && !sessionActive && (
                        <button
                          onClick={startSession}
                          className="w-full text-sm font-black py-3.5 rounded-xl cursor-pointer border-0 flex items-center justify-center gap-2"
                          style={{ background: "#FF5C35", color: "#fff" }}>
                          <Zap className="w-4 h-4" />
                          Start Session
                        </button>
                      )}

                      {/* Did you do it? — only ask if not yet answered */}
                      {workoutLogId && !workoutFeedback && (
                        <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.15)" }}>
                          <p className="text-xs font-bold text-indigo-300">Did you do this workout?</p>
                          <div className="flex gap-2">
                            <button onClick={() => sendWorkoutFeedback("yes")} className="text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(74,222,128,.15)", color: "#4ADE80" }}>Yes, all of it</button>
                            <button onClick={() => sendWorkoutFeedback("partial")} className="text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(245,158,11,.15)", color: "#FBBF24" }}>Partial</button>
                            <button onClick={() => setShowSkipReasons(true)} className="text-[10px] font-bold px-3 py-1 rounded-full cursor-pointer border-0" style={{ background: "rgba(239,68,68,.15)", color: "#F87171" }}>Skipped</button>
                          </div>
                        </div>
                      )}
                      {showSkipReasons && !workoutFeedback && (
                        <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)" }}>
                          <p className="text-xs font-bold text-red-300">What got in the way?</p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { key: "travel", label: "Travel" },
                              { key: "illness", label: "Sick / injured" },
                              { key: "work_overload", label: "Work overload" },
                              { key: "low_motivation", label: "Low motivation" },
                            ].map(r => (
                              <button key={r.key}
                                onClick={() => {
                                  if (selectedSkipReason === r.key) {
                                    sendWorkoutFeedback("no", r.key);
                                  } else {
                                    setSelectedSkipReason(r.key);
                                  }
                                }}
                                className="text-[10px] font-bold px-3 py-1.5 rounded-full cursor-pointer border-0"
                                style={{
                                  background: selectedSkipReason === r.key ? "rgba(239,68,68,.25)" : "rgba(239,68,68,.12)",
                                  color: "#FCA5A5",
                                  border: selectedSkipReason === r.key ? "1px solid rgba(239,68,68,.4)" : "1px solid transparent",
                                }}>
                                {r.label}
                              </button>
                            ))}
                          </div>
                          {selectedSkipReason && (
                            <div className="flex gap-2 mt-1">
                              <input
                                type="text" placeholder="Add a note (optional)" value={skipNote}
                                onChange={e => setSkipNote(e.target.value)}
                                className="flex-1 text-[10px] px-3 py-1.5 rounded-lg bg-transparent text-white"
                                style={{ border: "1px solid rgba(255,255,255,.1)" }} />
                              <button
                                onClick={() => sendWorkoutFeedback("no", selectedSkipReason)}
                                className="text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer border-0"
                                style={{ background: "rgba(239,68,68,.2)", color: "#FCA5A5" }}>
                                Submit
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {workoutFeedback && (
                        <div className="text-[10px] text-emerald-400/80">
                          ✓ Logged: {workoutFeedback === "yes" ? "completed" : workoutFeedback === "partial" ? "partial" : "skipped"}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => { setWorkoutType(null); setAiWorkout(null); setWorkoutLogId(null); setWorkoutFeedback(null); setShareStatus("idle"); }} className="text-[10px] text-blue-400 cursor-pointer border-0 bg-transparent">Change type</button>
                        <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <button
                          onClick={regenerateWorkout}
                          disabled={!workoutLogId || regenLoading}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer border-0"
                          style={{ background: "rgba(99,102,241,.12)", color: "#A5B4FC" }}>
                          {regenLoading ? "Reprogramming..." : "Try another combo"}
                        </button>
                        <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <motion.button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer border-0 text-[10px] font-bold"
                          style={{
                            background: shareStatus === "sent" || shareStatus === "copied" ? "rgba(74,222,128,0.08)" : "rgba(139,92,246,0.08)",
                            color: shareStatus === "sent" || shareStatus === "copied" ? "#4ADE80" : "#A78BFA",
                            border: `1px solid ${shareStatus === "sent" || shareStatus === "copied" ? "rgba(74,222,128,0.15)" : "rgba(139,92,246,0.15)"}`,
                          }}
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          disabled={shareStatus === "sending"}
                          onClick={async () => {
                            setShareStatus("sending");
                            // Build clean share text from structured data
                            const fmtMov = (m: any) => typeof m === "object" ? `${m.reps || ""} ${m.movement_name || ""} ${m.load ? `(${m.load})` : ""}`.trim() : String(m);
                            const lines: string[] = [
                              `${aiWorkout.title || "Workout"} — ${aiWorkout.format || ""} — ${aiWorkout.duration_min || ""}min`,
                              `${aiWorkout.intensity?.toUpperCase() || ""} DAY`,
                              "",
                            ];
                            for (const bk of ["warmup", "strength", "metcon", "workout", "cooldown"]) {
                              const block = aiWorkout[bk];
                              if (!block?.movements?.length) continue;
                              const label = bk.toUpperCase() + (block.duration_min ? ` (${block.duration_min}min)` : block.sets ? ` — ${block.sets} sets` : block.rounds ? ` — ${block.rounds} rounds` : "");
                              lines.push(label);
                              block.movements.forEach((m: any) => lines.push(`  • ${fmtMov(m)}`));
                              if (block.rest) lines.push(`  Rest: ${block.rest}`);
                              if (block.time_cap) lines.push(`  Time Cap: ${block.time_cap}${typeof block.time_cap === "number" ? " min" : ""}`);
                              lines.push("");
                            }
                            if (aiWorkout.why_this_workout) lines.push(aiWorkout.why_this_workout);
                            if (aiWorkout.mental_challenge) lines.push(`\nThe hard part: ${aiWorkout.mental_challenge}`);
                            lines.push(`\nReadiness ${readiness} · HRV ${hrv}ms · Sleep ${sleepScore}`);
                            lines.push("Programmed by YU");
                            const workoutText = lines.filter(l => l !== undefined).join("\n");

                            // Try native share, fall back to clipboard
                            try {
                              if (navigator.share) {
                                await navigator.share({ title: aiWorkout.title || "YU Workout", text: workoutText });
                                setShareStatus("sent");
                              } else {
                                await navigator.clipboard.writeText(workoutText);
                                setShareStatus("copied");
                              }
                            } catch {
                              try { await navigator.clipboard.writeText(workoutText); } catch {
                                const ta = document.createElement("textarea"); ta.value = workoutText; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                              }
                              setShareStatus("copied");
                            }
                            setTimeout(() => setShareStatus("idle"), 4000);
                          }}>
                          {shareStatus === "sending" ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles className="w-3 h-3" /></motion.div>
                          ) : shareStatus === "sent" ? (
                            <Check className="w-3 h-3" />
                          ) : shareStatus === "copied" ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {shareStatus === "sent" ? "Shared" : shareStatus === "copied" ? "Copied!" : shareStatus === "sending" ? "Sharing..." : "Share workout"}
                        </motion.button>
                      </div>
                    </div>
                      );
                    })()
                  ) : <p className="text-sm text-red-400 py-4">Failed to generate. <button onClick={() => loadWorkout(workoutType!)} className="text-blue-400 cursor-pointer border-0 bg-transparent underline">Try again</button></p>}
                  </>;
                  })()}
                  </motion.div>

                {/* WORKOUT BACKLOG — last 7 days, with did-it / skipped marks */}
                {workoutBacklog.length === 0 && workoutType && (
                  <div className="rounded-2xl p-4 mt-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p className="text-xs text-slate-500">No workout history yet. Complete your first session to start tracking.</p>
                  </div>
                )}
                {workoutBacklog.length > 0 && (
                  <motion.div className="rounded-2xl p-4 mt-3" style={{ background: "rgba(99,102,241,0.03)", border: "1px solid rgba(99,102,241,0.08)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <button onClick={() => setShowBacklog(v => !v)} className="w-full flex items-center justify-between cursor-pointer border-0 bg-transparent p-0">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-indigo-400" />
                        <p className="text-xs font-bold text-indigo-300">Workout history</p>
                        <span className="text-[10px] text-slate-500">({workoutBacklog.length})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{showBacklog ? "hide" : "show"}</span>
                    </button>
                    {showBacklog && (
                      <div className="mt-3 space-y-2">
                        {workoutBacklog.slice(0, 7).map((e: any) => {
                          const fb = e.user_feedback?.completed;
                          const badge = fb === "yes" ? { txt: "Done", c: "#4ADE80", bg: "rgba(74,222,128,.15)" }
                                      : fb === "partial" ? { txt: "Partial", c: "#FBBF24", bg: "rgba(245,158,11,.15)" }
                                      : fb === "no" ? { txt: "Skipped", c: "#F87171", bg: "rgba(239,68,68,.15)" }
                                      : { txt: "Pending", c: "#94A3B8", bg: "rgba(148,163,184,.15)" };
                          const verdictColor = e.load_verdict === "too_much" ? "#F87171" : e.load_verdict === "undertrained" ? "#FBBF24" : e.load_verdict === "ok" ? "#4ADE80" : "#475569";
                          return (
                            <div key={e.id} className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-white truncate">{e.title || "Workout"}</p>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: badge.bg, color: badge.c }}>{badge.txt}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {e.day} · {e.intensity || "?"} · {(e.patterns || []).join(", ") || "—"}
                                </p>
                              </div>
                              {e.load_verdict && <span className="text-[9px] font-bold uppercase" style={{ color: verdictColor }} title={`next-morning verdict: ${e.load_verdict}`}>{e.load_verdict}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* CALENDAR — Swipeable Week View */}
                {(() => {
                  const days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(Date.now() + i * 86400000);
                    const str = d.toISOString().slice(0, 10);
                    const evts = calendarEvents.filter((e: any) => e.start?.slice(0, 10) === str);
                    return {
                      date: d,
                      str,
                      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" }),
                      dayNum: d.getDate(),
                      monthLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
                      events: evts,
                    };
                  });
                  const sel = days[selectedDay];

                  return (
                    <motion.div className="rounded-2xl overflow-hidden" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

                      {/* Day pills — horizontal scroll */}
                      <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                        {days.map((day, i) => {
                          const isSelected = selectedDay === i;
                          const hasEvents = day.events.length > 0;
                          return (
                            <motion.button key={i} onClick={() => setSelectedDay(i)}
                              className="flex flex-col items-center px-3 py-2 rounded-xl cursor-pointer border-0 flex-shrink-0 min-w-[52px] relative"
                              style={{
                                background: isSelected ? "rgba(59,130,246,0.12)" : "transparent",
                                border: `1.5px solid ${isSelected ? "rgba(59,130,246,0.25)" : "transparent"}`,
                              }}
                              whileTap={{ scale: 0.95 }}>
                              <span className="text-[9px] font-bold uppercase" style={{ color: isSelected ? "#60A5FA" : "rgba(255,255,255,0.3)" }}>{day.label}</span>
                              <span className="text-lg font-black" style={{ color: isSelected ? "white" : "rgba(255,255,255,0.4)" }}>{day.dayNum}</span>
                              {hasEvents && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: isSelected ? "#60A5FA" : "rgba(255,255,255,0.2)" }} />}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Events for selected day */}
                      <AnimatePresence mode="wait">
                        <motion.div key={selectedDay} className="px-4 pb-4"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                          <div className="flex items-center gap-2 mb-3 mt-1">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-bold text-white">{sel.monthLabel}</span>
                            <span className="text-[10px] text-slate-500 ml-auto">{sel.events.length} event{sel.events.length !== 1 ? "s" : ""}</span>
                          </div>

                          {sel.events.length === 0 ? (
                            <div className="py-5 text-center">
                              <p className="text-sm text-slate-500">Nothing scheduled</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {[...sel.events].sort((a: any, b: any) => {
                                // Extract sort time: from ISO start (T06:00) or embedded title (13:00 14:30 ...)
                                const getMinutes = (e: any) => {
                                  if (!e.allDay && e.start?.includes("T")) {
                                    const d = new Date(e.start);
                                    return d.getHours() * 60 + d.getMinutes();
                                  }
                                  const emb = (e.title || "").match(/^(\d{1,2}):(\d{2})\s/);
                                  if (emb) return parseInt(emb[1]) * 60 + parseInt(emb[2]);
                                  return 9999; // all-day / unknown → end
                                };
                                return getMinutes(a) - getMinutes(b);
                              }).map((e: any, i: number) => {
                                let time = ""; let title = e.title;
                                if (!e.allDay && e.start?.includes("T")) time = new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
                                const emb = title.match(/^(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/);
                                if (emb) { time = emb[1] + " - " + emb[2]; title = emb[3]; }
                                return (
                                  <div key={i} className="flex items-start gap-2.5 py-2 px-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                                    <span className="text-[11px] text-blue-400 w-[65px] text-right flex-shrink-0 tabular-nums font-semibold pt-0.5">{time || "all day"}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white font-semibold leading-snug">{title}</p>
                                      {e.location && <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{e.location}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  );
                })()}


                {/* BODY DATA CARD */}
                <motion.div className="rounded-2xl p-5" style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/oura-logo.png" alt="Oura" className="h-3.5 object-contain" style={{ filter: "invert(1)", opacity: 0.6 }} />
                    <h3 className="text-lg font-black text-white">Your body this week</h3>
                    <span className="text-xs text-slate-500 ml-auto">Oura Ring · {last14.length} nights</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Sleep + HRV</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={last14} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs><linearGradient id="sg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818CF8" stopOpacity={0.3} /><stop offset="100%" stopColor="#818CF8" stopOpacity={0} /></linearGradient></defs>
                          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} interval={3} />
                          <YAxis tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} domain={[40, 100]} />
                          <Tooltip content={<ChartTip />} />
                          <Area type="monotone" dataKey="sleepScore" stroke="#818CF8" strokeWidth={2} fill="url(#sg1)" dot={false} name="Sleep" />
                          <Area type="monotone" dataKey="hrv" stroke="#A78BFA" strokeWidth={1} fill="none" dot={false} name="HRV" strokeDasharray="3 3" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Stress & Recovery</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={stressChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} interval={3} />
                          <YAxis tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTip />} />
                          <Bar dataKey="stressMin" name="Stress" radius={[2, 2, 0, 0]}
                            shape={(props: any) => { const { x, y, width, height, payload } = props; const c = (payload.summary ?? "").includes("stress") ? "#F87171" : (payload.summary ?? "").includes("restor") ? "#4ADE80" : "#F59E0B"; return <rect x={x} y={y} width={width} height={Math.max(height, 0)} rx={2} fill={c} fillOpacity={0.7} />; }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>

                  {/* SLEEP EXPERIMENTS — Interactive */}
                  {sleepExperiments.length > 0 && (
                    <motion.div className="rounded-2xl p-5" style={{ background: "rgba(129,140,248,0.04)", border: "1px solid rgba(129,140,248,0.1)" }}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Beaker className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-black text-white">Tonight's sleep protocol</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">Two things to try tonight based on your weakest sleep metrics. Tell me tomorrow if you did them so we can track what works.</p>
                      <div className="space-y-3">
                        {sleepExperiments.slice(0, 2).map((exp: any) => {
                          const done = experimentsDone[exp.id];
                          return (
                          <div key={exp.id} className="rounded-xl p-4" style={{ background: done === true ? "rgba(74,222,128,0.04)" : done === false ? "rgba(248,113,113,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${done === true ? "rgba(74,222,128,0.12)" : done === false ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.05)"}` }}>
                            <p className="text-sm font-bold text-white mb-1">{exp.title}</p>
                            <p className="text-xs text-slate-500 mb-3">{exp.why}</p>
                            {done === null || done === undefined ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 mr-auto">Did you do this last night?</span>
                                <motion.button className="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-0"
                                  style={{ background: "rgba(74,222,128,0.08)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.15)" }}
                                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                  onClick={() => setExperimentsDone(prev => ({ ...prev, [exp.id]: true }))}>
                                  Yes
                                </motion.button>
                                <motion.button className="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-0"
                                  style={{ background: "rgba(248,113,113,0.08)", color: "#F87171", border: "1px solid rgba(248,113,113,0.15)" }}
                                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                  onClick={() => setExperimentsDone(prev => ({ ...prev, [exp.id]: false }))}>
                                  No
                                </motion.button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {done ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="text-xs text-red-400">Skipped</span>}
                                <span className="text-[10px] text-slate-500">{done ? "Logged. We'll track if your " + exp.metric + " improves." : "No worries. Try tonight."}</span>
                                <button onClick={() => setExperimentsDone(prev => { const next = { ...prev }; delete next[exp.id]; return next; })}
                                  className="text-[9px] text-slate-600 cursor-pointer border-0 bg-transparent ml-auto">Change</button>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                </div>

                {/* RIGHT COLUMN: Ask YU */}
                <div className="md:sticky md:top-4 md:self-start">
                  <motion.div className="rounded-2xl p-4 md:p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.05), rgba(59,130,246,0.03))", border: "1.5px solid rgba(16,185,129,0.1)" }}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">Ask YU</h3>
                        <p className="text-[9px] text-emerald-400/50">Your workout coach + daily planner</p>
                      </div>
                    </div>
                    <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto mb-3 space-y-2.5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.05) transparent" }}>
                      {chatMessages.length === 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-3">{workoutType ? "Session is set. Ask me to adjust intensity, swap exercises, or add focus areas." : "Pick your workout first, then I'll help you dial it in."}</p>
                          <div className="space-y-1.5">
                            {(workoutType && aiWorkout ? [
                              "Make it harder",
                              "Add more core work",
                              "I only have 20 minutes",
                              "Swap for bodyweight only",
                              "Add a finisher",
                            ] : [
                              "What should I train tomorrow?",
                              "How's my recovery looking?",
                              "I want to focus on upper body this week",
                              "Should I do two-a-days?",
                              "Plan my week of workouts",
                            ]).map(q => (
                              <motion.button key={q} onClick={() => sendChat(q)}
                                className="w-full text-left text-xs px-3 py-2.5 rounded-xl font-medium cursor-pointer border-0"
                                style={{ background: "rgba(16,185,129,.03)", color: "#4ADE80", border: "1px solid rgba(16,185,129,.08)" }}
                                whileHover={{ scale: 1.01, borderColor: "rgba(16,185,129,.18)" }} whileTap={{ scale: 0.99 }}>
                                {q}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                          {m.role === "user" ? (
                            <div className="max-w-[90%] rounded-2xl px-3 py-2" style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.12)" }}>
                              <p className="text-xs text-blue-300 leading-relaxed">{m.text}</p>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="flex items-center gap-1 mb-1">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/50">YU</span>
                              </div>
                              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(16,185,129,.03)", border: "1px solid rgba(16,185,129,.06)" }}>
                                <div className="text-xs text-slate-200 leading-[1.7] whitespace-pre-line" dangerouslySetInnerHTML={{
                                  __html: m.text
                                    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                                    .replace(/^(Action:.*)$/gm, '<span class="block mt-2 text-emerald-400 font-bold">$1</span>')
                                }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {chatSending && (
                        <div className="flex items-center gap-2 py-1">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Sparkles className="w-3.5 h-3.5 text-emerald-400" /></motion.div>
                          <span className="text-xs text-emerald-400/50">Thinking...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                        placeholder="Ask anything..."
                        className="flex-1 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                      <button onClick={() => sendChat()} disabled={chatSending || !chatInput.trim()}
                        className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border-0 disabled:opacity-20"
                        style={{ background: "rgba(16,185,129,.08)" }}>
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    </div>
                  </motion.div>
                </div>

              </div>
              </>
              )}
            </motion.div>
          );})()}
        </AnimatePresence>
      </div>
    </div>
  );
}
