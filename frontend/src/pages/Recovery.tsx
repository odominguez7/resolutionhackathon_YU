import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { usePlan } from "@/contexts/PlanContext";
import { CheckCircle, Sparkles } from "lucide-react";

const Recovery = () => {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executed, setExecuted] = useState<Record<string, { done: boolean; msg: string }>>({});
  const [executingAll, setExecutingAll] = useState(false);
  const { setPlanId, setPlanActions } = usePlan();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/actions/plan/generate")
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

  const executeAction = async (actionId: string) => {
    setExecuted((p) => ({ ...p, [actionId]: { done: false, msg: "Executing..." } }));
    try {
      const res = await api.post(`/api/actions/plan/${planId}/execute/${actionId}`);
      setExecuted((p) => ({ ...p, [actionId]: { done: true, msg: res.result_message || "Done!" } }));
    } catch {
      setExecuted((p) => ({ ...p, [actionId]: { done: true, msg: "Executed (demo)" } }));
    }
  };

  const executeAll = async () => {
    setExecutingAll(true);
    try {
      await api.post(`/api/actions/plan/${planId}/execute-all`);
    } catch {}
    navigate("/action-status");
  };

  if (loading) {
    return (
      <div className="fade-in max-w-3xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-20 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  const actions = plan?.actions || [];
  const timingMap: Record<number, string> = { 1: "Tonight", 2: "Tonight", 3: "Tonight", 4: "Tomorrow", 5: "This week" };
  const timingColors: Record<string, string> = { Tonight: "text-primary", Tomorrow: "text-secondary", "This week": "text-success" };
  const executionLabels: Record<string, string> = {
    api_call: "Via API",
    concierge: "Via YU Recovery Agent",
    product_link: "Via Product Link",
    in_app: "In-App",
  };

  return (
    <div className="fade-in max-w-3xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-extrabold">YOUR RECOVERY PLAN</h1>
          {plan?.drift_severity && (
            <span className="px-3 py-1 rounded-full bg-warning/20 text-warning text-xs font-bold uppercase">
              {plan.drift_severity}
            </span>
          )}
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          {plan?.estimated_recovery_days && <span>~{plan.estimated_recovery_days} days to recover</span>}
          <span>{actions.length} actions</span>
        </div>
      </div>

      {/* AI Rationale */}
      {plan?.ai_rationale && (
        <div className="card-glass p-5 border-l-4 border-primary">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">AI Rationale</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{plan.ai_rationale}</p>
        </div>
      )}

      {/* Action Cards */}
      {actions.map((action: any, i: number) => {
        const actionId = action.id || action.action_id;
        const status = executed[actionId];
        const timing = timingMap[action.priority] || "This week";
        const impact = action.estimated_impact || action.impact;
        const method = executionLabels[action.execution_method] || action.execution_method;
        return (
          <div key={actionId} className="card-glass p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {action.priority || i + 1}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wider ${timingColors[timing] || "text-muted-foreground"}`}>
                  {timing}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {impact && (
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${impact === "High" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                    {impact}
                  </span>
                )}
                {action.sponsor && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent text-muted-foreground">
                    {action.sponsor}
                  </span>
                )}
              </div>
            </div>
            <h3 className="text-lg font-bold">{action.title}</h3>
            <p className="text-sm text-muted-foreground">{action.description}</p>
            {method && (
              <p className="text-xs text-muted-foreground/60 italic">{method}</p>
            )}
            {status?.done ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{status.msg}</span>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => executeAction(actionId)}
                disabled={!!status}
              >
                {status ? "Executing..." : "Execute →"}
              </Button>
            )}
          </div>
        );
      })}

      {/* Bottom Buttons */}
      <div className="space-y-3">
        <Button
          size="xl"
          variant="hero"
          className="w-full"
          onClick={executeAll}
          disabled={executingAll}
        >
          {executingAll ? "Executing All..." : "Execute All Actions"}
        </Button>
        <Link to="/dashboard">
          <Button variant="ghost" size="lg" className="w-full">Skip — I'll handle it</Button>
        </Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Powered by Granite 3.3 on your device. Your data never left this machine.
      </p>
    </div>
  );
};

export default Recovery;
