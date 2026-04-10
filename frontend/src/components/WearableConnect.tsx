import { useState } from "react";
import { motion } from "framer-motion";
import { Watch, Check, Loader2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

const PROVIDERS = [
  {
    id: "oura",
    name: "Oura Ring",
    desc: "Sleep, HRV, readiness, stress",
    color: "#A78BFA",
    connectUrl: null, // Already connected via token
    tier: "T0",
  },
  {
    id: "apple_hk",
    name: "Apple Watch",
    desc: "HRV, heart rate, sleep, activity",
    color: "#FF5C35",
    connectUrl: null, // Via companion app or Terra
    tier: "T0",
  },
  {
    id: "whoop",
    name: "Whoop",
    desc: "Strain, recovery, sleep",
    color: "#4ADE80",
    connectUrl: null,
    tier: "T0 (coming soon)",
  },
  {
    id: "garmin",
    name: "Garmin",
    desc: "Training load, VO2max, sleep",
    color: "#60A5FA",
    connectUrl: null,
    tier: "T1 (coming soon)",
  },
];

export default function WearableConnect({ onDone }: { onDone?: () => void }) {
  const [connected, setConnected] = useState<Record<string, boolean>>({ oura: true }); // Oura already connected
  const [syncing, setSyncing] = useState<string | null>(null);

  const syncOura = async () => {
    setSyncing("oura");
    try {
      await api.post("/api/wearable/sync/oura");
      setConnected(prev => ({ ...prev, oura: true }));
    } catch {}
    setSyncing(null);
  };

  const connectAppleHK = async () => {
    setSyncing("apple_hk");
    // In production, this would deep-link to the companion iOS app
    // or open a Terra/Vital OAuth flow. For now, show the instruction.
    setTimeout(() => {
      setConnected(prev => ({ ...prev, apple_hk: true }));
      setSyncing(null);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">Connect your wearable</h3>
        <p className="text-xs text-slate-500 mt-1">We read your data. We never write to your device.</p>
      </div>

      <div className="space-y-2">
        {PROVIDERS.map((p) => {
          const isConnected = connected[p.id];
          const isSyncing = syncing === p.id;
          const isAvailable = p.id === "oura" || p.id === "apple_hk";

          return (
            <motion.div
              key={p.id}
              className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer"
              style={{
                background: isConnected ? `${p.color}08` : "rgba(255,255,255,0.02)",
                border: `1.5px solid ${isConnected ? `${p.color}30` : "rgba(255,255,255,0.06)"}`,
                opacity: isAvailable ? 1 : 0.5,
              }}
              whileHover={isAvailable ? { scale: 1.01 } : {}}
              onClick={() => {
                if (!isAvailable || isConnected) return;
                if (p.id === "oura") syncOura();
                if (p.id === "apple_hk") connectAppleHK();
              }}
            >
              <Watch className="w-5 h-5 flex-shrink-0" style={{ color: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  {isConnected && <Check className="w-3.5 h-3.5" style={{ color: "#C2FF4A" }} />}
                  {!isAvailable && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#64748B" }}>{p.tier}</span>}
                </div>
                <p className="text-[10px] text-slate-500">{p.desc}</p>
              </div>
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin" style={{ color: p.color }} />}
              {isAvailable && !isConnected && !isSyncing && <ExternalLink className="w-4 h-4 text-slate-600" />}
            </motion.div>
          );
        })}
      </div>

      {onDone && (
        <button onClick={onDone}
          className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer border-0"
          style={{ background: "#FF5C35", color: "#fff" }}>
          Continue
        </button>
      )}
    </div>
  );
}
