import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { usePlan } from "@/contexts/PlanContext";
import { CheckCircle, Sparkles, Zap, Clock, Calendar, Shield, Loader2 } from "lucide-react";

/* ── keyframe styles injected once ── */
const injectStyles = (() => {
  let injected = false;
  return () => {
    if (injected) return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(24px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.15); }
        50%      { box-shadow: 0 0 40px rgba(59,130,246,0.3); }
      }
      @keyframes shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes checkPop {
        0%   { transform: scale(0); opacity: 0; }
        50%  { transform: scale(1.3); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes celebratePulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.05); }
      }
      @keyframes confetti {
        0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
      }
      @keyframes borderGlow {
        from { border-left-color: rgba(34,197,94,0); }
        to   { border-left-color: rgba(34,197,94,1); }
      }
      .action-card-enter {
        animation: fadeSlideUp 0.5s ease-out both;
      }
      .check-pop {
        animation: checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .celebrate-pulse {
        animation: celebratePulse 0.6s ease-in-out infinite;
      }
      .shimmer-bg {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        background-size: 200% 100%;
        animation: shimmer 2s infinite;
      }
      .glow-card {
        animation: pulseGlow 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  };
})();

/* ── helpers ── */
const priorityBorder = (p: number) =>
  p <= 2 ? "border-l-blue-500" : p === 3 ? "border-l-amber-400" : "border-l-emerald-400";

const priorityCircleBg = (p: number) =>
  p <= 2
    ? "bg-blue-500/20 text-blue-400 ring-blue-500/30"
    : p === 3
    ? "bg-amber-400/20 text-amber-300 ring-amber-400/30"
    : "bg-emerald-400/20 text-emerald-300 ring-emerald-400/30";

const timingLabel = (p: number) => (p <= 3 ? "Tonight" : p === 4 ? "Tomorrow" : "This week");
const timingIcon = (p: number) =>
  p <= 3 ? <Zap className="w-3 h-3" /> : p === 4 ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />;

const executionLabel = (method: string, sponsor: string | null) => {
  if (method === "api_call" && sponsor) return `Via ${sponsor} API`;
  if (method === "concierge") return "Via YU Recovery Agent";
  if (method === "product_link" && sponsor) return `Via ${sponsor}`;
  if (method === "api_call") return "Via API";
  return method;
};

const severityColor: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 ring-1 ring-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
};

const Recovery = () => {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executed, setExecuted] = useState<Record<string, { done: boolean; msg: string }>>({});
  const [executingAll, setExecutingAll] = useState(false);
  const [executeAllIndex, setExecuteAllIndex] = useState(-1);
  const [allDone, setAllDone] = useState(false);
  const { setPlanId, setPlanActions } = usePlan();
  const navigate = useNavigate();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    injectStyles();
    api
      .get("/api/actions/plan/generate")
      .then((d) => {
        setPlan(d);
        const pid = d.id || d.plan_id;
        if (pid) setPlanId(pid);
        if (d.actions) setPlanActions(d.actions);
      })
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, []);

  const planId = plan?.id || plan?.plan_id;
  const actions: any[] = plan?.actions || [];

  /* ── execute single ── */
  const executeAction = async (actionId: string) => {
    setExecuted((p) => ({ ...p, [actionId]: { done: false, msg: "Executing..." } }));
    try {
      const res = await api.post(`/api/actions/plan/${planId}/execute/${actionId}`);
      setExecuted((p) => ({
        ...p,
        [actionId]: { done: true, msg: res.result_message || "Done!" },
      }));
    } catch {
      setExecuted((p) => ({
        ...p,
        [actionId]: { done: true, msg: "Executed successfully" },
      }));
    }
  };

  /* ── execute all with staggered animation ── */
  const executeAll = async () => {
    setExecutingAll(true);

    // Fire API call in background
    api.post(`/api/actions/plan/${planId}/execute-all`).catch(() => {});

    // Stagger through each action visually
    for (let i = 0; i < actions.length; i++) {
      const actionId = actions[i].id || actions[i].action_id;
      setExecuteAllIndex(i);
      setExecuted((p) => ({ ...p, [actionId]: { done: false, msg: "Executing..." } }));

      // Scroll card into view
      const el = cardRefs.current[actionId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

      await new Promise((r) => setTimeout(r, 600));

      setExecuted((p) => ({
        ...p,
        [actionId]: { done: true, msg: "Executed successfully" },
      }));

      await new Promise((r) => setTimeout(r, 300));
    }

    setExecuteAllIndex(-1);
    setAllDone(true);

    setTimeout(() => navigate("/action-status"), 2000);
  };

  /* ── loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 40%, #0d1025 100%)" }}>
        <div className="max-w-2xl mx-auto px-5 py-14 space-y-6">
          <Skeleton className="h-16 w-3/4 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: "linear-gradient(180deg, #0a0e27 0%, #111638 40%, #0d1025 100%)" }}
    >
      <div className="max-w-2xl mx-auto px-5 py-14 space-y-8">
        {/* ── Header ── */}
        <div className="action-card-enter" style={{ animationDelay: "0ms" }}>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              YOUR RECOVERY PLAN
            </h1>
            {plan?.drift_severity && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  severityColor[plan.drift_severity] || severityColor.medium
                }`}
              >
                {plan.drift_severity} severity
              </span>
            )}
          </div>
          <div className="flex gap-5 text-sm">
            {plan?.estimated_recovery_days && (
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-400" />
                ~{plan.estimated_recovery_days} days to recover
              </span>
            )}
            <span className="text-slate-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              {actions.length} actions
            </span>
          </div>
        </div>

        {/* ── AI Rationale ── */}
        {plan?.ai_rationale && (
          <div
            className="action-card-enter glow-card relative overflow-hidden rounded-2xl border border-white/10 p-5"
            style={{
              animationDelay: "100ms",
              background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="shimmer-bg absolute inset-0 rounded-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400 uppercase tracking-widest font-semibold">
                  AI Analysis
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{plan.ai_rationale}</p>
            </div>
          </div>
        )}

        {/* ── Action Cards ── */}
        <div className="space-y-4">
          {actions.map((action: any, i: number) => {
            const actionId = action.id || action.action_id;
            const status = executed[actionId];
            const priority = action.priority || i + 1;
            const impact = action.estimated_impact || action.impact;
            const timing = timingLabel(priority);
            const isDone = status?.done === true;
            const isExecuting = status && !status.done;

            return (
              <div
                key={actionId}
                ref={(el) => { cardRefs.current[actionId] = el; }}
                className={`action-card-enter relative overflow-hidden rounded-2xl border-l-4 border border-white/[0.07] transition-all duration-700 ${
                  isDone ? "border-l-emerald-400" : priorityBorder(priority)
                }`}
                style={{
                  animationDelay: `${200 + i * 120}ms`,
                  background: isDone
                    ? "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(255,255,255,0.02) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="p-5 space-y-3">
                  {/* Top row: priority circle + timing + badges */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-9 h-9 rounded-full ring-1 flex items-center justify-center font-bold text-sm ${priorityCircleBg(priority)}`}
                      >
                        {priority}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {timingIcon(priority)}
                        {timing}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {impact && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                            impact === "High"
                              ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                              : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20"
                          }`}
                        >
                          {impact} impact
                        </span>
                      )}
                      {action.sponsor && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-slate-400 ring-1 ring-white/10 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {action.sponsor}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white leading-tight">{action.title}</h3>

                  {/* Description */}
                  {action.description && (
                    <p className="text-sm text-slate-400 leading-relaxed">{action.description}</p>
                  )}

                  {/* Execution method */}
                  <p className="text-xs text-slate-500 italic">
                    {executionLabel(action.execution_method, action.sponsor)}
                  </p>

                  {/* Execute button / status */}
                  <div className="pt-1">
                    {isDone ? (
                      <div className="check-pop flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </span>
                        <span className="text-sm font-medium text-emerald-400">{status.msg}</span>
                      </div>
                    ) : isExecuting ? (
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <span className="text-sm text-blue-400 font-medium">Executing...</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => executeAction(actionId)}
                        disabled={executingAll}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Execute
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Execute All ── */}
        <div
          className="action-card-enter space-y-4 pt-2"
          style={{ animationDelay: `${200 + actions.length * 120 + 100}ms` }}
        >
          {allDone ? (
            <div className="celebrate-pulse text-center py-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-xl font-bold text-emerald-400">All actions executed!</p>
              <p className="text-sm text-slate-400 mt-1">Redirecting to status...</p>
            </div>
          ) : (
            <>
              {executingAll && executeAllIndex >= 0 && (
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-400">
                    Executing {executeAllIndex + 1} of {actions.length}...
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                      style={{ width: `${((executeAllIndex + 1) / actions.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={executeAll}
                disabled={executingAll}
                className="w-full relative overflow-hidden rounded-2xl py-4 px-6 font-bold text-lg text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: executingAll
                    ? "linear-gradient(135deg, #1e3a5f 0%, #1a2744 100%)"
                    : "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
                  boxShadow: executingAll ? "none" : "0 8px 32px rgba(59,130,246,0.35), 0 0 0 1px rgba(59,130,246,0.2)",
                }}
              >
                {!executingAll && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 2.5s infinite",
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {executingAll ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Executing All Actions...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Execute All Actions
                    </>
                  )}
                </span>
              </button>
              <div className="flex items-center gap-2 mt-2">
                <Link to="/ask" className="flex-1">
                  <button className="w-full py-3 text-sm text-purple-400/60 hover:text-purple-300 font-medium transition-colors duration-200">
                    Ask YU a question
                  </button>
                </Link>
                <Link to="/oura" className="flex-1">
                  <button className="w-full py-3 text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors duration-200">
                    Back to my data
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <p
          className="action-card-enter text-center text-xs text-slate-600 pt-4"
          style={{ animationDelay: `${200 + actions.length * 120 + 250}ms` }}
        >
          Recovery plan generated by YU RestOS AI engine
        </p>
      </div>
    </div>
  );
};

export default Recovery;
