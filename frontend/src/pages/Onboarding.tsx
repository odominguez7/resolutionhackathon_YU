import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Watch, Target, ChevronRight, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const EQUIPMENT_OPTIONS = [
  { key: "dumbbells", label: "Dumbbells", icon: Dumbbell, weights: true },
  { key: "treadmill", label: "Treadmill", icon: Target },
  { key: "pull_up_bar", label: "Pull-up bar", icon: Target },
  { key: "barbell", label: "Barbell", icon: Dumbbell },
  { key: "bench", label: "Bench", icon: Target },
  { key: "kettlebell", label: "Kettlebell", icon: Dumbbell },
  { key: "box", label: "Box / Step", icon: Target },
  { key: "rings", label: "Rings", icon: Target },
  { key: "rower", label: "Rower", icon: Target },
];

const FITNESS_LEVELS = [
  { key: "beginner", label: "Just starting", desc: "Less than 6 months of consistent training" },
  { key: "intermediate", label: "Solid base", desc: "1-3 years, know the movements" },
  { key: "advanced", label: "Experienced", desc: "3+ years, push hard regularly" },
];

const GOALS = [
  { key: "strength", label: "Get stronger" },
  { key: "conditioning", label: "Better cardio" },
  { key: "hybrid", label: "Both" },
  { key: "longevity", label: "Long-term health" },
];

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#0a0b0d" }}>
      <AnimatePresence mode="wait">

        {/* Step 0: Sign in */}
        {step === 0 && (
          <motion.div key="auth" className="w-full max-w-sm space-y-6 text-center"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <h1 className="text-3xl font-black text-white">YU</h1>
            <p className="text-sm text-slate-400">Your body has data. Let's use it.</p>
            <div className="space-y-3 pt-4">
              <button onClick={async () => { await loginWithGoogle(); setStep(1); }}
                className="w-full py-3.5 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
                Continue with Google
              </button>
              <button onClick={async () => { await loginWithApple(); setStep(1); }}
                className="w-full py-3.5 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
                style={{ background: "#fff", color: "#000" }}>
                Continue with Apple
              </button>
            </div>
            <p className="text-[10px] text-slate-600">We read your wearable data. We never write to your device.</p>
          </motion.div>
        )}

        {/* Step 1: Equipment */}
        {step === 1 && (
          <motion.div key="equip" className="w-full max-w-md space-y-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <h2 className="text-xl font-black text-white">What equipment do you have?</h2>
              <p className="text-xs text-slate-500 mt-1">Tap to toggle. We'll only program movements you can do.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EQUIPMENT_OPTIONS.map(opt => {
                const active = !!equipment[opt.key];
                return (
                  <button key={opt.key} onClick={() => toggleEquip(opt.key)}
                    className="rounded-xl p-4 text-center cursor-pointer border-0 transition-all"
                    style={{
                      background: active ? "rgba(255,92,53,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${active ? "rgba(255,92,53,0.4)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <opt.icon className="w-5 h-5 mx-auto mb-1" style={{ color: active ? "#FF5C35" : "#475569" }} />
                    <p className="text-xs font-bold" style={{ color: active ? "#FF5C35" : "#94A3B8" }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
            {equipment.dumbbells && (
              <div>
                <p className="text-xs text-slate-400 mb-2">What dumbbell weights do you have? (lbs, tap to toggle)</p>
                <div className="flex gap-2 flex-wrap">
                  {[15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(w => (
                    <button key={w} onClick={() => setDbWeights(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort((a, b) => a - b))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-0"
                      style={{
                        background: dbWeights.includes(w) ? "rgba(255,92,53,0.15)" : "rgba(255,255,255,0.04)",
                        color: dbWeights.includes(w) ? "#FF5C35" : "#64748B",
                        border: `1px solid ${dbWeights.includes(w) ? "rgba(255,92,53,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}>{w}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: "#FF5C35", color: "#fff" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2: Fitness level */}
        {step === 2 && (
          <motion.div key="fitness" className="w-full max-w-md space-y-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <h2 className="text-xl font-black text-white">Where are you at?</h2>
            <div className="space-y-2">
              {FITNESS_LEVELS.map(f => (
                <button key={f.key} onClick={() => setFitnessLevel(f.key)}
                  className="w-full rounded-xl p-4 text-left cursor-pointer border-0 transition-all"
                  style={{
                    background: fitnessLevel === f.key ? "rgba(255,92,53,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${fitnessLevel === f.key ? "rgba(255,92,53,0.4)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  <p className="text-sm font-bold" style={{ color: fitnessLevel === f.key ? "#FF5C35" : "#E2E8F0" }}>{f.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} disabled={!fitnessLevel}
              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: fitnessLevel ? "#FF5C35" : "#333", color: "#fff" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 3: Goals */}
        {step === 3 && (
          <motion.div key="goals" className="w-full max-w-md space-y-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <h2 className="text-xl font-black text-white">What are you training for?</h2>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => {
                const active = goals.includes(g.key);
                return (
                  <button key={g.key} onClick={() => toggleGoal(g.key)}
                    className="rounded-xl p-4 text-center cursor-pointer border-0 transition-all"
                    style={{
                      background: active ? "rgba(255,92,53,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${active ? "rgba(255,92,53,0.4)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <p className="text-sm font-bold" style={{ color: active ? "#FF5C35" : "#94A3B8" }}>{g.label}</p>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(3.5 as any)}
              className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
              style={{ background: "#FF5C35", color: "#fff" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 3.5: Body weight + strength baseline */}
        {step === 3.5 && (
          <motion.div key="strength" className="w-full max-w-md space-y-5"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ ease }}>
            <div>
              <h2 className="text-xl font-black text-white">Calibrate your loads</h2>
              <p className="text-xs text-slate-500 mt-1">Optional but makes your first workout way more accurate. Skip if unsure.</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">Your body weight (lbs)</p>
              <input type="number" placeholder="e.g. 180" value={bodyWeight}
                onChange={e => setBodyWeight(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm bg-transparent text-white"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">Heaviest dumbbell you can do 5 reps with (lbs per hand)</p>
              <div className="space-y-2">
                {[
                  { key: "db_front_squat", label: "Front squat" },
                  { key: "db_press", label: "Overhead press" },
                  { key: "db_row", label: "Bent-over row" },
                ].map(m => (
                  <div key={m.key} className="flex items-center gap-3">
                    <p className="text-xs text-slate-300 w-28">{m.label}</p>
                    <input type="number" placeholder="lbs" value={rm[m.key] || ""}
                      onChange={e => setRm(prev => ({ ...prev, [m.key]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                      style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 py-3.5 rounded-xl text-sm font-black cursor-pointer border-0"
                style={{ background: "#FF5C35", color: "#fff" }}>
                {saving ? "Setting up..." : "Build my first workout"}
              </button>
              <button onClick={() => { setStep(4); save(); }}
                className="px-4 py-3.5 rounded-xl text-sm cursor-pointer border-0"
                style={{ background: "rgba(255,255,255,0.04)", color: "#64748B", border: "1px solid rgba(255,255,255,0.06)" }}>
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: First plan reveal */}
        {step === 4 && (
          <motion.div key="reveal" className="w-full max-w-md text-center space-y-4"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease, duration: 0.6 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
              <Check className="w-12 h-12 mx-auto" style={{ color: "#C2FF4A" }} />
            </motion.div>
            <h2 className="text-2xl font-black text-white">You're in.</h2>
            <p className="text-sm text-slate-400">Your first workout is being built from your body data right now.</p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
              <a href="/today">
                <button className="px-8 py-3.5 rounded-xl text-sm font-black cursor-pointer border-0"
                  style={{ background: "#FF5C35", color: "#fff" }}>
                  See your workout
                </button>
              </a>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
