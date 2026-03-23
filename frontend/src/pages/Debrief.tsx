import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { usePlan } from "@/contexts/PlanContext";
import { Star, ArrowUp, ArrowDown, CheckCircle } from "lucide-react";

const Debrief = () => {
  const { planId, planActions } = usePlan();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, boolean | null>>({
    sleep_improved: null,
    energy_improved: null,
    stress_decreased: null,
  });
  const [mostHelpful, setMostHelpful] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const effectivePlanId = planId || "demo_plan";

  useEffect(() => {
    api.get(`/api/feedback/${effectivePlanId}/effectiveness`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [effectivePlanId]);

  const submit = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      await api.post("/api/feedback/submit", {
        plan_id: effectivePlanId,
        date: today,
        overall_rating: rating,
        sleep_improved: feedback.sleep_improved ?? false,
        energy_improved: feedback.energy_improved ?? false,
        stress_reduced: feedback.stress_decreased ?? false,
        most_helpful_action: mostHelpful || null,
        notes,
      });
    } catch {}
    setSubmitted(true);
  };

  const actionNames = planActions.map((a: any) => a.title);

  if (loading) {
    return (
      <div className="fade-in max-w-2xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="fade-in min-h-[80vh] flex flex-col items-center justify-center gap-4 px-6">
        <CheckCircle className="w-16 h-16 text-success" />
        <h2 className="text-2xl font-bold">Feedback submitted. Thank you!</h2>
      </div>
    );
  }

  const changes = [
    { label: "Sleep Score", value: data?.sleep_score_change },
    { label: "HRV", value: data?.hrv_change },
    { label: "Mood", value: data?.mood_change },
    { label: "Energy", value: data?.energy_change },
  ];

  const yesNoQuestions = [
    { key: "sleep_improved", label: "Did your sleep improve?" },
    { key: "energy_improved", label: "Did your energy improve?" },
    { key: "stress_decreased", label: "Did your stress decrease?" },
  ];

  return (
    <div className="fade-in max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Good morning. Let's check your recovery.</h1>
      </div>

      {/* Before/After */}
      <div className="card-glass p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {changes.map((c) => (
            <div key={c.label}>
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <div className="flex items-center justify-center gap-1">
                {(c.value ?? 0) > 0 ? (
                  <ArrowUp className="w-4 h-4 text-success" />
                ) : (c.value ?? 0) < 0 ? (
                  <ArrowDown className="w-4 h-4 text-destructive" />
                ) : null}
                <span className={`text-2xl font-bold ${(c.value ?? 0) > 0 ? "text-success" : (c.value ?? 0) < 0 ? "text-destructive" : "text-foreground"}`}>
                  {(c.value ?? 0) > 0 ? "+" : ""}{c.value ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
        {(data?.recovery_verdict || data?.verdict) && (
          <div className="mt-4 text-center">
            <span className="px-3 py-1 rounded-full bg-success/20 text-success text-sm font-bold">{data.recovery_verdict || data.verdict}</span>
          </div>
        )}
      </div>

      {/* Star Rating */}
      <div className="card-glass p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Rate your recovery plan</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="focus:outline-none">
              <Star className={`w-8 h-8 transition-colors ${n <= rating ? "text-warning fill-warning" : "text-accent"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Yes/No */}
      {yesNoQuestions.map((q) => (
        <div key={q.key} className="card-glass p-5 flex items-center justify-between">
          <span className="text-sm font-medium">{q.label}</span>
          <div className="flex gap-2">
            {[true, false].map((val) => (
              <Button
                key={String(val)}
                size="sm"
                variant={feedback[q.key] === val ? (val ? "success" : "destructive") : "outline"}
                onClick={() => setFeedback({ ...feedback, [q.key]: val })}
              >
                {val ? "Yes" : "No"}
              </Button>
            ))}
          </div>
        </div>
      ))}

      {/* Most Helpful */}
      {actionNames.length > 0 && (
        <div className="card-glass p-5 space-y-3">
          <p className="text-sm font-medium">Most helpful action?</p>
          <div className="flex flex-wrap gap-2">
            {actionNames.map((name: string) => (
              <Button
                key={name}
                size="sm"
                variant={mostHelpful === name ? "default" : "outline"}
                onClick={() => setMostHelpful(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <textarea
        placeholder="Any other notes?"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full h-20 rounded-xl bg-card border border-border p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <Button onClick={submit} size="xl" variant="hero" className="w-full">Submit Feedback</Button>

      <p className="text-center text-xs text-muted-foreground">
        This feedback helps YU RestOS learn which actions work best for YOUR body.
      </p>
    </div>
  );
};

export default Debrief;
