import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from "recharts";
import { AlertTriangle } from "lucide-react";

const Drift = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/drift/analyze").then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fade-in max-w-3xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const severityLabel = data?.severity ?? "none";
  const severityScore = data?.severity_score ?? 0;
  const severityPct = Math.min(100, (severityScore / 50) * 100);
  const severityColor = severityLabel === "high" ? "bg-destructive" : severityLabel === "medium" ? "bg-warning" : "bg-success";

  return (
    <div className="fade-in max-w-3xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="card-glass p-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <AlertTriangle className="w-8 h-8 text-warning" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-warning">BURNOUT DRIFT DETECTED</h1>
        </div>
        {/* Severity Bar */}
        <div className="w-full bg-accent rounded-full h-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${severityColor}`} style={{ width: `${severityPct}%` }} />
        </div>
        <p className="text-muted-foreground">{data?.summary}</p>
        <div className="flex justify-center gap-6 text-sm">
          <span><strong className="text-foreground">{data?.consecutive_days}</strong> consecutive days</span>
          <span>Started <strong className="text-foreground">{data?.drift_start_date}</strong></span>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="card-glass p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Drift Timeline</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data?.signals || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
            <ReferenceArea y1={0} y2={60} fill="#ef4444" fillOpacity={0.05} />
            <Line type="monotone" dataKey="sleepScore" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sleep Score" />
            <Line type="monotone" dataKey="mood" stroke="#10b981" strokeWidth={2} dot={false} name="Mood" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Baseline */}
      {data?.baseline && (
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Your Baseline</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {Object.entries(data.baseline).map(([key, val]) => (
              <div key={key}>
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                <p className="text-xl font-bold">{String(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Link to="/recovery"><Button variant="success" size="xl">View Recovery Plan →</Button></Link>
        <Link to="/xray"><Button variant="outline" size="lg">X-Ray Mode</Button></Link>
        <Link to="/dashboard"><Button variant="ghost" size="lg">Back to Dashboard</Button></Link>
      </div>
    </div>
  );
};

export default Drift;
