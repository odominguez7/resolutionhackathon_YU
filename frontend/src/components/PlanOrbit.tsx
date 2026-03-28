import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { Calendar, Moon, Heart, Dumbbell, Brain, Zap, MapPin, Coffee, Flame, Sparkles, ChevronRight, Bed, Activity, Send, MessageCircle, Target, ArrowRight } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Props = { todayData: any; calendarEvents: any[]; stats: any; sleepHistory?: any[]; stressData?: any[] };

export default function PlanOrbit({ todayData, calendarEvents, stats, sleepHistory = [], stressData = [] }: Props) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "goal" | "plan">("idle");
  const [scanStep, setScanStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [podSent, setPodSent] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [aiWorkout, setAiWorkout] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "yu"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      const resp = await fetch("http://localhost:8000/api/calendar/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text + (goal ? ` (My goal: ${goal})` : ""), biometrics: `Sleep: ${sleepScore}, Readiness: ${readiness}, HRV: ${hrv} ms, Stress: ${stressMin} min` }),
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
    fetch(`http://localhost:8000/api/oura/workout?session_type=${type}`).then(r => r.json()).then(setAiWorkout).catch(() => setAiWorkout({ error: true })).finally(() => setAiLoading(false));
  };

  const scanSources = [
    { label: "Oura Ring", detail: `Sleep ${sleepScore} · HRV ${hrv}ms · Readiness ${readiness}`, icon: Brain, color: "#A78BFA" },
    { label: "iCloud Calendar", detail: `${calendarEvents.length} events this week`, icon: Calendar, color: "#3B82F6" },
    { label: "Eight Sleep Pod 5 Ultra", detail: "Temperature · GentleRise · Snoring", icon: Bed, color: "#818CF8" },
    { label: "Workout history", detail: "Recovery-aware programming", icon: Dumbbell, color: "#F87171" },
    { label: "Gemini 2.5 Pro", detail: "Building your personalized plan", icon: Sparkles, color: "#4ADE80" },
  ];

  const handlePlan = () => {
    if (phase !== "idle") return;
    setPhase("scanning"); setScanStep(0);
    let step = 0;
    const iv = setInterval(() => { step++; setScanStep(step); if (step >= scanSources.length) { clearInterval(iv); setTimeout(() => setPhase("goal"), 600); } }, 500);
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
                <svg width="270" height="270" viewBox="0 0 270 270" className="absolute -inset-[3px]" style={{ animation: "ring-glow 3s ease-in-out infinite", transform: "rotate(-90deg)" }}>
                  <circle cx={135} cy={135} r={128} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={6} />
                  <motion.circle cx={135} cy={135} r={128} fill="none" stroke={rColor} strokeWidth={6} strokeLinecap="round" strokeDasharray={ringCirc}
                    initial={{ strokeDashoffset: ringCirc }} animate={{ strokeDashoffset: ringCirc * (1 - readiness / 100) }} transition={{ duration: 2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }} />
                  <motion.circle cx={135} cy={135} r={128} fill="none" stroke={rColor} strokeWidth={3} strokeLinecap="round" strokeOpacity={0.4} strokeDasharray={ringCirc}
                    initial={{ strokeDashoffset: ringCirc }} animate={{ strokeDashoffset: ringCirc * (1 - readiness / 100) }} transition={{ duration: 2, delay: 0.5 }} style={{ filter: "blur(6px)" }} />
                </svg>
                <motion.div className="w-[264px] h-[264px] rounded-full overflow-hidden relative" style={{ border: `3px solid ${rColor}20`, boxShadow: `0 0 50px rgba(0,0,0,0.4), 0 0 30px ${rColor}08` }}
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
                <motion.button className="px-14 py-5 rounded-2xl cursor-pointer border-0" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))", border: "1.5px solid rgba(59,130,246,0.15)" }}
                  whileHover={{ scale: 1.04, boxShadow: "0 0 50px rgba(59,130,246,0.15)" }} whileTap={{ scale: 0.97 }} onClick={handlePlan}
                  animate={{ boxShadow: ["0 0 15px rgba(59,130,246,0.05)", "0 0 35px rgba(59,130,246,0.1)", "0 0 15px rgba(59,130,246,0.05)"] }} transition={{ boxShadow: { duration: 3, repeat: Infinity } }}>
                  <span className="text-xl font-black text-white">Plan my day</span>
                </motion.button>
                <div className="flex items-center justify-center gap-3 mt-3">
                  {[{ icon: Brain, l: "Oura", c: "#A78BFA" }, { icon: Calendar, l: "Calendar", c: "#3B82F6" }, { icon: Bed, l: "Eight Sleep", c: "#818CF8" }, { icon: Sparkles, l: "Gemini", c: "#4ADE80" }].map(s => (
                    <div key={s.l} className="flex items-center gap-1"><s.icon className="w-2.5 h-2.5" style={{ color: s.c, opacity: 0.4 }} /><span className="text-[8px]" style={{ color: "rgba(255,255,255,0.2)" }}>{s.l}</span></div>
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
          {phase === "plan" && (
            <motion.div key="plan" className="w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full overflow-hidden relative flex-shrink-0" style={{ border: `2.5px solid ${rColor}30` }}>
                  <img src="/me.png" alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.85)" }} />
                  <svg className="absolute inset-0" viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={24} cy={24} r={21} fill="none" stroke={rColor} strokeWidth={2.5} strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 21} strokeDashoffset={2 * Math.PI * 21 * (1 - readiness / 100)} />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-black text-white">Your week, planned</h2>
                  <p className="text-xs text-slate-500">{goal} · {calendarEvents.length} events · Oura + Eight Sleep + Gemini</p>
                </div>
                <button onClick={() => { setPhase("idle"); setPodSent(false); setActiveSection(null); setWorkoutType(null); setAiWorkout(null); setSelectedDay(0); }}
                  className="text-xs text-slate-600 cursor-pointer border-0 bg-transparent hover:text-slate-400 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>Reset</button>
              </div>

              {/* Day selector */}
              <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(Date.now() + i * 86400000);
                  const dayStr = d.toISOString().slice(0, 10);
                  const dayEvents = calendarEvents.filter((e: any) => e.start?.slice(0, 10) === dayStr);
                  const label = i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" });
                  const dateNum = d.getDate();
                  const isSelected = selectedDay === i;
                  return (
                    <motion.button key={i} onClick={() => setSelectedDay(i)}
                      className="flex flex-col items-center px-4 py-2.5 rounded-xl cursor-pointer border-0 flex-shrink-0 min-w-[60px]"
                      style={{
                        background: isSelected ? `${rColor}12` : "rgba(255,255,255,0.015)",
                        border: `1.5px solid ${isSelected ? `${rColor}30` : "rgba(255,255,255,0.03)"}`,
                      }}
                      whileHover={{ scale: 1.05, borderColor: `${rColor}20` }} whileTap={{ scale: 0.95 }}>
                      <span className="text-[10px] font-bold uppercase" style={{ color: isSelected ? rColor : "rgba(255,255,255,0.3)" }}>{label}</span>
                      <span className="text-xl font-black" style={{ color: isSelected ? "white" : "rgba(255,255,255,0.4)" }}>{dateNum}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 4).map((_: any, j: number) => (
                            <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? rColor : "rgba(255,255,255,0.15)" }} />
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Biometric bar */}
              <div className="grid grid-cols-4 gap-2.5 mb-5">
                {[
                  { icon: Moon, label: "Sleep", value: sleepScore, color: "#818CF8", sub: "last night" },
                  { icon: Heart, label: "Readiness", value: readiness, color: "#4ADE80", sub: readiness >= 75 ? "go hard" : readiness >= 60 ? "moderate" : "rest day" },
                  { icon: Brain, label: "HRV", value: hrv, color: "#A78BFA", sub: "ms" },
                  { icon: Flame, label: "Stress", value: stressMin, color: "#FBBF24", sub: "min today" },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-3.5 text-center" style={{ background: `${m.color}06`, border: `1px solid ${m.color}10` }}>
                    <m.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: m.color }} />
                    <p className="text-3xl font-black text-white leading-none">{m.value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: `${m.color}70` }}>{m.label}</p>
                    <p className="text-[9px] text-slate-500">{m.sub}</p>
                  </div>
                ))}
              </div>

              {/* Action cards */}
              <div className="space-y-3">

                {/* YU COACH — HERO FEATURE, TOP OF PLAN */}
                <motion.div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.04))", border: "1.5px solid rgba(16,185,129,0.12)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-black text-white">Ask YU</h3>
                        <p className="text-[10px] text-emerald-400/50">Your AI copilot for the week</p>
                      </div>
                      <MessageCircle className="w-4 h-4 text-emerald-400/30" />
                    </div>
                    <div className="max-h-[350px] overflow-y-auto mb-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.05) transparent" }}>
                      {chatMessages.length === 0 && (
                        <div>
                          <p className="text-sm text-slate-300 mb-4">I see your calendar, your body data, and your goal. What do you need help with?</p>
                          <div className="grid grid-cols-2 gap-2">
                            {["What should I cancel this week?", "How do I stay accountable?", "Protect my sleep this week", "What's the most important thing?", "Am I overdoing it?", "Plan my recovery"].map(q => (
                              <motion.button key={q} onClick={() => sendChat(q)}
                                className="text-left text-xs px-4 py-3 rounded-xl font-medium cursor-pointer border-0 transition-all"
                                style={{ background: "rgba(16,185,129,.04)", color: "#4ADE80", border: "1px solid rgba(16,185,129,.1)" }}
                                whileHover={{ scale: 1.02, borderColor: "rgba(16,185,129,.2)" }} whileTap={{ scale: 0.98 }}>
                                {q}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                          {m.role === "user" ? (
                            <div className="max-w-[80%] rounded-2xl px-4 py-3" style={{ background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.12)" }}>
                              <p className="text-sm text-blue-300 leading-relaxed">{m.text}</p>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/50">YU</span>
                              </div>
                              <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(16,185,129,.03)", border: "1px solid rgba(16,185,129,.06)" }}>
                                <div className="text-sm text-slate-200 leading-[1.7] whitespace-pre-line" dangerouslySetInnerHTML={{
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
                        <div className="flex items-center gap-2 py-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Sparkles className="w-4 h-4 text-emerald-400" /></motion.div>
                          <span className="text-sm text-emerald-400/50">Thinking...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                        placeholder="Ask YU anything about your week..."
                        className="flex-1 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
                      <button onClick={() => sendChat()} disabled={chatSending || !chatInput.trim()}
                        className="px-5 rounded-xl flex items-center justify-center cursor-pointer border-0 disabled:opacity-20 transition-all hover:scale-[1.02]"
                        style={{ background: "rgba(16,185,129,.1)" }}>
                        <Send className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* MOVEMENT CARD */}
                <motion.div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.1)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Dumbbell className="w-5 h-5 text-red-400" />
                    <h3 className="text-lg font-black text-white">Today's movement</h3>
                    <span className="text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ml-auto" style={{ background: readiness >= 75 ? "rgba(248,113,113,.1)" : readiness >= 60 ? "rgba(245,158,11,.1)" : "rgba(74,222,128,.1)", color: readiness >= 75 ? "#F87171" : readiness >= 60 ? "#FBBF24" : "#4ADE80" }}>
                      {readiness >= 75 ? "Go hard" : readiness >= 60 ? "Moderate" : "Rest day"}
                    </span>
                  </div>

                  {!workoutType ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: "crossfit", label: "Home Workout", icon: Dumbbell, color: "#F87171" },
                        { type: "yoga", label: "Hot Yoga", icon: Activity, color: "#A78BFA" },
                        { type: "rest", label: "Active Rest", icon: Heart, color: "#4ADE80" },
                      ].map(opt => (
                        <motion.button key={opt.type} className="p-3 rounded-xl cursor-pointer border-0 text-center"
                          style={{ background: `${opt.color}08`, border: `1px solid ${opt.color}15` }}
                          whileHover={{ scale: 1.03, borderColor: `${opt.color}30` }} whileTap={{ scale: 0.97 }}
                          onClick={() => loadWorkout(opt.type)}>
                          <opt.icon className="w-7 h-7 mx-auto mb-2" style={{ color: opt.color }} />
                          <p className="text-sm font-bold text-white">{opt.label}</p>
                        </motion.button>
                      ))}
                    </div>
                  ) : aiLoading ? (
                    <div className="flex flex-col items-center py-8 gap-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Sparkles className="w-7 h-7 text-red-400" /></motion.div>
                      <p className="text-sm text-slate-400">Gemini is building your {workoutType} session...</p>
                      <p className="text-[10px] text-slate-600">Based on Readiness {readiness} + HRV {hrv} + Sleep {sleepScore}</p>
                    </div>
                  ) : aiWorkout && !aiWorkout.error ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xl font-black text-white">{aiWorkout.session_name || "Your Session"}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: "rgba(248,113,113,.08)", color: "#F87171" }}>{aiWorkout.duration_min || 30} min</span>
                      </div>
                      {aiWorkout.warmup && <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.06)" }}>
                        <p className="text-[9px] font-bold uppercase text-amber-400/60 mb-1">Warmup</p>
                        {aiWorkout.warmup.movements?.map((m: string, i: number) => <p key={i} className="text-sm text-slate-300">{m}</p>)}
                      </div>}
                      {aiWorkout.main_set && <div className="rounded-xl p-3" style={{ background: "rgba(248,113,113,.04)", border: "1px solid rgba(248,113,113,.06)" }}>
                        <p className="text-[9px] font-bold uppercase text-red-400/60 mb-1">{aiWorkout.main_set.format || "Main"} {aiWorkout.main_set.rounds ? `· ${aiWorkout.main_set.rounds} rounds` : ""}</p>
                        {aiWorkout.main_set.movements?.map((m: string, i: number) => <p key={i} className="text-sm text-white font-medium">{m}</p>)}
                      </div>}
                      {aiWorkout.cooldown && <div className="rounded-xl p-3" style={{ background: "rgba(74,222,128,.04)", border: "1px solid rgba(74,222,128,.06)" }}>
                        <p className="text-[9px] font-bold uppercase text-emerald-400/60 mb-1">Cooldown</p>
                        {aiWorkout.cooldown.movements?.map((m: string, i: number) => <p key={i} className="text-sm text-slate-300">{m}</p>)}
                      </div>}
                      <button onClick={() => { setWorkoutType(null); setAiWorkout(null); }} className="text-[10px] text-blue-400 cursor-pointer border-0 bg-transparent">Change workout type</button>
                    </div>
                  ) : <p className="text-sm text-red-400 py-4">Failed to generate. <button onClick={() => loadWorkout(workoutType!)} className="text-blue-400 cursor-pointer border-0 bg-transparent underline">Try again</button></p>}
                  <p className="text-[7px] text-slate-700 mt-2">Powered by Google Gemini + Oura Ring data</p>
                </motion.div>

                {/* CALENDAR CARD -- selected day */}
                {(() => {
                  const selDate = new Date(Date.now() + selectedDay * 86400000);
                  const selStr = selDate.toISOString().slice(0, 10);
                  const selLabel = selectedDay === 0 ? "Today" : selectedDay === 1 ? "Tomorrow" : selDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                  const dayEvents2 = calendarEvents.filter((e: any) => e.start?.slice(0, 10) === selStr);

                  return (
                    <motion.div className="rounded-2xl p-5" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}
                      key={selectedDay} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-black text-white">{selLabel}</h3>
                        <span className="text-xs text-slate-500 ml-auto">{dayEvents2.length} event{dayEvents2.length !== 1 ? "s" : ""}</span>
                      </div>
                      {dayEvents2.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-base text-slate-400 font-semibold">Nothing scheduled</p>
                          <p className="text-sm text-emerald-400/60 mt-1">{readiness >= 70 ? "Great day to push a workout or tackle deep work." : "Perfect for recovery. Protect this free time."}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayEvents2.map((e: any, i: number) => {
                            let time = ""; let title = e.title;
                            if (!e.allDay && e.start?.includes("T")) time = new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
                            const emb = title.match(/^(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(.+)$/);
                            if (emb) { time = emb[1] + " - " + emb[2]; title = emb[3]; }
                            return (
                              <div key={i} className="flex items-start gap-3 py-2.5 px-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                                <span className="text-sm text-blue-400 w-[80px] text-right flex-shrink-0 tabular-nums font-semibold">{time || "all day"}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-base text-white font-semibold leading-snug">{title}</p>
                                  {e.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{e.location}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* YU tip for the day */}
                      <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.08)" }}>
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-300 leading-relaxed">
                            {dayEvents2.length >= 4 ? `Packed day. ${dayEvents2.length} things on the plate. Don't try to squeeze a hard workout in. A 15-min walk between events is enough.`
                              : dayEvents2.length >= 2 ? `Balanced day. You've got gaps. Use them for movement or deep work, not scrolling.`
                              : dayEvents2.length === 1 ? `Light day. One commitment. Use the rest of the time intentionally. ${readiness >= 70 ? "Great for a solid workout." : "Great for recovery."}`
                              : `Free day. No excuses. ${readiness >= 70 ? "Push a hard session and knock out deep work." : "Full recovery day. Walk, stretch, sleep early."}`}
                          </p>
                        </div>
                      </div>
                      <p className="text-[7px] text-slate-700 mt-2">iCloud Calendar</p>
                    </motion.div>
                  );
                })()}

                {/* SLEEP / EIGHT SLEEP CARD */}
                <motion.div className="rounded-2xl p-5" style={{ background: "rgba(129,140,248,0.04)", border: "1px solid rgba(129,140,248,0.1)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/eightsleep-logo.png" alt="Eight Sleep" className="h-5 object-contain" />
                    <h3 className="text-lg font-black text-white">Tonight's sleep</h3>
                    <div className="flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,.06)" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[8px] font-bold text-emerald-400">Pod Online</span>
                    </div>
                  </div>
                  {/* Temp plan */}
                  <div className="grid grid-cols-5 gap-1.5 mb-3">
                    {[
                      { t: "Bedtime", v: "68F", c: "#FBBF24" }, { t: "Onset", v: "64F", c: "#60A5FA" }, { t: "Deep", v: sleepScore < 80 ? "60F" : "62F", c: "#3B82F6" }, { t: "REM", v: "68F", c: "#8B5CF6" }, { t: "Wake", v: "78F", c: "#F87171" },
                    ].map(s => (
                      <div key={s.t} className="text-center rounded-lg py-2.5" style={{ background: `${s.c}06` }}>
                        <p className="text-lg font-black leading-none" style={{ color: s.c }}>{s.v}</p>
                        <p className="text-[8px] font-bold uppercase text-white/30 mt-1">{s.t}</p>
                      </div>
                    ))}
                  </div>
                  {/* Pod activation button + animation */}
                  {!podSent ? (
                    <motion.button className="w-full py-4 rounded-xl cursor-pointer border-0 flex items-center justify-center gap-2 relative overflow-hidden"
                      style={{ background: "rgba(129,140,248,0.08)", border: "1.5px solid rgba(129,140,248,0.15)" }}
                      whileHover={{ scale: 1.01, boxShadow: "0 0 30px rgba(129,140,248,0.1)" }} whileTap={{ scale: 0.99 }}
                      onClick={() => setPodSent(true)}>
                      <img src="/eightsleep-logo.png" alt="" className="h-4 object-contain" />
                      <span className="text-sm font-bold text-indigo-300">Activate tonight's plan</span>
                    </motion.button>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      {/* Animated activation sequence */}
                      <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: "rgba(129,140,248,0.04)", border: "1px solid rgba(129,140,248,0.1)" }}>
                        {/* Background wave effect */}
                        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(129,140,248,0.06), transparent)" }}
                          animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2, repeat: 2, ease: "easeInOut" }} />

                        <div className="relative z-10 space-y-3">
                          {[
                            { icon: Bed, label: "Pre-cooling surface", detail: `Dropping to ${sleepScore < 80 ? "62" : "64"}F`, color: "#3B82F6", delay: 0 },
                            { icon: Moon, label: "Temperature schedule set", detail: "68F → 64F → 62F → 68F → 78F through the night", color: "#818CF8", delay: 0.5 },
                            { icon: Zap, label: "GentleRise alarm armed", detail: "7:30 AM · Thermal warming + vibration + sunrise sound", color: "#FBBF24", delay: 1 },
                            { icon: Heart, label: "Snoring mitigation active", detail: "Auto-elevate when snoring detected", color: "#A78BFA", delay: 1.5 },
                          ].map((action) => (
                            <motion.div key={action.label} className="flex items-center gap-3"
                              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: action.delay, duration: 0.5 }}>
                              <motion.div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `${action.color}12` }}
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: action.delay + 0.2, type: "spring", stiffness: 300 }}>
                                <action.icon className="w-4 h-4" style={{ color: action.color }} />
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <motion.p className="text-xs font-bold text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: action.delay + 0.3 }}>
                                  {action.label}
                                </motion.p>
                                <motion.p className="text-[10px] text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: action.delay + 0.4 }}>
                                  {action.detail}
                                </motion.p>
                              </div>
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: action.delay + 0.5, type: "spring" }}>
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                              </motion.div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Progress bar */}
                        <motion.div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #818CF8, #4ADE80)" }}
                            initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.5, ease: "easeInOut" }} />
                        </motion.div>
                      </div>

                      {/* Confirmation */}
                      <motion.div className="rounded-xl p-4 text-center" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)" }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.3 }}>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.5, type: "spring", stiffness: 200 }}>
                          <Zap className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        </motion.div>
                        <p className="text-base font-black text-emerald-400">Pod 5 Ultra is ready</p>
                        <p className="text-xs text-slate-400 mt-1">Your bed is preparing for tonight. Surface cooling now.</p>
                        <div className="flex items-center justify-center gap-4 mt-3">
                          <div className="text-center">
                            <p className="text-lg font-black text-blue-400">{sleepScore < 80 ? "62" : "64"}F</p>
                            <p className="text-[8px] text-slate-600 uppercase">Surface temp</p>
                          </div>
                          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.05)" }} />
                          <div className="text-center">
                            <p className="text-lg font-black text-amber-400">7:30</p>
                            <p className="text-[8px] text-slate-600 uppercase">Alarm set</p>
                          </div>
                          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.05)" }} />
                          <div className="text-center">
                            <p className="text-lg font-black text-violet-400">+34%</p>
                            <p className="text-[8px] text-slate-600 uppercase">Deep sleep</p>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                  <p className="text-[7px] text-slate-700 mt-2">Temperature protocol from Oura Ring sleep data · Eight Sleep Pod 5 Ultra</p>
                </motion.div>

                {/* BODY DATA CARD */}
                <motion.div className="rounded-2xl p-5" style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/oura-logo.png" alt="Oura" className="h-3.5 object-contain" style={{ filter: "invert(1)", opacity: 0.6 }} />
                    <h3 className="text-lg font-black text-white">Your body this week</h3>
                    <span className="text-xs text-slate-500 ml-auto">Oura Ring · {last14.length} nights</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
