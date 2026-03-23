import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { Shield, AlertTriangle } from "lucide-react";

const XRay = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/coaching/xray").then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fade-in max-w-4xl mx-auto px-6 py-12 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-4xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl md:text-4xl font-extrabold">X-Ray Mode: Where Does Your Data Go?</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Local AI */}
        <div className="card-glass p-6 border-2 border-success/40 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-success" />
            <div>
              <h2 className="text-xl font-bold text-success">LOCAL AI</h2>
              <p className="text-xs text-muted-foreground">{data?.local?.model || "Granite 3.3"}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Latency: <strong className="text-foreground">{data?.local?.latency || "~200ms"}</strong></p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Data sent:</span>
              <span className="px-2 py-0.5 rounded bg-success/20 text-success text-xs font-bold">NONE</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-success text-xs font-semibold">100% Private — On-Device</span>
            </div>
          </div>
          {data?.local?.response && (
            <div className="bg-accent rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">AI Response:</p>
              <p className="text-sm leading-relaxed">{data.local.response}</p>
            </div>
          )}
        </div>

        {/* Cloud AI */}
        <div className="card-glass p-6 border-2 border-destructive/40 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <h2 className="text-xl font-bold text-destructive">CLOUD AI</h2>
              <p className="text-xs text-muted-foreground">{data?.cloud?.model || "GPT-4"}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Latency: <strong className="text-foreground">{data?.cloud?.latency || "~1200ms"}</strong></p>
            <div>
              <span className="text-muted-foreground">Data sent:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(data?.cloud?.data_sent || ["Sleep data", "Heart rate", "HRV", "Location"]).map((d: string) => (
                  <span key={d} className="px-2 py-0.5 rounded bg-destructive/20 text-destructive text-xs">{d}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-destructive text-xs font-semibold">Data sent to external servers</span>
            </div>
          </div>
          {data?.cloud?.response && (
            <div className="bg-accent rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">AI Response:</p>
              <p className="text-sm leading-relaxed">{data.cloud.response}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="card-glass p-6 text-center space-y-4">
        <p className="text-muted-foreground italic">
          "Same quality coaching. Same data analysis. One keeps your data on your device. One sends it to external servers."
        </p>

        {data?.data_exposure && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Data exposure if cloud-based:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {data.data_exposure.map((item: string) => (
                <span key={item} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs">{item}</span>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm font-semibold text-success">
          With YU RestOS: Zero bytes sent. Granite 3.3 on-device.
        </p>
      </div>
    </div>
  );
};

export default XRay;
