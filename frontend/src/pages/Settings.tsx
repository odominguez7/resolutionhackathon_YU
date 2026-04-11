import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import WearableConnect from "@/components/WearableConnect";
import { LogOut, Dumbbell, Target, Check } from "lucide-react";
import InjuryFlag from "@/components/InjuryFlag";
import { api } from "@/lib/api";

const EQUIPMENT_OPTIONS = [
  { key: "dumbbells", label: "Dumbbells" },
  { key: "treadmill", label: "Treadmill" },
  { key: "pull_up_bar", label: "Pull-up bar" },
  { key: "barbell", label: "Barbell" },
  { key: "bench", label: "Bench" },
  { key: "kettlebell", label: "Kettlebell" },
  { key: "box", label: "Box / Step" },
  { key: "rings", label: "Rings" },
  { key: "rower", label: "Rower" },
];

const GOALS = [
  { key: "strength", label: "Get stronger" },
  { key: "conditioning", label: "Better cardio" },
  { key: "hybrid", label: "Both" },
  { key: "longevity", label: "Long-term health" },
];

export default function Settings() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [equipment, setEquipment] = useState<Record<string, any>>({});
  const [goals, setGoals] = useState<string[]>([]);
  const [bodyWeight, setBodyWeight] = useState("");
  const [rm, setRm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile?.equipment) setEquipment(profile.equipment);
    if (profile?.goals) setGoals(profile.goals);
    if (profile?.body_weight_lbs) setBodyWeight(String(profile.body_weight_lbs));
    if (profile?.estimated_1rm) {
      const rmStrings: Record<string, string> = {};
      for (const [k, v] of Object.entries(profile.estimated_1rm)) {
        rmStrings[k] = String(v);
      }
      setRm(rmStrings);
    }
  }, [profile]);

  const toggleEquip = (key: string) => {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const toggleGoal = (key: string) => {
    setGoals(prev => prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]);
    setSaved(false);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const est1rm: Record<string, number> = {};
    for (const [k, v] of Object.entries(rm)) {
      if (v) est1rm[k] = parseInt(v) || 0;
    }
    await api.post("/api/identity/register", {
      user_id: user.uid,
      display_name: user.displayName || profile?.display_name || "Athlete",
      equipment,
      fitness_level: profile?.fitness_level || "intermediate",
      goals,
      body_weight_lbs: bodyWeight ? parseInt(bodyWeight) : null,
      estimated_1rm: est1rm,
    });
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: "#0a0b0d" }}>
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Configure</p>
        <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>Settings</h1>
      </div>

      {/* Profile */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 0%, rgba(255,92,53,0.06), transparent 70%)" }} />
        <p className="text-[9px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: "rgba(255,92,53,0.5)" }}>Account</p>
        <p className="text-base text-white font-bold">{user?.displayName || user?.email || "Athlete"}</p>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{user?.email}</p>
      </div>

      {/* Wearables — promoted to top */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(110,231,255,0.03)", border: "1px solid rgba(110,231,255,0.08)" }}>
        <WearableConnect />
      </div>

      {/* Equipment */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Equipment</p>
        <div className="grid grid-cols-3 gap-2">
          {EQUIPMENT_OPTIONS.map(opt => {
            const active = !!equipment[opt.key] && equipment[opt.key] !== false && (Array.isArray(equipment[opt.key]) ? equipment[opt.key].length > 0 : true);
            return (
              <button key={opt.key} onClick={() => toggleEquip(opt.key)}
                className="rounded-lg p-3 text-center cursor-pointer border-0 transition-all text-xs font-bold"
                style={{
                  background: active ? "rgba(255,92,53,0.12)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? "rgba(255,92,53,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#FF5C35" : "#64748B",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Goals</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => {
            const active = goals.includes(g.key);
            return (
              <button key={g.key} onClick={() => toggleGoal(g.key)}
                className="rounded-lg p-3 text-center cursor-pointer border-0 text-xs font-bold"
                style={{
                  background: active ? "rgba(255,92,53,0.12)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? "rgba(255,92,53,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#FF5C35" : "#64748B",
                }}>
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body Weight + Strength */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Body Weight + Strength Calibration</p>
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 mb-1">Body weight (lbs)</p>
          <input type="number" placeholder="e.g. 180" value={bodyWeight}
            onChange={e => { setBodyWeight(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
        </div>
        <p className="text-[10px] text-slate-400 mb-2">Heaviest dumbbell for 5 reps (lbs per hand)</p>
        <div className="space-y-2">
          {[
            { key: "db_front_squat", label: "Front squat" },
            { key: "db_press", label: "Overhead press" },
            { key: "db_row", label: "Bent-over row" },
          ].map(m => (
            <div key={m.key} className="flex items-center gap-3">
              <p className="text-xs text-slate-300 w-28">{m.label}</p>
              <input type="number" placeholder="lbs" value={rm[m.key] || ""}
                onChange={e => { setRm(prev => ({ ...prev, [m.key]: e.target.value })); setSaved(false); }}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent text-white"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          ))}
        </div>
        <p className="text-[9px] text-slate-600 mt-2">These calibrate your first workout loads. The system adjusts automatically from there.</p>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving}
        className="w-full py-4 rounded-2xl text-sm font-bold cursor-pointer border-0 mb-4 flex items-center justify-center gap-2 transition-all duration-200"
        style={{ background: saved ? "rgba(194,255,74,0.15)" : "linear-gradient(135deg, #FF5C35, #FF8040)", color: saved ? "#C2FF4A" : "#fff", boxShadow: saved ? "none" : "0 8px 32px rgba(255,92,53,0.2)" }}>
        {saving ? "Saving..." : saved ? <><Check className="w-4 h-4" /> Saved</> : "Save changes"}
      </button>

      {/* Injury flags */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <InjuryFlag />
      </div>

      {/* Sign out */}
      <button onClick={logout}
        className="w-full py-3 rounded-xl text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
        style={{ background: "rgba(239,68,68,.08)", color: "#F87171", border: "1px solid rgba(239,68,68,.15)" }}>
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}
