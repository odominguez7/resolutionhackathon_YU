import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Zap, Shield } from "lucide-react";
import { useEffect, useRef } from "react";

const features = [
  {
    icon: Brain,
    title: "Detect",
    desc: "Dual-signal burnout detection combining Eight Sleep biometrics with behavioral data.",
  },
  {
    icon: Zap,
    title: "Act",
    desc: "One-tap recovery: adjust your bed temp, block your calendar, book wellness sessions.",
  },
  {
    icon: Shield,
    title: "Private",
    desc: "Granite 3.3 runs on your device. Zero data sent to external servers.",
  },
];

const stats = [
  { value: "14-day", label: "burnout arc" },
  { value: "5", label: "recovery actions" },
  { value: "3-day", label: "recovery" },
  { value: "0 bytes", label: "sent" },
];

const sponsors = [
  "Eight Sleep",
  "Clair Health",
  "Duckbill",
  "Fragile",
  "swsh",
  "Wayfair",
];

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("fade-in-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`fade-in-section ${className}`}>
      {children}
    </div>
  );
}

const Landing = () => (
  <>
    <style>{`
      @keyframes orbPulse {
        0%, 100% { transform: scale(1); opacity: 0.35; }
        50% { transform: scale(1.15); opacity: 0.55; }
      }
      @keyframes orbRotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes heroFadeUp {
        0% { opacity: 0; transform: translateY(32px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      .orb {
        position: absolute;
        width: 520px;
        height: 520px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(139,92,246,0.25) 40%, transparent 70%);
        animation: orbPulse 4s ease-in-out infinite;
        filter: blur(80px);
        pointer-events: none;
        z-index: 0;
      }
      .orb-ring {
        position: absolute;
        width: 600px;
        height: 600px;
        border-radius: 50%;
        border: 1px solid rgba(139,92,246,0.15);
        animation: orbRotate 20s linear infinite;
        pointer-events: none;
        z-index: 0;
      }
      .orb-ring::before {
        content: '';
        position: absolute;
        top: -4px;
        left: 50%;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #8b5cf6;
        box-shadow: 0 0 20px 4px rgba(139,92,246,0.6);
      }
      .hero-fade-1 { animation: heroFadeUp 0.8s ease-out both; }
      .hero-fade-2 { animation: heroFadeUp 0.8s ease-out 0.15s both; }
      .hero-fade-3 { animation: heroFadeUp 0.8s ease-out 0.3s both; }
      .hero-fade-4 { animation: heroFadeUp 0.8s ease-out 0.45s both; }
      .gradient-hero {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: shimmer 4s linear infinite;
      }
      .fade-in-section {
        opacity: 0;
        transform: translateY(28px);
        transition: opacity 0.7s ease-out, transform 0.7s ease-out;
      }
      .fade-in-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .card-hover {
        transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
      }
      .card-hover:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 40px rgba(59,130,246,0.12), 0 0 0 1px rgba(139,92,246,0.15);
        border-color: rgba(139,92,246,0.3);
      }
      .stat-divider {
        width: 1px;
        height: 48px;
        background: linear-gradient(to bottom, transparent, rgba(139,92,246,0.3), transparent);
      }
    `}</style>

    <div className="min-h-screen flex flex-col" style={{ background: "#0f172a" }}>
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-32 overflow-hidden">
        {/* Orb effects */}
        <div className="orb" style={{ top: "50%", left: "50%", marginTop: "-260px", marginLeft: "-260px" }} />
        <div className="orb-ring" style={{ top: "50%", left: "50%", marginTop: "-300px", marginLeft: "-300px" }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <p className="hero-fade-1 text-sm font-semibold tracking-[0.25em] uppercase mb-8"
             style={{ color: "rgba(139,92,246,0.8)" }}>
            AI Sleep Recovery Engine
          </p>

          <h1 className="hero-fade-2 text-5xl md:text-7xl font-extrabold leading-[1.08] tracking-tight mb-8 text-white">
            Your sleep data has a story.
            <br />
            <span className="gradient-hero">YU RestOS</span> reads it
            <br className="hidden md:block" />
            {" "}&mdash; then fixes it.
          </h1>

          <p className="hero-fade-3 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
             style={{ color: "rgba(255,255,255,0.55)" }}>
            Detect burnout before you feel it. Execute real recovery actions.
            All on your device.
          </p>

          <div className="hero-fade-4 flex gap-4 flex-wrap justify-center">
            <Link to="/dashboard">
              <Button
                size="lg"
                className="px-8 py-6 text-base font-semibold text-white rounded-xl shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  boxShadow: "0 4px 24px rgba(59,130,246,0.35)",
                }}
              >
                See My Dashboard
              </Button>
            </Link>
            <Link to="/oura">
              <Button
                size="lg"
                className="px-8 py-6 text-base font-semibold rounded-xl"
                style={{
                  color: "#10b981",
                  borderColor: "rgba(16,185,129,0.4)",
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                My Oura Ring Data
              </Button>
            </Link>
            <Link to="/checkin">
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-base font-semibold rounded-xl"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  borderColor: "rgba(139,92,246,0.4)",
                  background: "transparent",
                }}
              >
                30-Second Check-in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <FadeSection>
        <section className="grid md:grid-cols-3 gap-6 px-6 pb-20 pt-8 max-w-5xl mx-auto w-full">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card-hover rounded-2xl p-8 flex flex-col items-center text-center gap-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))",
                }}
              >
                <f.icon className="w-7 h-7" style={{ color: "#8b5cf6" }} />
              </div>
              <h3 className="text-xl font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </section>
      </FadeSection>

      {/* Stats */}
      <FadeSection>
        <section className="px-6 pb-24 max-w-4xl mx-auto w-full">
          <div
            className="rounded-2xl px-8 py-10 flex flex-wrap items-center justify-center gap-8 md:gap-0"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center">
                {i > 0 && <div className="stat-divider hidden md:block mx-8" />}
                <div className="text-center px-4">
                  <p
                    className="text-3xl md:text-4xl font-extrabold mb-1"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {s.value}
                  </p>
                  <p className="text-xs font-medium tracking-wider uppercase"
                     style={{ color: "rgba(255,255,255,0.4)" }}>
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* Sponsors */}
      <FadeSection>
        <footer
          className="py-12 px-6 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase mb-6"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Built for Resolution Hackathon with
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {sponsors.map((s) => (
              <span
                key={s}
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {s}
              </span>
            ))}
          </div>
        </footer>
      </FadeSection>
    </div>
  </>
);

export default Landing;
