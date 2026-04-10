import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import WearableConnect from "@/components/WearableConnect";
import { LogOut, Dumbbell, Target, Check } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile?.equipment) setEquipment(profile.equipment);
    if (profile?.goals) setGoals(profile.goals);
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
    await api.post("/api/identity/register", {
      user_id: user.uid,
      display_name: user.displayName || profile?.display_name || "Athlete",
      equipment,
      fitness_level: profile?.fitness_level || "intermediate",
      goals,
    });
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: "#0a0b0d" }}>
      <h1 className="text-2xl font-black text-white mb-6">Settings</h1>

      {/* Profile */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Account</p>
        <p className="text-sm text-white font-bold">{user?.displayName || user?.email || "Athlete"}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{user?.email}</p>
      </div>

      {/* Equipment */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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

      {/* Save */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0 mb-4 flex items-center justify-center gap-2"
        style={{ background: saved ? "rgba(194,255,74,0.15)" : "#FF5C35", color: saved ? "#C2FF4A" : "#fff" }}>
        {saving ? "Saving..." : saved ? <><Check className="w-4 h-4" /> Saved</> : "Save changes"}
      </button>

      {/* Wearables */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <WearableConnect />
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
