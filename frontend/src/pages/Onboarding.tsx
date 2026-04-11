import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Watch, Target, ChevronRight, Check, Zap, Activity, Footprints, Wind } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const EQUIPMENT_OPTIONS = [
  { key: "dumbbells", label: "Dumbbells", icon: Dumbbell, weights: true },
  { key: "barbell", label: "Barbell", icon: Dumbbell },
  { key: "kettlebell", label: "Kettlebell", icon: Dumbbell },
  { key: "pull_up_bar", label: "Pull-up bar", icon: Activity },
  { key: "bench", label: "Bench", icon: Target },
  { key: "box", label: "Box / Step", icon: Target },
  { key: "rings", label: "Rings", icon: Target },
  { key: "rower", label: "Rower", icon: Wind },
  { key: "treadmill", label: "Treadmill", icon: Footprints },
];

const FITNESS_LEVELS = [
  { key: "beginner", label: "Building foundations", desc: "Under 6 months of consistent training", color: "#6EE7FF" },
  { key: "intermediate", label: "Solid base", desc: "1–3 years, comfortable with compound movements", color: "#C2FF4A" },
  { key: "advanced", label: "Pushing limits", desc: "3+ years, training with intent", color: "#FF5C35" },
];

const GOALS = [
  { key: "strength", label: "Get stronger", icon: Dumbbell },
  { key: "conditioning", label: "Build capacity", icon: Activity },
  { key: "hybrid", label: "Both", icon: Zap },
  { key: "longevity", label: "Long-term performance", icon: Target },
];

const TOTAL_STEPS = 5; // 0=auth, 1=equip, 2=fitness, 3=goals, 3.5=calibrate, 4=reveal

export default function Onboarding() {
  const { user, loginWithGoogle, loginWithApple, refreshProfile } = useAuth();
  const [step, setStep] = useState(user ? 1 : 0);
  const [equipment, setEquipment] = useState<Record<string, boolean | number[]>>({});
  const [dbWeights, setDbWeights] = useState<number[]>([35, 40, 45, 50]);
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [bodyWeight, setBodyWeight] = useState("");
  const [rm, setRm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleEquip = (key: string) => {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGoal = (key: string) => {
    setGoals(prev => prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const equipMap: Record<string, any> = {};
    for (const opt of EQUIPMENT_OPTIONS) {
      if (opt.key === "dumbbells") {
        equipMap[opt.key] = equipment[opt.key] ? dbWeights : [];
      } else {
        equipMap[opt.key] = !!equipment[opt.key];
      }
    }
    const est1rm: Record<string, number> = {};
    for (const [k, v] of Object.entries(rm)) {
      if (v) est1rm[k] = parseInt(v) || 0;
    }
    await api.post("/api/identity/register", {
      user_id: user.uid,
      display_name: user.displayName || user.email?.split("@")[0] || "Athlete",
      equipment: equipMap,
      fitness_level: fitnessLevel || "intermediate",
      goals: goals.length ? goals : ["hybrid"],
      body_weight_lbs: bodyWeight ? parseInt(bodyWeight) : null,
      estimated_1rm: est1rm,
    });
    await refreshProfile();
    setSaving(false);
    setStep(4);
  };

  const ease = [0.2, 0.8, 0.2, 1];
  const stepNum = step === 3.5 ? 4 : step === 4 ? 5 : (step as number) + 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative" style={{ background: "#0B1120" }}>
      {/* Progress indicator */}
      {step > 0 && step < 4 && (
        <div className="absolute top-6 left-6 right-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(255,92,53,0.5)" }}>
              Step {stepNum} of {TOTAL_STEPS}
            </p>
            <div className="flex-1" />
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              {Math.round((stepNum / TOTAL_STEPS) * 100)}%
            </p>
          </div>
          <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(15,26,46,0.5)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #FF5C35, #FF8040)" }}
              initial={{ width: 0 }}
              animate={{ width: `${(stepNum / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* Step 0: Sign in */}
        {step === 0 && (
          <motion.div key="auth" className="w-full max-w-sm space-y-8 text-center"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            {/* Ambient glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,92,53,0.06) 0%, transparent 70%)" }} />
            <div className="relative z-10 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: "rgba(255,92,53,0.5)" }}>Performance Intelligence</p>
              <h1 className="text-5xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em" }}>YU</h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Your body generates data every night. We turn it into your training plan.</p>
            </div>
            <div className="relative z-10">
              <div className="inline-block px-4 py-2 rounded-full mb-4" style={{ background: "#2563EB", color: "#fff" }}>
                <p className="text-xs font-bold">Your data stays yours. Always.</p>
              </div>
            </div>
            <div className="space-y-3 pt-2 relative z-10">
              <button onClick={async () => { await loginWithGoogle(); setStep(1); }}
                className="w-full py-4 rounded-2xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
                style={{ background: "rgba(26,42,74,0.4)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
                Continue with Google
              </button>
              <button onClick={async () => { await loginWithApple(); setStep(1); }}
                className="w-full py-4 rounded-2xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
                style={{ background: "#fff", color: "#000" }}>
                Continue with Apple
              </button>
            </div>
            <p className="text-[10px] relative z-10" style={{ color: "rgba(255,255,255,0.15)" }}>We read your wearable data. We never write to your device.</p>
          </motion.div>
        )}

        {/* Step 1: Equipment */}
        {step === 1 && (
          <motion.div key="equip" className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Your setup</p>
              <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>What equipment do you train with?</h2>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>We'll only program movements your setup supports.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EQUIPMENT_OPTIONS.map(opt => {
                const active = !!equipment[opt.key];
                return (
                  <button key={opt.key} onClick={() => toggleEquip(opt.key)}
                    className="rounded-2xl p-4 text-center cursor-pointer border-0 transition-all"
                    style={{
                      background: active ? "rgba(255,92,53,0.1)" : "rgba(15,26,46,0.6)",
                      border: `1.5px solid ${active ? "rgba(255,92,53,0.35)" : "rgba(26,42,74,0.4)"}`,
                    }}>
                    <opt.icon className="w-5 h-5 mx-auto mb-2" style={{ color: active ? "#FF5C35" : "#475569" }} />
                    <p className="text-[11px] font-bold" style={{ color: active ? "#FF5C35" : "#94A3B8" }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
            {equipment.dumbbells && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Dumbbell weights available (lbs)</p>
                <div className="flex gap-2 flex-wrap">
                  {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(w => (
                    <button key={w} onClick={() => setDbWeights(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort((a, b) => a - b))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-0"
                      style={{
                        background: dbWeights.includes(w) ? "rgba(255,92,53,0.15)" : "rgba(15,26,46,0.5)",
                        color: dbWeights.includes(w) ? "#FF5C35" : "#64748B",
                        border: `1px solid ${dbWeights.includes(w) ? "rgba(255,92,53,0.3)" : "rgba(26,42,74,0.4)"}`,
                      }}>{w}</button>
                  ))}
                </div>
              </motion.div>
            )}
            <button onClick={() => setStep(2)}
              className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.2)" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2: Training experience */}
        {step === 2 && (
          <motion.div key="fitness" className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Training age</p>
              <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>Where's your training at?</h2>
            </div>
            <div className="space-y-2">
              {FITNESS_LEVELS.map(f => (
                <button key={f.key} onClick={() => setFitnessLevel(f.key)}
                  className="w-full rounded-2xl p-5 text-left cursor-pointer border-0 transition-all relative overflow-hidden"
                  style={{
                    background: fitnessLevel === f.key ? `${f.color}08` : "rgba(15,26,46,0.6)",
                    border: `1.5px solid ${fitnessLevel === f.key ? `${f.color}40` : "rgba(26,42,74,0.4)"}`,
                  }}>
                  {fitnessLevel === f.key && (
                    <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none" style={{ background: `radial-gradient(circle at 100% 0%, ${f.color}10, transparent 70%)` }} />
                  )}
                  <p className="text-sm font-bold" style={{ color: fitnessLevel === f.key ? f.color : "#E2E8F0" }}>{f.label}</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{f.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} disabled={!fitnessLevel}
              className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: fitnessLevel ? "linear-gradient(135deg, #FF5C35, #FF8040)" : "rgba(15,26,46,0.5)", color: fitnessLevel ? "#fff" : "#333", boxShadow: fitnessLevel ? "0 8px 32px rgba(255,92,53,0.2)" : "none" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 3: Training goals */}
        {step === 3 && (
          <motion.div key="goals" className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Objective</p>
              <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>What are you optimizing for?</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map(g => {
                const active = goals.includes(g.key);
                return (
                  <button key={g.key} onClick={() => toggleGoal(g.key)}
                    className="rounded-2xl p-5 text-center cursor-pointer border-0 transition-all"
                    style={{
                      background: active ? "rgba(255,92,53,0.1)" : "rgba(15,26,46,0.6)",
                      border: `1.5px solid ${active ? "rgba(255,92,53,0.35)" : "rgba(26,42,74,0.4)"}`,
                    }}>
                    <g.icon className="w-5 h-5 mx-auto mb-2" style={{ color: active ? "#FF5C35" : "#475569" }} />
                    <p className="text-sm font-bold" style={{ color: active ? "#FF5C35" : "#94A3B8" }}>{g.label}</p>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(3.5 as any)}
              className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.2)" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 3.5: Strength calibration */}
        {step === 3.5 && (
          <motion.div key="strength" className="w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Calibration</p>
              <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>Set your starting loads</h2>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>Optional — makes your first session more accurate. The system auto-adjusts from session 2.</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
              <p className="text-xs font-bold text-white mb-3">Body weight (lbs)</p>
              <input type="number" placeholder="e.g. 180" value={bodyWeight}
                onChange={e => setBodyWeight(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm bg-transparent text-white"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,26,46,0.6)" }} />
            </div>
            <div className="rounded-2xl p-5" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
              <p className="text-xs font-bold text-white mb-1">Heaviest dumbbell for 5 reps (lbs per hand)</p>
              <p className="text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>Best guess is fine — the system learns fast</p>
              <div className="space-y-3">
                {[
                  { key: "db_front_squat", label: "Front squat" },
                  { key: "db_press", label: "Overhead press" },
                  { key: "db_row", label: "Bent-over row" },
                ].map(m => (
                  <div key={m.key} className="flex items-center gap-3">
                    <p className="text-xs text-slate-300 w-28">{m.label}</p>
                    <input type="number" placeholder="lbs" value={rm[m.key] || ""}
                      onChange={e => setRm(prev => ({ ...prev, [m.key]: e.target.value }))}
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-transparent text-white"
                      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,26,46,0.6)" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving}
                className="flex-1 py-4 rounded-2xl text-sm font-black cursor-pointer border-0"
                style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.2)" }}>
                {saving ? "Building your plan..." : "Build my first session"}
              </button>
              <button onClick={() => { save(); }}
                className="px-5 py-4 rounded-2xl text-xs font-bold cursor-pointer border-0"
                style={{ background: "rgba(15,26,46,0.6)", color: "#64748B", border: "1px solid rgba(26,42,74,0.4)" }}>
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Welcome + first plan reveal */}
        {step === 4 && (
          <motion.div key="reveal" className="w-full max-w-md text-center space-y-6"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease, duration: 0.6 }}>
            {/* Celebration glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(194,255,74,0.06) 0%, transparent 60%)" }} />

            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
              className="relative z-10">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(194,255,74,0.12)" }}>
                <Check className="w-8 h-8" style={{ color: "#C2FF4A" }} />
              </div>
            </motion.div>

            <div className="relative z-10 space-y-3">
              <h2 className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>You're in.</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Your first session is being generated from your Oura data right now.</p>
            </div>

            {/* What happens next preview */}
            <motion.div className="rounded-2xl p-5 text-left relative z-10" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <p className="text-[9px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: "rgba(255,92,53,0.5)" }}>What happens next</p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Every morning, rate how ready you feel", color: "#6EE7FF" },
                  { step: "2", text: "We compare that to your biometric data overnight", color: "#C2FF4A" },
                  { step: "3", text: "Your session auto-adjusts to match your capacity", color: "#FF5C35" },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black" style={{ background: `${item.color}12`, color: item.color }}>
                      {item.step}
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
              className="relative z-10">
              <a href="/today">
                <button className="w-full py-4 rounded-2xl text-sm font-black cursor-pointer border-0 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #FF5C35, #FF8040)", color: "#fff", boxShadow: "0 8px 32px rgba(255,92,53,0.25)" }}>
                  <Zap className="w-4 h-4" /> See your first session
                </button>
              </a>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
