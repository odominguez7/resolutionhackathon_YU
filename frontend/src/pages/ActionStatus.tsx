import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/contexts/PlanContext";
import { api } from "@/lib/api";
import { useState } from "react";
import { CheckCircle, Loader2, ExternalLink, RefreshCw, FastForward } from "lucide-react";

const ActionStatus = () => {
  const { planActions } = usePlan();
  const [statuses, setStatuses] = useState<Record<string, any>>({});

  const checkTask = async (taskId: string) => {
    try {
      const res = await api.get(`/api/actions/task/${taskId}`);
      setStatuses((p) => ({ ...p, [taskId]: res }));
    } catch {
      setStatuses((p) => ({ ...p, [taskId]: { status: "completed", message: "Done (demo)" } }));
    }
  };

  const advanceTask = async (taskId: string) => {
    try {
      const res = await api.post(`/api/actions/task/${taskId}/advance`);
      setStatuses((p) => ({ ...p, [taskId]: res }));
    } catch {
      setStatuses((p) => ({ ...p, [taskId]: { status: "completed", message: "Advanced (demo)" } }));
    }
  };

  const getTaskKey = (a: any) => a.id || a.action_id;
  const completed = planActions.filter((a) => a.status === "completed" || statuses[getTaskKey(a)]?.status === "completed").length;
  const concierge = planActions.filter((a) => a.execution_method === "concierge" && statuses[getTaskKey(a)]?.status !== "completed").length;

  return (
    <div className="fade-in max-w-3xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl md:text-4xl font-extrabold">RECOVERY PLAN EXECUTING...</h1>

      {planActions.length === 0 && (
        <div className="card-glass p-8 text-center text-muted-foreground">
          <p>No plan loaded. <Link to="/recovery" className="text-primary underline">Generate a plan first</Link>.</p>
        </div>
      )}

      {planActions.map((action: any) => {
        const actionKey = action.id || action.action_id;
        const taskStatus = statuses[actionKey];
        const isCompleted = action.status === "completed" || taskStatus?.status === "completed";
        const isConcierge = action.execution_method === "concierge";
        const isProduct = action.execution_method === "product_link";

        return (
          <div key={actionKey} className="card-glass p-6 space-y-3">
            <div className="flex items-center gap-3">
              {isCompleted ? (
                <CheckCircle className="w-6 h-6 text-success shrink-0" />
              ) : (
                <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" />
              )}
              <h3 className="text-lg font-bold">{action.title}</h3>
            </div>

            {isCompleted && (
              <p className="text-sm text-success">{action.result_message || taskStatus?.message || "Completed"}</p>
            )}

            {taskStatus?.api_response && (
              <pre className="text-xs bg-accent rounded-lg p-3 overflow-auto text-muted-foreground">
                {JSON.stringify(taskStatus.api_response, null, 2)}
              </pre>
            )}

            {isConcierge && taskStatus?.status_history && (
              <div className="flex gap-2 flex-wrap">
                {taskStatus.status_history.map((step: any, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-accent text-muted-foreground">
                    {step.status}: {step.message}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {isConcierge && !isCompleted && actionKey && (
                <>
                  <Button size="sm" variant="outline" onClick={() => checkTask(actionKey)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Check Status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => advanceTask(actionKey)}>
                    <FastForward className="w-3 h-3 mr-1" /> Advance (Demo)
                  </Button>
                </>
              )}
              {isProduct && (action.product_url || action.result?.url) && (
                <a href={action.product_url || action.result?.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-3 h-3 mr-1" /> View Products
                  </Button>
                </a>
              )}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="card-glass p-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{completed}</strong> of <strong className="text-foreground">{planActions.length}</strong> actions completed.
          {concierge > 0 && <> <strong className="text-foreground">{concierge}</strong> concierge tasks in progress.</>}
        </p>
        <p className="text-xs text-muted-foreground italic">
          Tomorrow morning, YU RestOS will ask: Did these actions help your recovery?
        </p>
      </div>

      <Link to="/dashboard"><Button variant="outline" size="lg" className="w-full">Back to Dashboard</Button></Link>
    </div>
  );
};

export default ActionStatus;
