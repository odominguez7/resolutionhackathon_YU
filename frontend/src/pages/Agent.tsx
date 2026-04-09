import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Heart, Target, Moon, Zap, ArrowRight, Check, RefreshCw, X, Share2 } from "lucide-react";

/* ── YU brand tokens (mirrors yu.boston) ─────────────── */
const YU = {
  bg: "#FFFFFF",
  bgSoft: "#F8FAFC",
  ink: "#1C2B3A",
  body: "#374151",
  muted: "#6B7280",
  label: "#9CA3AF",
  line: "#E5E7EB",
  teal: "#00BFA6",
  amber: "#F59E0B",
  indigo: "#6366F1",
  red: "#E5484D",
};
const display = "'Space Grotesk', sans-serif";
const sans = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const SPECIALIST_ICONS: Record<string, any> = { heart: Heart, readiness: Target, sleep: Moon, stress: Zap };
function computeBaselineTrend(history?: number[], lowerIsWorse?: boolean): BaselineTrend | null {
  if (!history || history.length < 4) return null;
  const window = 7;
  const rolling = history.map((_, i) => {
    const lo = Math.max(0, i - window + 1);
    const chunk = history.slice(lo, i + 1);
    return Math.round((chunk.reduce((s, n) => s + n, 0) / chunk.length) * 10) / 10;
  });
  const early = rolling.length >= 7 ? rolling.slice(0, 7).reduce((s, n) => s + n, 0) / 7 : rolling[0];
  const late = rolling.length >= 7 ? rolling.slice(-7).reduce((s, n) => s + n, 0) / 7 : rolling[rolling.length - 1];
  const rawDelta = Math.round((late - early) * 10) / 10;
  // For lower_is_worse=false (stress), an upward raw trend is BAD. Invert visible direction.
  const visible = (lowerIsWorse ?? true) ? rawDelta : -rawDelta;
  let direction: "up" | "flat" | "down" = "flat";
  if (Math.abs(visible) >= 0.5) direction = visible > 0 ? "up" : "down";
  return {
    target_metric: "",
    values: history,
    rolling,
    delta: visible,
    direction,
    days: history.length,
  };
}

const STATE_GLYPH: Record<string, string> = { locked: "◆", loaded: "▲", steady: "●", compressed: "▼", depleted: "◉", insufficient: "·" };
const STATE_LABEL: Record<string, string> = { locked: "Locked", loaded: "Loaded", steady: "Steady", compressed: "Compressed", depleted: "Depleted", insufficient: "Gathering" };
// F7 verbatim share lines from the YU intelligence document. Never paraphrase.
const F7_LINE: Record<string, [string, string]> = {
  locked:     ["Locked.", "Body absorbed the week. Big calls before noon."],
  loaded:     ["Loaded.", "High week, absorbing well. Not adding meetings."],
  steady:     ["Steady.", "Execution day. Moving through the list."],
  compressed: ["Compressed.", "Moving the 3pm to Thursday, not the day for the big call."],
  depleted:   ["Depleted.", "Recovery day. My team sees my best when I come back sharp."],
};
const SHAREABLE_STATES = new Set(["locked", "loaded", "compressed", "depleted"]);
const PITCH = "Metrics are for spreadsheets, moods are for people. YU know the difference.";

type AgentState = "locked" | "loaded" | "steady" | "compressed" | "depleted" | "insufficient";
interface Spokesperson {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  state: AgentState;
  state_label?: string;
  state_glyph?: string;
  state_copy?: string;
  metric_label?: string;
  today_value?: number;
  baseline_mean?: number;
  delta_pct?: number;
  z_score?: number;
  history?: number[];
  lower_is_worse?: boolean;
  mystery: string;
}
interface Listening {
  id: string;
  title: string;
  color: string;
  state: AgentState;
  state_label?: string;
  state_glyph?: string;
  state_copy?: string;
  today_value?: number;
  baseline_mean?: number;
  delta_pct?: number;
  metric_label?: string;
  lower_is_worse?: boolean;
  history?: number[];
}
interface GoalDay {
  date: string;
  status: "yes" | "partial" | "no" | "pending" | "skipped";
}
interface Goal {
  goal: {
    persona: string;
    behavior: string;
    duration_days: number;
    target_metric: string;
    target_metric_label: string;
    started_on: string;
    baseline_at_start?: number;
  };
  persona: { id: string; label: string; frame: string; voice_rule: string };
  day_index: number;
  duration: number;
  days: GoalDay[];
  complete: boolean;
  baseline_at_start?: number;
  today_value?: number;
  running_delta?: number;
  running_delta_pct?: number;
  direction?: number;
}
interface ArchivedHypothesis {
  behavior: string;
  target_metric_label: string;
  duration_days: number;
  started_on: string;
  ended_on: string;
  baseline_at_start?: number;
  ended_value?: number;
  verdict: { label: "confirmed" | "inconclusive" | "weakened"; delta?: number; delta_pct?: number };
}
interface BaselineTrend {
  target_metric: string;
  values: number[];
  rolling: number[];
  delta: number | null;
  direction: "up" | "flat" | "down";
  days?: number;
}
interface Ritual {
  user: string;
  goal: Goal;
  spokesperson: Spokesperson;
  listening: Listening[];
  baseline_trend?: BaselineTrend;
}
interface RevealedCard {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  metric_label: string;
  today_value?: number;
  baseline_mean?: number;
  delta_pct?: number;
  lower_is_worse?: boolean;
  history?: number[];
  data_line: string;
  narrative: string;
  implication: string;
  action_label: string;
  actionable: boolean;
  source?: string;
  notification?: { sent: boolean; mode: string; would_send?: string; message?: string; missing?: string[] };
}

export default function Agent() {
  const [ritual, setRitual] = useState<Ritual | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [card, setCard] = useState<RevealedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [closed, setClosed] = useState<RevealedCard | null>(null);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [dailyDone, setDailyDone] = useState(false);
  const [shareAgent, setShareAgent] = useState<any | null>(null);
  const DAILY_DONE_KEY = "yu_daily_done";

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const STORAGE_KEY = "yu_daily_state_v2";

  const load = async () => {
    try {
      const r = await api.get("/api/agent/ritual");
      setRitual(r);
      setActiveAgentId(r.spokesperson.id);
      // Restore today's mood + revealed card if it's the same day
      try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (cached && cached.date === todayKey()) {
          setMood(cached.mood);
          if (cached.agent_id === r.spokesperson.id && cached.card) {
            setCard(cached.card);
            setRevealed(true);
          }
        }
        const done = JSON.parse(localStorage.getItem(DAILY_DONE_KEY) || "null");
        if (done && done.date === todayKey()) setDailyDone(true);
      } catch {}
    } catch (e) {}
  };

  useEffect(() => {
    load();
  }, []);

  const reveal = async (score: number) => {
    if (!activeAgentId) return;
    setMood(score);
    setLoading(true);
    try {
      const res = await api.post(`/api/agent/specialists/${activeAgentId}/reveal`, { mood_score: score });
      setCard(res);
      setRevealed(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), agent_id: activeAgentId, mood: score, card: res }));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!activeAgentId || mood == null) return;
    setApproving(true);
    try {
      const res = await api.post(`/api/agent/specialists/${activeAgentId}/approve`, { mood_score: mood });
      setClosed(res);
    } finally {
      setApproving(false);
    }
  };

  const logAdherence = async (value: "yes" | "partial" | "no") => {
    await api.post("/api/agent/goal/adherence", { value });
    load();
  };

  const swapSpokesperson = async (id: string) => {
    setActiveAgentId(id);
    setRevealed(false);
    setCard(null);
    setClosed(null);
    setDailyDone(false); // peek breaks the rest state without reopening it on reload
    // Mood is the user's state, not the agent's — keep it across swaps within a day
    // and auto-reveal the new agent's card immediately if mood is already known.
    if (mood != null) {
      setLoading(true);
      try {
        const res = await api.post(`/api/agent/specialists/${id}/reveal`, { mood_score: mood });
        setCard(res);
        setRevealed(true);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!ritual) {
    return (
      <div style={{ minHeight: "100vh", background: YU.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, color: YU.muted }}>
        <RefreshCw size={20} className="animate-spin" />
      </div>
    );
  }

  const sp = ritual.spokesperson.id === activeAgentId
    ? ritual.spokesperson
    : ({ ...ritual.spokesperson, id: activeAgentId } as Spokesperson);
  const SpIcon = SPECIALIST_ICONS[sp.id] || Heart;
  const dayPct = Math.round((ritual.goal.day_index / ritual.goal.duration) * 100);
  const adherenceCount = ritual.goal.days.filter((d) => d.status === "yes").length;

  return (
    <div style={{ minHeight: "100vh", background: YU.bg, color: YU.body, fontFamily: sans, position: "relative" }}>
      {/* Anomaly accent: a thin colored ribbon at the very top when any agent is in act */}
      {(() => {
        const allAgents = [ritual.spokesperson, ...ritual.listening] as any[];
        const acting = allAgents.find((a) => a.state === "depleted");
        if (!acting) return null;
        return (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: acting.color, opacity: 0.85 }} />
        );
      })()}
      <style>{`
        @keyframes yuFade { from {opacity:0} to {opacity:1} }
        @keyframes yuRise { from {opacity:0;transform:translateY(14px)} to {opacity:1;transform:none} }
        @keyframes yuBreath { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.08);opacity:1} }
        @keyframes yuPipBreath { 0%,100%{opacity:0.75} 50%{opacity:1} }
        .yu-rise { animation: yuRise .55s cubic-bezier(.2,.8,.2,1) both; }
        .yu-pip-active { animation: yuPipBreath 2.4s ease-in-out infinite; }
        .yu-stat-pill:hover { border-color: var(--c) !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(28,43,58,.06); }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 96px" }}>
        {/* ── 1. Persona chip + tests ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: YU.bgSoft, border: `1px solid ${YU.line}`, fontSize: 12, fontWeight: 600, color: YU.ink }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: YU.teal }} />
            {ritual.goal.persona.label}
          </span>
          <button
            onClick={() => setShowGoalEdit(true)}
            style={{ background: "transparent", border: 0, color: YU.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: sans, padding: "8px 4px" }}
          >
            your tests
          </button>
        </div>

        {/* ── Council stat row (Oura-style) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 32 }}>
          {[ritual.spokesperson, ...ritual.listening].sort((a: any, b: any) => {
            const order = ["heart", "readiness", "sleep", "stress"];
            return order.indexOf(a.id) - order.indexOf(b.id);
          }).map((agent: any) => {
            const Icon = SPECIALIST_ICONS[agent.id];
            const isActive = agent.id === activeAgentId;
            const isSpokes = agent.id === ritual.spokesperson.id;
            const fullEval = isSpokes ? ritual.spokesperson : agent;
            const value = (fullEval as any).today_value;
            const rawDelta = (fullEval as any).delta_pct ?? 0;
            const lwi = (fullEval as any).lower_is_worse ?? true;
            const delta = lwi ? rawDelta : -rawDelta;
            const isImprovement = delta === 0 ? null : delta > 0;
            const dirColor = isImprovement === null ? YU.muted : isImprovement ? YU.teal : "#E5484D";
            const dirArrow = isImprovement === null ? "•" : isImprovement ? "▲" : "▼";
            const labels: Record<string, string> = { heart: "HRV", readiness: "Readiness", sleep: "Sleep", stress: "Stress" };
            const units: Record<string, string> = { heart: "ms", readiness: "", sleep: "", stress: "min" };
            const label = labels[agent.id] || agent.title;
            const unit = units[agent.id] || "";
            const canShare = SHAREABLE_STATES.has((fullEval as any).state);
            return (
              <div
                key={agent.id}
                style={{ position: "relative" }}
              ><button
                className="yu-stat-pill"
                onClick={() => swapSpokesperson(agent.id)}
                style={{
                  ["--c" as any]: agent.color,
                  background: isActive ? `${agent.color}08` : "#fff",
                  border: `1px solid ${isActive ? agent.color : YU.line}`,
                  borderRadius: 16,
                  padding: "12px 12px 10px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: sans,
                  transition: "all .18s ease",
                  width: "100%",
                }}
              >
                <Icon size={14} style={{ color: agent.color }} />
                <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, lineHeight: 1, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                  {value != null ? Math.round(value) : "—"}
                  {value != null && unit && <span style={{ fontSize: 10, fontWeight: 500, color: YU.muted, marginLeft: 1 }}>{unit}</span>}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: YU.label, textTransform: "uppercase", letterSpacing: "1px" }}>
                  {label}
                </span>
                {(fullEval as any).state_label && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 10, fontWeight: 700, color: dirColor }}>
                    <span style={{ fontSize: 11 }}>{(fullEval as any).state_glyph}</span>
                    {(fullEval as any).state_label}
                  </span>
                )}
              </button>
              {canShare && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShareAgent(fullEval); }}
                  title="Share this state"
                  aria-label="Share this state"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#fff",
                    border: `1px solid ${YU.line}`,
                    color: YU.muted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "all .15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = agent.color; e.currentTarget.style.color = agent.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = YU.line; e.currentTarget.style.color = YU.muted; }}
                >
                  <Share2 size={11} />
                </button>
              )}
              </div>
            );
          })}
        </div>

        {/* ── 2. Goal banner ── */}
        <div className="yu-rise" style={{ borderTop: `1px solid ${YU.line}`, borderBottom: `1px solid ${YU.line}`, padding: "26px 0", marginBottom: 56, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 10px" }}>
            Active hypothesis · Day {ritual.goal.day_index} of {ritual.goal.duration}
          </p>
          <p style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: "0 0 6px", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            {ritual.goal.goal.behavior}
          </p>
          <p style={{ fontSize: 13, color: YU.muted, margin: "0 0 18px" }}>
            does it move your {ritual.goal.goal.target_metric_label}?
            {ritual.goal.baseline_at_start != null && (
              <span style={{ marginLeft: 8, color: YU.label }}>· starting line {Math.round(ritual.goal.baseline_at_start)}</span>
            )}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {ritual.goal.days.map((d, i) => {
              const isToday = i + 1 === ritual.goal.day_index;
              const isPast = i + 1 < ritual.goal.day_index;
              if (isPast || d.status === "yes" || d.status === "partial" || d.status === "no") {
                const fill = d.status === "yes" ? YU.teal : d.status === "partial" ? YU.amber : d.status === "no" ? YU.red : YU.line;
                return <div key={d.date} style={{ flex: 1, height: 6, borderRadius: 3, background: fill }} />;
              }
              if (isToday) {
                return <div key={d.date} className="yu-pip-active" style={{ flex: 1, height: 6, borderRadius: 3, background: YU.teal }} />;
              }
              // future = subtle teal-tinted dot, not gray bar
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: `${YU.teal}30` }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 12, gap: 16 }}>
            <p style={{ fontSize: 12, color: YU.muted, margin: 0 }}>
              {ritual.goal.day_index === 1 && adherenceCount === 0
                ? "Day 1"
                : `${adherenceCount} of ${ritual.goal.day_index - 1} nights held`}
            </p>
            {ritual.goal.day_index > 1 && ritual.goal.running_delta != null && (() => {
              const dir = ritual.goal.direction || 1;
              const isGood = (ritual.goal.running_delta || 0) * dir > 0;
              const arrow = (ritual.goal.running_delta || 0) > 0 ? "+" : "";
              return (
                <p style={{ fontSize: 12, fontWeight: 600, color: isGood ? YU.teal : YU.muted, margin: 0, fontFamily: sans }}>
                  {arrow}{Math.round(ritual.goal.running_delta || 0)} vs your starting line
                </p>
              );
            })()}
          </div>
        </div>

        {/* ── 3. Mystery card / reveal / closed ── */}
        {/* Baseline trend — computed per active agent from its history */}
        {(() => {
          const activeFull: any = sp.id === ritual.spokesperson.id
            ? ritual.spokesperson
            : ritual.listening.find((l: any) => l.id === activeAgentId);
          const trend = computeBaselineTrend(activeFull?.history, activeFull?.lower_is_worse);
          if (!trend) return null;
          const metricLabel = activeFull?.metric_label || "";
          return <BaselineTrendChart trend={trend} metricLabel={metricLabel} agent={activeFull} />;
        })()}

        {!revealed && !closed && !dailyDone && (
          <div className="yu-rise" style={{ textAlign: "center", marginBottom: 56, padding: "32px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: sp.color, margin: "0 0 16px" }}>
              {sp.state_glyph} {sp.subtitle} · {sp.state_label}
            </p>
            <p style={{ fontSize: 13, color: YU.label, margin: "0 0 8px" }}>Hello {ritual.user}</p>
            <h1 style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(34px, 5vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.02em", color: YU.ink, margin: "0 auto 48px", maxWidth: 620 }}>
              {sp.mystery}
            </h1>

            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 18px" }}>
              first, how do you actually feel
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10, maxWidth: 460, margin: "0 auto 10px" }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => reveal(n)}
                  disabled={loading}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "50%",
                    border: `1px solid ${mood === n ? sp.color : YU.line}`,
                    background: mood === n ? sp.color : "#fff",
                    color: mood === n ? "#fff" : YU.ink,
                    fontFamily: sans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? "wait" : "pointer",
                    transition: "all .15s ease",
                    boxShadow: mood === n ? `0 4px 14px ${sp.color}40` : "none",
                  }}
                  onMouseEnter={(e) => { if (mood !== n) { e.currentTarget.style.borderColor = sp.color; e.currentTarget.style.transform = "scale(1.08)"; } }}
                  onMouseLeave={(e) => { if (mood !== n) { e.currentTarget.style.borderColor = YU.line; e.currentTarget.style.transform = "none"; } }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 480, margin: "0 auto", fontSize: 11, color: YU.label }}>
              <span>drained</span>
              <span>peak</span>
            </div>
            {loading && (
              <p style={{ marginTop: 28, fontSize: 13, color: YU.muted }}>
                <RefreshCw size={14} className="animate-spin" style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                Reading your data
              </p>
            )}
          </div>
        )}

        {revealed && card && !closed && !dailyDone && (() => {
          const CardIcon = SPECIALIST_ICONS[card.id] || Heart;
          const cc = card.color;
          // Direction: improvement = (delta_pct sign) aligned with (lower_is_worse)
          const rawDelta = card.delta_pct ?? 0;
          const lwi = card.lower_is_worse ?? true;
          // Visible delta: when lower_is_worse=false (e.g. stress), invert sign so user sees +50% better
          const delta = lwi ? rawDelta : -rawDelta;
          const isImprovement = delta > 0;
          const dirColor = delta === 0 ? YU.muted : isImprovement ? YU.teal : "#E5484D";
          const arrow = delta === 0 ? "→" : isImprovement ? "▲" : "▼";
          return (
          <div className="yu-rise" style={{ marginBottom: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cc}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CardIcon size={20} style={{ color: cc }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: cc, margin: 0 }}>
                  {card.subtitle}
                </p>
                <p style={{ fontSize: 12, color: YU.label, margin: "2px 0 0" }}>{card.metric_label}</p>
              </div>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: `${dirColor}10`, border: `1px solid ${dirColor}30`, color: dirColor, fontSize: 12, fontWeight: 700, fontFamily: sans }}>
                <span style={{ fontSize: 13 }}>{(card as any).state_glyph}</span>
                {(card as any).state_label}
                <span style={{ fontSize: 10, color: YU.muted, fontWeight: 500, marginLeft: 2 }}>{delta > 0 ? "+" : ""}{Math.round(delta)}%</span>
              </span>
            </div>
            {(card as any).state_copy && (
              <p style={{ fontFamily: display, fontSize: 17, fontWeight: 600, color: cc, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
                {(card as any).state_copy}
              </p>
            )}
            <h2 style={{ fontFamily: display, fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 700, lineHeight: 1.18, color: YU.ink, margin: "0 0 22px", letterSpacing: "-0.01em" }}>
              {card.data_line}
            </h2>

            {/* 14-day history sparkline */}
            {card.history && card.history.length >= 2 && (
              <HistoryChart values={card.history} baseline={card.baseline_mean} color={cc} lowerIsWorse={lwi} />
            )}

            <p style={{ fontSize: 17, color: YU.body, lineHeight: 1.6, margin: "20px 0 22px" }}>
              {card.narrative}
            </p>
            {card.implication && (
              <div style={{ borderLeft: `3px solid ${cc}`, paddingLeft: 18, margin: "28px 0" }}>
                <p style={{ fontSize: 17, color: YU.ink, fontWeight: 500, lineHeight: 1.55, margin: 0 }}>
                  {card.implication}
                </p>
              </div>
            )}
            {card.actionable ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginTop: 36 }}>
                <button
                  onClick={() => {
                    try { localStorage.setItem(DAILY_DONE_KEY, JSON.stringify({ date: todayKey() })); } catch {}
                    setDailyDone(true);
                  }}
                  style={{ background: "transparent", border: 0, color: YU.muted, fontSize: 14, fontFamily: sans, cursor: "pointer", padding: "14px 18px" }}
                >
                  Not now
                </button>
                <button
                  onClick={approve}
                  disabled={approving}
                  style={{
                    background: card.color,
                    color: "#fff",
                    border: 0,
                    padding: "18px 32px",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: sans,
                    cursor: approving ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: `0 8px 24px ${card.color}30`,
                    transition: "all .2s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 12px 28px ${card.color}40`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}30`; }}
                >
                  {approving ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {card.action_label || "Send to Telegram"}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: YU.muted, textAlign: "center", marginTop: 36 }}>
                Your baseline is stable. Nothing to act on. Come back tomorrow.
              </p>
            )}
          </div>
          );
        })()}

        {closed && !dailyDone && (
          <ClosedState
            sp={sp}
            ritual={ritual}
            closed={closed}
            adherenceCount={adherenceCount}
            onLogAdherence={logAdherence}
            onDismiss={() => {
              try { localStorage.setItem(DAILY_DONE_KEY, JSON.stringify({ date: todayKey() })); } catch {}
              setDailyDone(true);
            }}
          />
        )}

        {dailyDone && (
          <DoneForToday sp={sp} ritual={ritual} />
        )}

      </div>

      {/* ── Share state modal ── */}
      {shareAgent && (
        <ShareStateModal agent={shareAgent} ritual={ritual} onClose={() => setShareAgent(null)} />
      )}

      {/* ── Goal edit sheet ── */}
      {showGoalEdit && (
        <GoalEditSheet
          goal={ritual.goal.goal}
          progress={ritual.goal}
          onClose={() => setShowGoalEdit(false)}
          onSave={async (g) => {
            await api.post("/api/agent/goal", { ...g, reset: true });
            setShowGoalEdit(false);
            setRevealed(false);
            setCard(null);
            setMood(null);
            setClosed(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ── YourStateHero: big circular Shazam-style button ── */
function BaselineTrendChart({ trend, metricLabel, agent }: { trend: BaselineTrend; metricLabel: string; agent?: any }) {
  if (!trend.values || trend.values.length < 4) return null;
  // ACTUAL values, not rolling means
  const todayVal = Math.round(agent?.today_value ?? trend.values[trend.values.length - 1]);
  const startVal = Math.round(trend.values[0]);
  const lwi = agent?.lower_is_worse ?? true;
  const rawDelta = todayVal - startVal;
  // Visible delta — invert sign for stress (lower_is_worse=false)
  const delta = lwi ? rawDelta : -rawDelta;
  const direction: "up" | "flat" | "down" = Math.abs(delta) < 1 ? "flat" : delta > 0 ? "up" : "down";
  const dirColor = direction === "up" ? YU.teal : direction === "down" ? "#E5484D" : YU.muted;
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "→";
  const verdict = direction === "up" ? "Your floor is rising" : direction === "down" ? "Your floor is dropping" : "Your floor is steady";
  const stateGlyph = agent?.state_glyph || "●";
  const stateLabel = agent?.state_label || "Steady";
  const stateColor = agent?.color || YU.teal;
  const unit = metricLabel.toLowerCase().includes("hrv") ? "ms" : metricLabel.toLowerCase().includes("stress") ? "min" : "";

  const RING_SIZE = 320;
  const CENTER = RING_SIZE / 2;
  const RING_R = 148;
  // Smooth ring: a 270° arc from -225° to +45°
  const startAngle = -225 * (Math.PI / 180);
  const endAngle = 45 * (Math.PI / 180);
  const startPt = [CENTER + RING_R * Math.cos(startAngle), CENTER + RING_R * Math.sin(startAngle)];
  const endPt = [CENTER + RING_R * Math.cos(endAngle), CENTER + RING_R * Math.sin(endAngle)];
  // 270° arc — large-arc-flag = 1, sweep = 1
  const ringPath = `M ${startPt[0].toFixed(1)} ${startPt[1].toFixed(1)} A ${RING_R} ${RING_R} 0 1 1 ${endPt[0].toFixed(1)} ${endPt[1].toFixed(1)}`;

  return (
    <div className="yu-rise" style={{
      maxWidth: 560,
      margin: "0 auto 48px",
      padding: "12px 0",
      textAlign: "center",
    }}>
      <style>{`
        @keyframes yuShazamPulse {
          0%, 100% { transform: scale(1); opacity: .7; }
          50% { transform: scale(1.06); opacity: .35; }
        }
        @keyframes yuShazamGlow {
          0%, 100% { box-shadow: 0 0 0 0 var(--yc), 0 24px 64px rgba(28,43,58,0.08); }
          50% { box-shadow: 0 0 0 24px transparent, 0 24px 64px rgba(28,43,58,0.10); }
        }
      `}</style>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 18px" }}>
        your {metricLabel.toLowerCase()} state
      </p>

      {/* The big circular state button */}
      <div style={{
        position: "relative",
        width: RING_SIZE,
        height: RING_SIZE,
        margin: "0 auto",
      }}>
        {/* Pulse rings */}
        <div style={{
          position: "absolute",
          inset: 24,
          borderRadius: "50%",
          border: `1.5px solid ${stateColor}`,
          opacity: 0.18,
          animation: "yuShazamPulse 3.4s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute",
          inset: 38,
          borderRadius: "50%",
          border: `1.5px solid ${stateColor}`,
          opacity: 0.12,
          animation: "yuShazamPulse 3.4s ease-in-out infinite",
          animationDelay: "0.6s",
        }} />

        {/* SVG trend ring around the button */}
        <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id={`yu-ring-${stateLabel}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={`${stateColor}30`} />
              <stop offset="100%" stopColor={stateColor} />
            </linearGradient>
          </defs>
          {/* faint full background ring */}
          <circle cx={CENTER} cy={CENTER} r={RING_R} fill="none" stroke={`${YU.line}`} strokeWidth={1} />
          {/* clean 270° arc */}
          <path d={ringPath} fill="none" stroke={`url(#yu-ring-${stateLabel})`} strokeWidth={3} strokeLinecap="round" />
          {/* starting endpoint */}
          <circle cx={startPt[0]} cy={startPt[1]} r={6} fill="#fff" stroke={YU.label} strokeWidth={2} />
          {/* today endpoint */}
          <circle cx={endPt[0]} cy={endPt[1]} r={9} fill={stateColor} />
          <circle cx={endPt[0]} cy={endPt[1]} r={4} fill="#fff" />
        </svg>

        {/* Inner button face */}
        <div
          style={{
            ["--yc" as any]: `${stateColor}40`,
            position: "absolute",
            inset: 60,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 25%, #fff 0%, #fff 40%, ${stateColor}10 100%)`,
            border: `1.5px solid ${stateColor}40`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "yuShazamGlow 3.4s ease-in-out infinite",
          }}
        >
          <span style={{ fontFamily: display, fontSize: 64, color: stateColor, lineHeight: 1, fontWeight: 700, marginBottom: 4 }}>
            {stateGlyph}
          </span>
          <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, letterSpacing: "-0.01em", lineHeight: 1 }}>
            {stateLabel}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, marginTop: 8 }}>
            today {todayVal}{unit}
          </span>
        </div>
      </div>

      {/* Stats row under the circle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, marginTop: 28, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 4px" }}>starting line</p>
          <p style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: 0, letterSpacing: "-0.01em" }}>{startVal}{unit}</p>
        </div>
        <div style={{ width: 1, height: 30, background: YU.line }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 4px" }}>30-day shift</p>
          <p style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: dirColor, margin: 0, letterSpacing: "-0.01em" }}>
            {arrow} {delta > 0 ? "+" : ""}{delta}{unit}
          </p>
        </div>
        <div style={{ width: 1, height: 30, background: YU.line }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 4px" }}>floor</p>
          <p style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: dirColor, margin: 0, letterSpacing: "-0.01em" }}>
            {trend.direction === "up" ? "rising" : trend.direction === "down" ? "dropping" : "steady"}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 12, color: YU.muted, marginTop: 14 }}>
        {verdict} · last {trend.days || 30} days
      </p>
    </div>
  );
}

/* ── ShareStateModal: F7 verbatim card → SVG → image → share ── */
type ShareFormat = "square" | "story" | "wide";
const FORMATS: { id: ShareFormat; label: string; w: number; h: number }[] = [
  { id: "square", label: "Square", w: 1080, h: 1080 },
  { id: "story",  label: "Story",  w: 1080, h: 1920 },
  { id: "wide",   label: "Wide",   w: 1200, h: 630 },
];

function buildStateCardSVG(agent: any, ritual: Ritual, fmt: { w: number; h: number }): string {
  const state: string = agent?.state || "steady";
  const glyph = STATE_GLYPH[state] || "●";
  const [stateBig, contextLine] = F7_LINE[state] || ["", ""];
  const color = agent?.color || YU.teal;
  const W = fmt.w;
  const H = fmt.h;
  const cx = W / 2;
  // Layout scales relative to the smaller dimension
  const base = Math.min(W, H);
  const glyphSize = Math.round(base * 0.30);
  const stateSize = Math.round(base * 0.13);
  const contextSize = Math.round(base * 0.045);
  const footerSize = Math.round(base * 0.025);
  const pitchSize = Math.round(base * 0.022);
  const padTop = Math.round(H * 0.18);
  const goalLine = ritual.goal?.goal?.behavior ? `Day ${ritual.goal.day_index} of: ${ritual.goal.goal.behavior}` : "";
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <text x="${cx}" y="${padTop + glyphSize}" font-family="Space Grotesk, sans-serif" font-size="${glyphSize}" font-weight="700" fill="${color}" text-anchor="middle">${glyph}</text>

  <text x="${cx}" y="${padTop + glyphSize + stateSize + 10}" font-family="Space Grotesk, sans-serif" font-size="${stateSize}" font-weight="700" fill="${YU.ink}" text-anchor="middle" letter-spacing="-2">${escape(stateBig)}</text>

  <text x="${cx}" y="${padTop + glyphSize + stateSize + 10 + contextSize + 28}" font-family="Inter, sans-serif" font-size="${contextSize}" font-weight="500" fill="${YU.body}" text-anchor="middle">${escape(contextLine)}</text>

  ${goalLine ? `
  <line x1="${cx - base * 0.08}" y1="${H - padTop - footerSize * 4}" x2="${cx + base * 0.08}" y2="${H - padTop - footerSize * 4}" stroke="${YU.line}" stroke-width="2"/>
  <text x="${cx}" y="${H - padTop - footerSize * 2}" font-family="Inter, sans-serif" font-size="${footerSize}" font-weight="600" fill="${YU.label}" text-anchor="middle" letter-spacing="2">${escape(goalLine.toUpperCase())}</text>
  ` : ""}

  <text x="${cx}" y="${H - padTop * 0.6}" font-family="Inter, sans-serif" font-size="${pitchSize}" font-weight="500" fill="${YU.muted}" text-anchor="middle" font-style="italic">${escape(PITCH)}</text>

  <text x="${W - padTop * 0.8}" y="${H - padTop * 0.25}" font-family="Space Grotesk, sans-serif" font-size="${footerSize * 1.1}" font-weight="700" fill="${YU.teal}" text-anchor="end" letter-spacing="2">YU</text>
</svg>`;
}

async function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob> {
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

function ShareStateModal({ agent, ritual, onClose }: { agent: any; ritual: Ritual; onClose: () => void }) {
  const [fmt, setFmt] = useState<ShareFormat>("square");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fmtDef = FORMATS.find((f) => f.id === fmt)!;
  const svg = buildStateCardSVG(agent, ritual, fmtDef);
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  const share = async () => {
    setBusy(true); setStatus(null);
    try {
      const blob = await svgToPngBlob(svg, fmtDef.w, fmtDef.h);
      const file = new File([blob], `yu-state.png`, { type: "image/png" });
      const nav: any = navigator;
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: PITCH });
        setStatus("Shared");
      } else {
        // Clipboard fallback
        const item = new (window as any).ClipboardItem({ "image/png": blob });
        await (navigator.clipboard as any).write([item]);
        setStatus("Copied to clipboard");
      }
    } catch (e: any) {
      setStatus(e?.message || "Could not share");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(svg, fmtDef.w, fmtDef.h);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yu-${agent.id}-${agent.state}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Downloaded");
    } catch (e: any) {
      setStatus(e?.message || "Could not download");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(28,43,58,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 70, fontFamily: sans, animation: "yuFade .2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", maxWidth: 520, width: "100%", borderRadius: 22, padding: 28,
        border: `1px solid ${YU.line}`, boxShadow: "0 30px 80px rgba(28,43,58,0.20)", animation: "yuRise .35s cubic-bezier(.2,.8,.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 4px" }}>
              share your state
            </p>
            <h3 style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: 0, letterSpacing: "-0.01em" }}>
              {agent.state_glyph} {agent.state_label}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: YU.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{
          background: YU.bgSoft,
          border: `1px solid ${YU.line}`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxHeight: 360,
          overflow: "hidden",
        }}>
          <img
            src={dataUrl}
            alt="State card preview"
            style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, boxShadow: "0 8px 24px rgba(28,43,58,0.10)" }}
          />
        </div>

        {/* Format toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, justifyContent: "center" }}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFmt(f.id)}
              style={{
                background: fmt === f.id ? YU.ink : "#fff",
                color: fmt === f.id ? "#fff" : YU.ink,
                border: `1px solid ${fmt === f.id ? YU.ink : YU.line}`,
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: sans,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={download}
            disabled={busy}
            style={{
              background: "#fff",
              color: YU.ink,
              border: `1px solid ${YU.line}`,
              borderRadius: 999,
              padding: "14px 22px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: sans,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Download
          </button>
          <button
            onClick={share}
            disabled={busy}
            style={{
              background: agent.color || YU.teal,
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "14px 26px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: sans,
              cursor: busy ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: `0 8px 24px ${agent.color || YU.teal}30`,
            }}
          >
            <Share2 size={14} />
            {busy ? "Working" : "Share"}
          </button>
        </div>

        {status && (
          <p style={{ fontSize: 12, color: YU.muted, textAlign: "center", marginTop: 14 }}>{status}</p>
        )}
      </div>
    </div>
  );
}

/* ── HistoryChart: simple inline 14-day SVG line + baseline ── */
function HistoryChart({ values, baseline, color, lowerIsWorse }: { values: number[]; baseline?: number; color: string; lowerIsWorse: boolean }) {
  const W = 560; const H = 100; const PAD = 8;
  const vmin = Math.min(...values, baseline ?? Infinity);
  const vmax = Math.max(...values, baseline ?? -Infinity);
  const range = Math.max(1, vmax - vmin);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => H - PAD - ((v - vmin) / range) * (H - PAD * 2);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const last = values[values.length - 1];
  const lastIsBetter = baseline != null
    ? (lowerIsWorse ? last >= baseline : last <= baseline)
    : true;
  const lastColor = lastIsBetter ? color : "#E5484D";
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 6px" }}>
        last {values.length} days
      </p>
      <div style={{ width: "100%", border: `1px solid ${YU.line}`, borderRadius: 14, padding: "10px 14px", background: "#fff" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
          {baseline != null && (
            <line x1={PAD} y1={y(baseline)} x2={W - PAD} y2={y(baseline)} stroke={YU.line} strokeWidth={1} strokeDasharray="3 4" />
          )}
          {baseline != null && (
            <text x={W - PAD - 4} y={y(baseline) - 4} fontSize={10} textAnchor="end" fill={YU.label} fontFamily="Inter">
              your baseline {Math.round(baseline)}
            </text>
          )}
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {values.map((v, i) => {
            const isLast = i === values.length - 1;
            return (
              <circle key={i} cx={x(i)} cy={y(v)} r={isLast ? 5 : 2.5} fill={isLast ? lastColor : color} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Done for today: identity reinforcement (not closure) ── */
function DoneForToday({ sp, ritual }: { sp: any; ritual: Ritual }) {
  const now = new Date();
  const tmw = new Date(now); tmw.setDate(now.getDate() + 1); tmw.setHours(6, 0, 0, 0);
  const hoursUntil = Math.max(1, Math.round((tmw.getTime() - now.getTime()) / 3600000));
  return (
    <div className="yu-rise" style={{ textAlign: "center", padding: "32px 0 24px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: sp.color, margin: "0 0 14px" }}>
        you read yourself today
      </p>
      <h2 style={{ fontFamily: display, fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, color: YU.ink, margin: "0 auto 18px", letterSpacing: "-0.01em", lineHeight: 1.18, maxWidth: 540 }}>
        Day {ritual.goal.day_index} of building a body you can predict
      </h2>
      <p style={{ fontSize: 14, color: YU.muted, margin: "0 auto 28px", maxWidth: 460, lineHeight: 1.55 }}>
        Tonight: {ritual.goal.goal.behavior.toLowerCase()}. The next read drops in <strong style={{ color: YU.ink }}>{hoursUntil}h</strong>.
      </p>
      <p style={{ fontSize: 11, color: YU.label, margin: "8px 0 0" }}>
        Tap any agent above to peek. Your council is quiet until morning.
      </p>
    </div>
  );
}

/* ── Closed state: tonight's commitment + prediction + countdown ── */
function ClosedState({ sp, ritual, closed, adherenceCount, onLogAdherence, onDismiss }: {
  sp: any; ritual: Ritual; closed: RevealedCard; adherenceCount: number;
  onLogAdherence: (v: "yes" | "partial" | "no") => Promise<void>;
  onDismiss: () => void;
}) {
  const [adherenceLogged, setAdherenceLogged] = useState(false);
  const showAdherence = ritual.goal.day_index > 1 && adherenceCount < ritual.goal.day_index - 1;

  const handleAdherence = async (v: "yes" | "partial" | "no") => {
    await onLogAdherence(v);
    setAdherenceLogged(true);
  };

  // Time until "tomorrow morning" (06:00 local)
  const now = new Date();
  const tmw = new Date(now); tmw.setDate(now.getDate() + 1); tmw.setHours(6, 0, 0, 0);
  const hoursUntil = Math.max(1, Math.round((tmw.getTime() - now.getTime()) / 3600000));

  return (
    <div className="yu-rise" style={{ marginBottom: 56 }}>
      {/* Sent confirmation */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${sp.color}14`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Check size={28} style={{ color: sp.color }} />
        </div>
        <p style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          {closed.notification?.sent
            ? "Sent to your Telegram"
            : closed.notification?.mode === "demo_cap_reached"
            ? "You already used today's nudge"
            : closed.notification?.mode === "stub"
            ? "Reminder ready"
            : "Reminder recorded"}
        </p>
        <p style={{ fontSize: 13, color: YU.muted, margin: 0 }}>
          {closed.notification?.sent
            ? "You won't hear from this agent again today"
            : closed.notification?.mode === "demo_cap_reached"
            ? "One reminder per day. Tonight's commitment is still on."
            : closed.notification?.mode === "stub"
            ? "Telegram not configured. Tonight's commitment is still on."
            : "Tonight's commitment is on."}
        </p>
      </div>

      {/* Tonight's commitment */}
      <div style={{ borderTop: `1px solid ${YU.line}`, borderBottom: `1px solid ${YU.line}`, padding: "26px 0", marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 8px", textAlign: "center" }}>
          Tonight's test
        </p>
        <p style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em", textAlign: "center" }}>
          {ritual.goal.goal.behavior}
        </p>
      </div>

      {/* Adherence (only if there's a yesterday to log) */}
      {showAdherence && !adherenceLogged && (
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 14px" }}>
            And yesterday — did you hold it
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {(["yes", "partial", "no"] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleAdherence(v)}
                style={{
                  background: "#fff",
                  color: YU.ink,
                  border: `1px solid ${YU.line}`,
                  padding: "12px 22px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: sans,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {v === "partial" ? "partly" : v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Countdown */}
      <div style={{ borderTop: `1px solid ${YU.line}`, paddingTop: 22, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 24px" }}>
          Next read in {hoursUntil}h
        </p>
        <button
          onClick={onDismiss}
          style={{ background: YU.ink, color: "#fff", border: 0, padding: "16px 32px", borderRadius: 999, fontSize: 14, fontWeight: 600, fontFamily: sans, cursor: "pointer", boxShadow: "0 8px 24px rgba(28,43,58,.18)" }}
        >
          Close for today
        </button>
      </div>
    </div>
  );
}

interface Suggestion { behavior: string; target_metric: string; target_metric_label: string; duration_days: number; why: string; }

/* ── Hypothesis sheet (Active + Library tabs) ── */
function GoalEditSheet({ goal, progress, onClose, onSave }: { goal: any; progress: Goal; onClose: () => void; onSave: (g: any) => void }) {
  const [tab, setTab] = useState<"active" | "library">("active");
  const [replacing, setReplacing] = useState(false);
  const [behavior, setBehavior] = useState(goal.behavior);
  const [duration, setDuration] = useState(goal.duration_days);
  const [metric, setMetric] = useState(goal.target_metric);
  const [library, setLibrary] = useState<ArchivedHypothesis[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const METRICS = [
    { id: "hrv", label: "morning HRV" },
    { id: "readiness", label: "readiness" },
    { id: "sleep", label: "sleep score" },
    { id: "deep_sleep", label: "deep sleep" },
    { id: "rhr", label: "resting heart rate" },
  ];
  useEffect(() => {
    api.get("/api/agent/hypothesis/library").then((r) => setLibrary(r.library || [])).catch(() => {});
  }, []);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const r = await api.post("/api/agent/hypothesis/suggest");
      setSuggestions(r.suggestions || []);
    } catch {} finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (replacing && !suggestions) loadSuggestions();
  }, [replacing]);

  const applySuggestion = (s: Suggestion) => {
    setBehavior(s.behavior);
    setDuration(s.duration_days);
    setMetric(s.target_metric);
  };
  const verdictColor = (label: string) => label === "confirmed" ? YU.teal : label === "weakened" ? YU.red : YU.muted;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(28,43,58,0.45)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60, fontFamily: sans, animation: "yuFade .2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", maxWidth: 560, width: "100%", borderRadius: 20, padding: 36, maxHeight: "85vh", overflow: "auto",
        border: `1px solid ${YU.line}`, boxShadow: "0 30px 80px rgba(28,43,58,0.18)", animation: "yuRise .35s cubic-bezier(.2,.8,.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: 0 }}>
              your hypotheses
            </p>
            <h3 style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: "6px 0 0", letterSpacing: "-0.01em" }}>
              One active. The rest learned.
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: YU.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${YU.line}`, marginBottom: 24 }}>
          {(["active", "library"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: 0,
                padding: "12px 16px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: tab === t ? YU.ink : YU.label,
                borderBottom: tab === t ? `2px solid ${YU.teal}` : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              {t === "active" ? "Active" : `Past tests${library.length ? ` · ${library.length}` : ""}`}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <div>
            {library.length === 0 ? (
              <p style={{ fontSize: 14, color: YU.muted, textAlign: "center", padding: "32px 0", lineHeight: 1.6 }}>
                No past tests yet.<br />Your library starts when you finish your first hypothesis.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {library.map((h, i) => (
                  <div key={i} style={{ border: `1px solid ${YU.line}`, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <p style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: YU.ink, margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                        {h.behavior}
                      </p>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase",
                        color: verdictColor(h.verdict?.label),
                        background: `${verdictColor(h.verdict?.label)}14`,
                        padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", marginLeft: 12,
                      }}>
                        {h.verdict?.label || "inconclusive"}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: YU.muted, margin: "0 0 8px" }}>
                      {h.target_metric_label} · {h.duration_days} days · {h.started_on} → {h.ended_on}
                    </p>
                    {h.verdict?.delta != null && h.baseline_at_start != null && h.ended_value != null && (
                      <p style={{ fontSize: 13, color: YU.body, margin: 0 }}>
                        {h.baseline_at_start} → {h.ended_value} · {h.verdict.delta > 0 ? "+" : ""}{h.verdict.delta} ({h.verdict.delta_pct}%)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "active" && !replacing && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: YU.label, margin: "0 0 10px" }}>
              Day {progress.day_index} of {progress.duration}
            </p>
            <h4 style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: YU.ink, margin: "0 0 6px", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              {goal.behavior}
            </h4>
            <p style={{ fontSize: 13, color: YU.muted, margin: "0 0 22px" }}>
              improves my {goal.target_metric_label}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: `1px solid ${YU.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
              <div style={{ padding: 16, borderRight: `1px solid ${YU.line}` }}>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 6px" }}>starting line</p>
                <p style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: YU.ink, margin: 0, letterSpacing: "-0.01em" }}>{progress.baseline_at_start ?? "—"}</p>
              </div>
              <div style={{ padding: 16, borderRight: `1px solid ${YU.line}` }}>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 6px" }}>today</p>
                <p style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: YU.ink, margin: 0, letterSpacing: "-0.01em" }}>{progress.today_value ?? "—"}</p>
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 6px" }}>delta</p>
                {(() => {
                  const d = progress.running_delta;
                  if (d == null) return <p style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: YU.label, margin: 0 }}>—</p>;
                  const dir = progress.direction || 1;
                  const isGood = d * dir > 0;
                  const color = d === 0 ? YU.muted : isGood ? YU.teal : YU.red;
                  return (
                    <p style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color, margin: 0, letterSpacing: "-0.01em" }}>
                      {d > 0 ? "+" : ""}{d}
                    </p>
                  );
                })()}
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 8px" }}>Adherence</p>
            <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
              {progress.days.map((d, i) => {
                const isToday = i + 1 === progress.day_index;
                const fill = d.status === "yes" ? YU.teal : d.status === "partial" ? YU.amber : d.status === "no" ? YU.red : isToday ? YU.line : "#F3F4F6";
                return <div key={d.date} style={{ flex: 1, height: 8, borderRadius: 4, background: fill }} />;
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${YU.line}` }}>
              <p style={{ fontSize: 11, color: YU.muted, margin: 0 }}>
                Started {goal.started_on}
              </p>
              <button
                onClick={() => setReplacing(true)}
                style={{ background: "transparent", border: 0, color: YU.muted, fontSize: 12, fontWeight: 600, fontFamily: sans, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                Replace with a new hypothesis
              </button>
            </div>
          </div>
        )}

        {tab === "active" && replacing && (
        <>
        <p style={{ fontSize: 11, color: YU.muted, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
          Starting a new hypothesis archives your current one with its verdict so far.
        </p>

        {/* AI suggestions */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label, margin: "0 0 12px" }}>
            hypotheses your data suggests
          </p>
          {loadingSuggestions && (
            <p style={{ fontSize: 12, color: YU.muted, padding: "16px 0", textAlign: "center" }}>
              <RefreshCw size={12} className="animate-spin" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              Reading your data
            </p>
          )}
          {!loadingSuggestions && suggestions && suggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((s, i) => {
                const isSelected = behavior === s.behavior;
                return (
                  <button
                    key={i}
                    onClick={() => applySuggestion(s)}
                    style={{
                      textAlign: "left",
                      background: isSelected ? `${YU.teal}08` : "#fff",
                      border: `1px solid ${isSelected ? YU.teal : YU.line}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                      fontFamily: sans,
                      cursor: "pointer",
                      transition: "all .15s ease",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = YU.teal; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = YU.line; }}
                  >
                    <p style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: YU.ink, margin: "0 0 4px", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                      {s.behavior}
                    </p>
                    <p style={{ fontSize: 11, color: YU.label, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
                      {s.target_metric_label} · {s.duration_days} days
                    </p>
                    <p style={{ fontSize: 12, color: YU.muted, margin: 0, lineHeight: 1.5 }}>
                      {s.why}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          <p style={{ fontSize: 11, color: YU.label, textAlign: "center", margin: "16px 0 0" }}>
            or write your own ↓
          </p>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label }}>Behavior</label>
        <input
          value={behavior}
          onChange={(e) => setBehavior(e.target.value)}
          style={{ width: "100%", marginTop: 6, marginBottom: 18, padding: "14px 16px", border: `1px solid ${YU.line}`, borderRadius: 12, fontSize: 15, fontFamily: sans, color: YU.ink, outline: "none" }}
        />

        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label }}>For how many days</label>
        <input
          type="number"
          min={1}
          max={30}
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value) || 7)}
          style={{ width: "100%", marginTop: 6, marginBottom: 18, padding: "14px 16px", border: `1px solid ${YU.line}`, borderRadius: 12, fontSize: 15, fontFamily: sans, color: YU.ink, outline: "none" }}
        />

        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: YU.label }}>Improves my</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, marginBottom: 28 }}>
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              style={{
                background: metric === m.id ? YU.teal : "#fff",
                color: metric === m.id ? "#fff" : YU.ink,
                border: `1px solid ${metric === m.id ? YU.teal : YU.line}`,
                borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 600, fontFamily: sans, cursor: "pointer", textAlign: "left",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: YU.muted, fontSize: 14, fontFamily: sans, cursor: "pointer", padding: "12px 16px" }}>
            Cancel
          </button>
          <button
            onClick={() => onSave({ behavior, duration_days: duration, target_metric: metric, target_metric_label: METRICS.find((x) => x.id === metric)?.label })}
            style={{ background: YU.ink, color: "#fff", border: 0, padding: "14px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: sans, cursor: "pointer" }}
          >
            Start the test
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
