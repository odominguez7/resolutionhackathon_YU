import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";

const BODY_PARTS: { key: string; label: string; movements: string[] }[] = [
  { key: "shoulder", label: "Shoulder", movements: ["strict press", "push press", "arnold press", "lateral raise", "z-press", "push jerk", "db overhead squat"] },
  { key: "knee", label: "Knee", movements: ["jump squat", "jump lunge", "tuck jump", "broad jump", "skater jump", "box jump"] },
  { key: "lower_back", label: "Lower back", movements: ["db deadlift", "db romanian deadlift", "good morning", "barbell back squat"] },
  { key: "wrist", label: "Wrist", movements: ["push-up", "hand-release push-up", "diamond push-up", "man maker", "devil press"] },
  { key: "ankle", label: "Ankle", movements: ["jump squat", "broad jump", "lateral lunge", "skater jump"] },
  { key: "elbow", label: "Elbow", movements: ["strict pull-up", "chin-up", "bicep curl", "skull crusher"] },
];

export default function InjuryFlag({ onUpdate }: { onUpdate?: () => void }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/oura/workout/competency").then(d => setBlocked(d?.blocked || [])).catch(() => {});
  }, []);

  const toggleInjury = async (part: typeof BODY_PARTS[0]) => {
    setSaving(true);
    const isBlocked = part.movements.some(m => blocked.includes(m));
    if (isBlocked) {
      // Unblock all movements for this body part
      for (const m of part.movements) {
        if (blocked.includes(m)) {
          await api.post("/api/oura/workout/competency/unblock", { movement_name: m });
        }
      }
    } else {
      // Block all movements for this body part
      for (const m of part.movements) {
        await api.post("/api/oura/workout/competency/block", { movement_name: m, reason: `${part.label} injury` });
      }
    }
    const updated = await api.get("/api/oura/workout/competency");
    setBlocked(updated?.blocked || []);
    setSaving(false);
    onUpdate?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" style={{ color: "#FFC36B" }} />
        <p className="text-xs font-black text-white uppercase tracking-wider">Flag an injury</p>
      </div>
      <p className="text-[10px] text-slate-500">Tap a body part to block movements that stress it. The system will program around your injury.</p>
      <div className="grid grid-cols-3 gap-2">
        {BODY_PARTS.map(part => {
          const isInjured = part.movements.some(m => blocked.includes(m));
          return (
            <button key={part.key} onClick={() => toggleInjury(part)} disabled={saving}
              className="rounded-lg p-3 text-center cursor-pointer border-0 transition-all"
              style={{
                background: isInjured ? "rgba(255,93,108,0.12)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isInjured ? "rgba(255,93,108,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}>
              <p className="text-xs font-bold" style={{ color: isInjured ? "#FF5D6C" : "#64748B" }}>{part.label}</p>
              {isInjured && <p className="text-[8px] mt-0.5" style={{ color: "#FF5D6C" }}>injured</p>}
            </button>
          );
        })}
      </div>
      {blocked.length > 0 && (
        <p className="text-[9px] text-slate-500">{blocked.length} movement{blocked.length !== 1 ? "s" : ""} blocked</p>
      )}
    </div>
  );
}
