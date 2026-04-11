import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import WearableConnect from "@/components/WearableConnect";
import { LogOut, Dumbbell, Target, Check, Shield, Eye, Database, Lock, Activity } from "lucide-react";
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
  const [alerts, setAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("yu_alert_prefs");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { hrv_anomaly: true, sleep_debt: true, readiness_drop: true, overtraining: false };
  });

  const toggleAlert = (key: string) => {
    setAlerts(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("yu_alert_prefs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: "#0B1120" }}>
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(255,92,53,0.5)" }}>Configure</p>
        <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>Settings</h1>
      </div>

      {/* Profile */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 0%, rgba(255,92,53,0.06), transparent 70%)" }} />
        <p className="text-[9px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: "rgba(255,92,53,0.5)" }}>Account</p>
        <p className="text-base text-white font-bold">{user?.displayName || user?.email || "Athlete"}</p>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{user?.email}</p>
      </div>

      {/* Wearables — promoted to top */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(110,231,255,0.03)", border: "1px solid rgba(110,231,255,0.08)" }}>
        <WearableConnect />
      </div>

      {/* Privacy & Data Governance — moved above Equipment/Goals */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 0%, rgba(110,231,255,0.04), transparent 70%)" }} />
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" style={{ color: "#6EE7FF" }} />
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: "#6EE7FF" }}>Privacy & Data</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid rgba(15,26,46,0.5)" }}>
            <Database className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            <div className="flex-1">
              <p className="text-xs font-bold text-white mb-1">What we collect</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                Oura biometrics (HRV, sleep, readiness, activity), workout logs, check-in ratings, and hypothesis adherence. No location, contacts, or browsing data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid rgba(15,26,46,0.5)" }}>
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            <div className="flex-1">
              <p className="text-xs font-bold text-white mb-1">Where it lives</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                All data stored in Google Cloud (US-East1), encrypted at rest. Your biometric data is never shared with third parties or used for advertising.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid rgba(15,26,46,0.5)" }}>
            <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            <div className="flex-1">
              <p className="text-xs font-bold text-white mb-1">AI processing</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                Gemini generates workout plans and insights from your data. Your biometrics are sent to the model only at the moment of generation and are not retained by Google.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>Data retention</p>
            <p className="text-[10px] font-bold" style={{ color: "#6EE7FF" }}>Delete account erases all data</p>
          </div>
        </div>
      </div>

      {/* Equipment */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Equipment</p>
        <div className="grid grid-cols-3 gap-2">
          {EQUIPMENT_OPTIONS.map(opt => {
            const active = !!equipment[opt.key] && equipment[opt.key] !== false && (Array.isArray(equipment[opt.key]) ? equipment[opt.key].length > 0 : true);
            return (
              <button key={opt.key} onClick={() => toggleEquip(opt.key)}
                className="rounded-lg p-3 text-center cursor-pointer border-0 transition-all text-xs font-bold"
                style={{
                  background: active ? "rgba(255,92,53,0.12)" : "rgba(15,26,46,0.6)",
                  border: `1px solid ${active ? "rgba(255,92,53,0.3)" : "rgba(26,42,74,0.4)"}`,
                  color: active ? "#FF5C35" : "#64748B",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Goals</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => {
            const active = goals.includes(g.key);
            return (
              <button key={g.key} onClick={() => toggleGoal(g.key)}
                className="rounded-lg p-3 text-center cursor-pointer border-0 text-xs font-bold"
                style={{
                  background: active ? "rgba(255,92,53,0.12)" : "rgba(15,26,46,0.6)",
                  border: `1px solid ${active ? "rgba(255,92,53,0.3)" : "rgba(26,42,74,0.4)"}`,
                  color: active ? "#FF5C35" : "#64748B",
                }}>
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body Weight + Strength */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
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
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <InjuryFlag />
      </div>

      {/* Alert Thresholds */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(15,26,46,0.6)", border: "1px solid rgba(26,42,74,0.4)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4" style={{ color: "#FF5C35" }} />
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: "#FF5C35" }}>Alert thresholds</p>
        </div>
        <p className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
          YU only alerts you when something actually shifts — no scheduled notifications, no noise. Alerts trigger when a metric deviates 2+ standard deviations from your personal baseline.
        </p>
        <div className="space-y-3">
          {[
            { key: "hrv_anomaly", label: "HRV anomaly", desc: "When overnight HRV deviates significantly", color: "#6EE7FF" },
            { key: "sleep_debt", label: "Sleep debt", desc: "3+ nights under 6 hours", color: "#A78BFA" },
            { key: "readiness_drop", label: "Readiness drop", desc: "Readiness below 60 for 2+ days", color: "#C2FF4A" },
            { key: "overtraining", label: "Overtraining signal", desc: "HRV declining + high training load", color: "#FF5D6C" },
          ].map(alert => {
            const enabled = !!alerts[alert.key];
            return (
              <button key={alert.key} onClick={() => toggleAlert(alert.key)}
                className="flex items-center justify-between py-2 w-full border-0 bg-transparent cursor-pointer"
                style={{ borderBottom: "1px solid rgba(15,26,46,0.5)" }}>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-2 h-2 rounded-full" style={{ background: alert.color }} />
                  <div>
                    <p className="text-xs font-bold text-white">{alert.label}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{alert.desc}</p>
                  </div>
                </div>
                <div className="w-9 h-5 rounded-full relative transition-all flex-shrink-0" style={{
                  background: enabled ? `${alert.color}30` : "rgba(26,42,74,0.4)",
                }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{
                    background: enabled ? alert.color : "rgba(255,255,255,0.2)",
                    left: enabled ? "18px" : "2px",
                  }} />
                </div>
              </button>
            );
          })}
        </div>
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
