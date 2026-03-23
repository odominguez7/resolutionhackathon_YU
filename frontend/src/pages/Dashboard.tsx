import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Area, AreaChart, ComposedChart
} from "recharts";
import { AlertTriangle, Activity, Heart, Wind, Thermometer, RotateCcw } from "lucide-react";

const COLORS = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  gray: "#64748b",
  muted: "#94a3b8",
};

const Dashboard = () => {
  const [trends, setTrends] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/sleep/trends").catch(() => ({ trends: [] })),
      api.get("/api/checkin/history").catch(() => ({ checkins: [] })),
      api.get("/api/sleep/summary").catch(() => null),
    ]).then(([t, c, s]) => {
      setTrends(t.trends || []);
      setCheckins(c.checkins || []);
      setSummary(s);
      setLoading(false);
    });
  }, []);

  const latest = trends[trends.length - 1];
  const baseline = summary?.baselineAvg ?? 86;
  const currentScore = summary?.currentScore ?? latest?.sleepScore ?? 0;
  const drop = summary?.dropPercent ?? (baseline > 0 ? Math.round(((baseline - currentScore) / baseline) * 100) : 0);

  // Compute % change from baseline (first 5 days avg) for vitals
  const baselineSlice = trends.slice(0, 5);
  const avgOf = (arr: any[], key: string) => arr.length > 0 ? arr.reduce((s, t) => s + (t[key] ?? 0), 0) / arr.length : 0;
  const pctChange = (current: number, base: number) => base > 0 ? Math.round(((current - base) / base) * 100) : 0;

  const vitals = latest ? [
    { icon: Heart, label: "Heart Rate", value: `${latest.avgHeartRate ?? "--"} bpm`, change: pctChange(latest.avgHeartRate, avgOf(baselineSlice, "avgHeartRate")) },
    { icon: Activity, label: "HRV", value: `${latest.hrv ?? "--"} ms`, change: pctChange(latest.hrv, avgOf(baselineSlice, "hrv")) },
    { icon: Wind, label: "Resp Rate", value: `${latest.avgRespRate ?? "--"}/min`, change: pctChange(latest.avgRespRate, avgOf(baselineSlice, "avgRespRate")) },
    { icon: Thermometer, label: "Bed Temp", value: `${latest.avgBedTempC ?? "--"}°C`, change: pctChange(latest.avgBedTempC, avgOf(baselineSlice, "avgBedTempC")) },
    { icon: RotateCcw, label: "Toss & Turns", value: `${latest.tnt ?? "--"}`, change: pctChange(latest.tnt, avgOf(baselineSlice, "tnt")) },
  ] : [];

  if (loading) {
    return (
      <div className="fade-in max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="fade-in max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Score Header */}
      <div className="card-glass p-6 flex flex-wrap items-center gap-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Sleep Score</p>
          <p className="text-6xl font-extrabold gradient-text">{currentScore}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Baseline Avg</p>
          <p className="text-2xl font-bold">{baseline}</p>
        </div>
        {drop > 5 && (
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-4 py-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <span className="text-warning font-semibold">{drop}% below baseline</span>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sleep Score Trend */}
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Sleep Score Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <YAxis domain={[40, 100]} tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <ReferenceLine y={baseline} stroke={COLORS.muted} strokeDasharray="4 4" label={{ value: "Baseline", fill: COLORS.muted, fontSize: 10 }} />
              <Area dataKey="sleepScore" fill={COLORS.red} fillOpacity={0.1} stroke="none" baseValue={40} />
              <Line type="monotone" dataKey="sleepScore" stroke={COLORS.blue} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hrv" stroke={COLORS.purple} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep Stage Bar */}
        <div className="card-glass p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Sleep Stages</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <Bar dataKey="deepSleepPct" stackId="a" fill={COLORS.blue} name="Deep" />
              <Bar dataKey="remSleepPct" stackId="a" fill={COLORS.purple} name="REM" />
              <Bar dataKey="lightSleepPct" stackId="a" fill={COLORS.gray} name="Light" />
              <Bar dataKey="awakePct" stackId="a" fill={COLORS.red} name="Awake" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mood/Energy */}
      <div className="card-glass p-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Mood • Energy • Stress</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={checkins}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 11 }} />
            <YAxis domain={[0, 10]} tick={{ fill: COLORS.muted, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
            <Line type="monotone" dataKey="mood" stroke={COLORS.green} strokeWidth={2} dot={false} name="Mood" />
            <Line type="monotone" dataKey="energy" stroke={COLORS.yellow} strokeWidth={2} dot={false} name="Energy" />
            <Line type="monotone" dataKey="stress" stroke={COLORS.red} strokeWidth={2} dot={false} name="Stress" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Vitals */}
      {vitals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {vitals.map((v) => (
            <div key={v.label} className="card-glass p-4 text-center">
              <v.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{v.label}</p>
              <p className="text-xl font-bold mt-1">{v.value}</p>
              <p className={`text-xs mt-1 ${v.change > 0 ? "text-success" : v.change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {v.change > 0 ? "+" : ""}{v.change}%
              </p>
              {/* Mini sparkline */}
              <div className="mt-2 h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends.slice(-14)}>
                    <Line type="monotone" dataKey="sleepScore" stroke={COLORS.blue} strokeWidth={1} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-4">
        <Link to="/drift"><Button variant="warning" size="lg">View Drift Alert</Button></Link>
        <Link to="/checkin"><Button variant="default" size="lg">Do Check-in</Button></Link>
        <Link to="/xray"><Button variant="outline" size="lg">X-Ray Mode</Button></Link>
      </div>
    </div>
  );
};

export default Dashboard;
