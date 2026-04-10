import { Link } from "react-router-dom";
import { Dumbbell, ArrowRight, Activity, Brain, Zap, Target, Shield, TrendingUp } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const ease = [0.2, 0.8, 0.2, 1] as const;

/* ── Animated counter ── */
function useCounter(target: string, inView: boolean) {
  const [display, setDisplay] = useState("0");
  const numericMatch = target.match(/^([<>]?)(\$?)([\d,]+)(\+?)$/);
  useEffect(() => {
    if (!inView || !numericMatch) { if (!numericMatch) setDisplay(target); return; }
    const prefix = (numericMatch[1] || "") + (numericMatch[2] || "");
    const suffix = numericMatch[4] || "";
    const end = parseInt(numericMatch[3].replace(/,/g, ""), 10);
    const steps = 60; let step = 0;
    const timer = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      const current = Math.round(eased * end);
      setDisplay(`${prefix}${current >= 1000 ? current.toLocaleString() : current}${suffix}`);
      if (step >= steps) clearInterval(timer);
    }, 1800 / steps);
    return () => clearInterval(timer);
  }, [inView, target]);
  return display;
}

function Stat({ value, label, index }: { value: string; label: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const display = useCounter(value, inView);
  return (
    <motion.div ref={ref} className="text-center"
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: index * 0.1, duration: 0.5, ease }}>
      <p className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: "#FF5C35" }}>{display}</p>
      <p className="text-[10px] font-bold tracking-wider uppercase mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</p>
    </motion.div>
  );
}

/* ── Main ── */
const Landing = () => {
  const features = [
    {
      icon: Activity,
      title: "Reads your body",
      desc: "HRV, readiness, sleep, heart rate, respiratory rate, stress. From your Oura Ring or Apple Watch. Real numbers, not guesses.",
      color: "#6EE7FF",
    },
    {
      icon: Dumbbell,
      title: "Programs your workout",
      desc: "A 3-layer system picks the structure, loads, and movements. The AI writes the session. A validator checks every movement against your equipment and catalog.",
      color: "#FF5C35",
    },
    {
      icon: TrendingUp,
      title: "Gets harder as you do",
      desc: "Every movement tracks load across sessions. Hit the prescribed weight twice cleanly, it bumps. Grind at RPE 10, it holds. Your progression, not a template.",
      color: "#C2FF4A",
    },
    {
      icon: Shield,
      title: "Catches overtraining before you feel it",
      desc: "Four biometric signals compared against your personal baselines with statistical control limits. If your body needs rest, the system forces it.",
      color: "#FFC36B",
    },
    {
      icon: Brain,
      title: "Learns when you train and when you skip",
      desc: "The behavioral agent tracks your streak, your skip patterns, your preferred time of day. It adjusts session length and sends a nudge when you're most likely to show up.",
      color: "#A78BFA",
    },
    {
      icon: Zap,
      title: "Closes the loop every morning",
      desc: "Tomorrow's HRV tells the system whether yesterday's workout was too much, just right, or not enough. That verdict shapes the next session. Every day sharper.",
      color: "#FF5D6C",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0b0d" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 rgba(255,92,53,0.3)} 50%{box-shadow:0 0 0 20px rgba(255,92,53,0)} }
      `}</style>

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(255,92,53,0.06) 0%, transparent 70%)" }} />

        <motion.div className="relative z-10 max-w-2xl mx-auto">
          {/* Badge */}
          <motion.div className="flex justify-center mb-6"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease }}>
            <div className="px-4 py-1.5 rounded-full flex items-center gap-2"
              style={{ background: "rgba(255,92,53,0.08)", border: "1px solid rgba(255,92,53,0.2)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#C2FF4A", animation: "pulse-glow 2s ease-in-out infinite" }} />
              <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "#FF5C35" }}>Training OS</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease }}
            className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight mb-5 text-white">
            Your body already knows<br />what to train.{" "}
            <span style={{ color: "#FF5C35" }}>YU listens.</span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-sm md:text-base max-w-lg mx-auto leading-relaxed mb-8"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            YU reads your wearable, programs today's workout, tracks every set, and adjusts tomorrow based on how your body responded. Not a template. Not a guess. Your data, your workout, every day.
          </motion.p>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link to="/onboarding" className="no-underline">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-xl font-black text-sm tracking-wide border-0 cursor-pointer flex items-center gap-2"
                style={{ background: "#FF5C35", color: "#fff", boxShadow: "0 0 40px rgba(255,92,53,0.3)" }}>
                Start training <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link to="/oura" className="no-underline">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="px-6 py-4 rounded-xl font-bold text-sm tracking-wide border-0 cursor-pointer"
                style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                See a live workout
              </motion.button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.5 }}
            className="flex items-center justify-center gap-8 md:gap-12">
            {[
              { value: "183+", label: "days trained" },
              { value: "8", label: "movements auto-progressed" },
              { value: "3", label: "ML models learning you" },
            ].map((s, i) => <Stat key={s.label} value={s.value} label={s.label} index={i} />)}
          </motion.div>
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              Not an app. A system.
            </h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
              Six layers working together. The AI proposes. The rules enforce. Your body decides.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title}
                className="rounded-2xl p-6"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${f.color}10`, border: `1px solid ${f.color}20` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white mb-1">{f.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>{f.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The loop ── */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div className="rounded-2xl p-8 text-center"
            style={{ background: "rgba(255,92,53,0.03)", border: "1px solid rgba(255,92,53,0.1)" }}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
            <h3 className="text-xl font-black text-white mb-3">The closed loop</h3>
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap mb-4">
              {["Wearable data", "Readiness score", "Workout generated", "You train", "RPE logged", "Next-morning HRV", "System learns"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight className="w-3 h-3" style={{ color: "rgba(255,92,53,0.3)" }} />}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(255,92,53,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
              Every session feeds the next one. The system measures whether the workout helped or hurt, and adjusts. After 30 sessions, it knows your body better than any coach.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, ease }}>
          <h3 className="text-2xl md:text-3xl font-black text-white mb-3">
            Ready to stop guessing?
          </h3>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Connect your wearable. Get your first workout in under 3 minutes.
          </p>
          <Link to="/onboarding" className="no-underline">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-xl font-black text-base border-0 cursor-pointer"
              style={{ background: "#FF5C35", color: "#fff", boxShadow: "0 0 40px rgba(255,92,53,0.25)" }}>
              Start training
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <div className="text-center py-8">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3">
          {["Oura Ring", "Apple Watch", "Gemini 2.5 Flash", "XGBoost", "LangGraph"].map((s) => (
            <span key={s} className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.1)" }}>{s}</span>
          ))}
        </div>
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.06)" }}>
          YU
        </p>
      </div>
    </div>
  );
};

export default Landing;
