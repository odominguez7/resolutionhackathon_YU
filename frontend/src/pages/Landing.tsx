import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Brain, Zap } from "lucide-react";

const features = [
  { icon: Moon, title: "Sleep", desc: "Eight Sleep biometrics analyzed nightly — HRV, heart rate, sleep stages, temperature." },
  { icon: Brain, title: "Mind", desc: "30-second behavioral check-ins capture mood, energy, and stress trends over time." },
  { icon: Zap, title: "Action", desc: "AI executes a real recovery plan — adjusting devices, scheduling, and recommending products." },
];

const sponsors = ["Eight Sleep", "Clair Health", "Duckbill", "Fragile", "swsh", "Wayfair"];

const Landing = () => (
  <div className="fade-in min-h-screen flex flex-col">
    {/* Hero */}
    <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 max-w-4xl mx-auto">
      <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
        Your sleep data has a story.{" "}
        <span className="gradient-text">YU RestOS</span> reads it.
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
        Connect Eight Sleep biometrics with your daily wellbeing to detect burnout before you feel it.
        Then execute a real recovery plan. All processing happens on your device.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link to="/dashboard">
          <Button size="xl" variant="hero">See My Dashboard</Button>
        </Link>
        <Link to="/checkin">
          <Button size="xl" variant="outline">30-Second Check-in</Button>
        </Link>
      </div>
    </section>

    {/* Features */}
    <section className="grid md:grid-cols-3 gap-6 px-6 pb-16 max-w-5xl mx-auto w-full">
      {features.map((f) => (
        <div key={f.title} className="card-glass p-6 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <f.icon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-bold">{f.title}</h3>
          <p className="text-sm text-muted-foreground">{f.desc}</p>
        </div>
      ))}
    </section>

    {/* Sponsors */}
    <footer className="border-t border-border py-8 px-6 text-center">
      <p className="text-xs text-muted-foreground mb-3 tracking-widest uppercase">Built for</p>
      <div className="flex flex-wrap justify-center gap-6">
        {sponsors.map((s) => (
          <span key={s} className="text-sm font-medium text-muted-foreground/70">{s}</span>
        ))}
      </div>
    </footer>
  </div>
);

export default Landing;
