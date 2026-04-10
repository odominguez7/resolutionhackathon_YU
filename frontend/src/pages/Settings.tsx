import { useAuth } from "@/contexts/AuthContext";
import WearableConnect from "@/components/WearableConnect";
import { LogOut } from "lucide-react";

export default function Settings() {
  const { user, profile, logout } = useAuth();

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: "#0a0b0d" }}>
      <h1 className="text-2xl font-black text-white mb-6">Settings</h1>

      {/* Profile */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Account</p>
        <p className="text-sm text-white font-bold">{user?.displayName || user?.email || "Athlete"}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{user?.email}</p>
        {profile && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,92,53,.1)", color: "#FF5C35" }}>{profile.fitness_level}</span>
            {(profile.goals || []).map((g: string) => (
              <span key={g} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.04)", color: "#94A3B8" }}>{g}</span>
            ))}
          </div>
        )}
      </div>

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
