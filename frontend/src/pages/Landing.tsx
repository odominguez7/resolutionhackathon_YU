import { Link } from "react-router-dom";
import { Brain, Zap, Activity, ArrowRight, Eye, Crosshair, BarChart3, Bot, MessageSquare, Users } from "lucide-react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, useInView } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";

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
      const formatted = current >= 1000 ? current.toLocaleString() : String(current);
      setDisplay(`${prefix}${formatted}${suffix}`);
      if (step >= steps) clearInterval(timer);
    }, 1800 / steps);
    return () => clearInterval(timer);
  }, [inView, target]);
  return display;
}

function AnimatedStat({ value, label, index }: { value: string; label: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const display = useCounter(value, inView);
  return (
    <motion.div ref={ref} className="text-center px-4"
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: index * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <p className="text-3xl md:text-4xl font-extrabold mb-1 tabular-nums"
        style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {display}
      </p>
      <p className="text-[10px] font-medium tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
    </motion.div>
  );
}

/* ── Gradient mesh ── */
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <motion.div className="absolute"
        style={{ width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)", filter: "blur(120px)", top: "20%", left: "30%" }}
        animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.2, 0.9, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute"
        style={{ width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", filter: "blur(100px)", top: "40%", right: "20%" }}
        animate={{ x: [0, -60, 30, 0], y: [0, 50, -80, 0], scale: [1, 0.85, 1.15, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} />
    </div>
  );
}

/* ── Main ── */
const Landing = () => {
  const stats = [
    { value: "170+", label: "days of real data" },
    { value: "6", label: "biometric signals" },
    { value: "5", label: "agent tools" },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes orbRotate { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)} 50%{box-shadow:0 0 0 16px rgba(59,130,246,0)} }
        .gradient-hero { background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 50%,#3b82f6 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 4s linear infinite; }
        html { scroll-behavior: smooth; }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ background: "#0a0e1a" }}>

        {/* ── Hero ── */}
        <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
          <GradientMesh />

          <motion.div className="relative z-10 max-w-2xl mx-auto">
            {/* Agent avatar */}
            <motion.div className="flex justify-center mb-6"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}>
              <div className="relative">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(59,130,246,0.2)", animation: "pulse-ring 3s ease-in-out infinite" }}>
                  <Bot className="w-7 h-7" style={{ color: "#818cf8" }} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "#0f172a", border: "2px solid #22c55e" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                </div>
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: "rgba(139,92,246,0.6)" }}>
              Behavioral Intelligence Agent
            </motion.p>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-4 text-white">
              Detects burnout before <span className="gradient-hero">you feel it</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}
              className="text-sm md:text-base max-w-lg mx-auto leading-relaxed mb-8"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              YU monitors your biometric signals from Oura Ring, detects when you're drifting toward burnout, delivers CBT-grounded interventions, and measures whether they actually worked.
            </motion.p>

            {/* Primary CTA */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Link to="/agent" className="no-underline">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide border-0 cursor-pointer flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #7c3aed)", color: "#fff", boxShadow: "0 0 30px rgba(59,130,246,0.3)" }}>
                  <Bot className="w-4 h-4" /> Watch the Agent Run
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
              <Link to="/ask" className="no-underline">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide border-0 cursor-pointer flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <MessageSquare className="w-4 h-4" /> Ask YU
                </motion.button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.6 }}
              className="flex items-center justify-center gap-2">
              {stats.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  {i > 0 && <div className="w-px h-8" style={{ background: "rgba(139,92,246,0.15)" }} />}
                  <AnimatedStat value={s.value} label={s.label} index={i} />
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ── How it works ── */}
        <section className="relative py-16 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 800px 500px at 50% 40%, rgba(59,130,246,0.05) 0%, transparent 70%)" }} />
          <div className="max-w-2xl mx-auto relative z-10">
            <motion.div className="text-center mb-10"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-2 text-white">
                How it works
              </h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                An autonomous loop that runs every 6 hours
              </p>
            </motion.div>

            {/* 5 phases */}
            <div className="grid grid-cols-5 gap-2 md:gap-4 mb-12">
              {[
                { icon: Eye, label: "Sense", desc: "Pull biometric signals from Oura Ring", color: "#3b82f6" },
                { icon: Brain, label: "Think", desc: "Detect drift across 6 weighted signals", color: "#8b5cf6" },
                { icon: Crosshair, label: "Decide", desc: "LLM reasons about what to do", color: "#f59e0b" },
                { icon: Zap, label: "Act", desc: "Execute coaching, calendar, sleep fixes", color: "#22c55e" },
                { icon: BarChart3, label: "Measure", desc: "Score if the intervention worked", color: "#ec4899" },
              ].map((p, i) => (
                <motion.div key={p.label} className="flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}>
                  <div className="w-11 h-11 md:w-14 md:h-14 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: `${p.color}12`, border: `1px solid ${p.color}25` }}>
                    <p.icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: p.color }} />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest" style={{ color: p.color }}>{p.label}</span>
                  <span className="text-[8px] md:text-[9px] mt-0.5 hidden md:block leading-tight" style={{ color: "rgba(255,255,255,0.2)" }}>{p.desc}</span>
                </motion.div>
              ))}
            </div>

            {/* Explore cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link to="/agent" className="no-underline">
                <motion.div className="rounded-2xl p-5 text-center cursor-pointer h-full"
                  style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}
                  whileHover={{ y: -4, borderColor: "rgba(59,130,246,0.25)" }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                  <Bot className="w-6 h-6 mx-auto mb-2" style={{ color: "#3b82f6" }} />
                  <p className="text-[13px] font-bold mb-1" style={{ color: "#e2e8f0" }}>Agent Loop</p>
                  <p className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.25)" }}>Watch the autonomous sense-think-decide-act-measure cycle run in real time</p>
                </motion.div>
              </Link>
              <Link to="/ask" className="no-underline">
                <motion.div className="rounded-2xl p-5 text-center cursor-pointer h-full"
                  style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}
                  whileHover={{ y: -4, borderColor: "rgba(139,92,246,0.25)" }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                  <MessageSquare className="w-6 h-6 mx-auto mb-2" style={{ color: "#8b5cf6" }} />
                  <p className="text-[13px] font-bold mb-1" style={{ color: "#e2e8f0" }}>Ask YU</p>
                  <p className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.25)" }}>Chat with the agent. It knows your biometrics, drift state, and what interventions worked</p>
                </motion.div>
              </Link>
              <Link to="/employer" className="no-underline">
                <motion.div className="rounded-2xl p-5 text-center cursor-pointer h-full"
                  style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}
                  whileHover={{ y: -4, borderColor: "rgba(34,197,94,0.25)" }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                  <Users className="w-6 h-6 mx-auto mb-2" style={{ color: "#22c55e" }} />
                  <p className="text-[13px] font-bold mb-1" style={{ color: "#e2e8f0" }}>Employer View</p>
                  <p className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.25)" }}>Anonymous team-level drift analytics. No individual data exposed</p>
                </motion.div>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-2">
            {["Oura Ring", "Gemini 2.5", "NANDA / Join39", "170+ days real data"].map((s) => (
              <span key={s} className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.12)" }}>{s}</span>
            ))}
          </div>
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.06)" }}>
            YU -- MIT MAS.664 AI Studio
          </p>
        </div>
      </div>
    </>
  );
};

export default Landing;
