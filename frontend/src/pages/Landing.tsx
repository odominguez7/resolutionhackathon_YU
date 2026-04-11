import { Link } from "react-router-dom";
import { ArrowRight, Activity, Brain, Zap, Shield, TrendingUp, Dumbbell, ChevronRight } from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

/* ── Animated counter ── */
function useCounter(target: string, inView: boolean) {
  const [display, setDisplay] = useState("0");
  const numericMatch = target.match(/^([<>]?)(\$?)([\d,]+)(\+?)$/);
  useEffect(() => {
    if (!inView || !numericMatch) { if (!numericMatch) setDisplay(target); return; }
    const prefix = (numericMatch[1] || "") + (numericMatch[2] || "");
    const suffix = numericMatch[4] || "";
    const end = parseInt(numericMatch[3].replace(/,/g, ""), 10);
    const steps = 80; let step = 0;
    const timer = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 4);
      const current = Math.round(eased * end);
      setDisplay(`${prefix}${current >= 1000 ? current.toLocaleString() : current}${suffix}`);
      if (step >= steps) clearInterval(timer);
    }, 2000 / steps);
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
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: index * 0.12, duration: 0.7, ease }}>
      <p className="text-4xl md:text-5xl font-black tabular-nums tracking-tight"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>
        {display}
      </p>
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mt-2"
        style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
    </motion.div>
  );
}

/* ── Animated Readiness Ring (hero SVG) ── */
function ReadinessRing() {
  const r = 120, stroke = 6, circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: 280, height: 280 }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,92,53,0.15) 0%, transparent 70%)", animation: "glow-breathe 4s ease-in-out infinite" }} />
      {/* Ring SVG */}
      <svg width="280" height="280" viewBox="0 0 280 280" className="relative z-10">
        {/* Track */}
        <circle cx="140" cy="140" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
        {/* Recovery ring (outer) */}
        <circle cx="140" cy="140" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke}
          strokeLinecap="round" transform="rotate(-90 140 140)"
          strokeDasharray={circ} strokeDashoffset={circ * 0.18}
          style={{ animation: "draw-in 2s ease-out 0.5s both", ["--dash-length" as string]: circ }} />
        {/* Inner ring */}
        <circle cx="140" cy="140" r={r - 16} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={4} />
        <circle cx="140" cy="140" r={r - 16} fill="none" stroke="url(#ringGrad2)" strokeWidth={4}
          strokeLinecap="round" transform="rotate(-90 140 140)"
          strokeDasharray={2 * Math.PI * (r - 16)} strokeDashoffset={2 * Math.PI * (r - 16) * 0.3}
          style={{ animation: "draw-in 2.2s ease-out 0.8s both", ["--dash-length" as string]: 2 * Math.PI * (r - 16) }} />
        {/* Score */}
        <text x="140" y="128" textAnchor="middle" fill="white" fontSize="56" fontWeight="900"
          style={{ fontFamily: "'Space Grotesk', sans-serif", animation: "oura-number-pop 0.8s ease-out 1.2s both" }}>
          82
        </text>
        <text x="140" y="154" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11"
          fontWeight="700" letterSpacing="3" style={{ textTransform: "uppercase" }}>
          READINESS
        </text>
        {/* Gradients */}
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF5C35" />
            <stop offset="100%" stopColor="#FF8F6B" />
          </linearGradient>
          <linearGradient id="ringGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6EE7FF" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      {/* Floating data points */}
      {[
        { label: "HRV", value: "48ms", x: -60, y: 40, color: "#6EE7FF", delay: 1.5 },
        { label: "Sleep", value: "7h 42m", x: 260, y: 60, color: "#A78BFA", delay: 1.7 },
        { label: "Strain", value: "Low", x: 270, y: 180, color: "#C2FF4A", delay: 1.9 },
      ].map((d) => (
        <motion.div key={d.label} className="absolute z-20"
          style={{ left: d.x, top: d.y }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: d.delay, duration: 0.6, ease }}>
          <div className="px-3 py-1.5 rounded-xl flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
            <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{d.label}</span>
            <span className="text-[11px] font-black text-white">{d.value}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Loop Step (animated circle diagram) ── */
function LoopDiagram() {
  const steps = [
    { label: "Wearable\nData", color: "#6EE7FF", icon: Activity },
    { label: "Readiness\nScore", color: "#A78BFA", icon: Shield },
    { label: "Workout\nGenerated", color: "#FF5C35", icon: Dumbbell },
    { label: "You\nTrain", color: "#C2FF4A", icon: Zap },
    { label: "RPE\nLogged", color: "#FFC36B", icon: TrendingUp },
    { label: "Next-day\nHRV", color: "#FF5D6C", icon: Activity },
    { label: "System\nLearns", color: "#6EE7FF", icon: Brain },
  ];
  const r = 140;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="relative" style={{ width: 340, height: 340 }}>
      {/* Center glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,92,53,0.2) 0%, transparent 70%)", animation: "glow-breathe 3s ease-in-out infinite" }} />
      </div>
      {/* Orbit path */}
      <svg width="340" height="340" viewBox="0 0 340 340" className="absolute inset-0">
        <circle cx="170" cy="170" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 8" />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "rgba(255,92,53,0.6)" }}>CLOSED</p>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "rgba(255,92,53,0.6)" }}>LOOP</p>
        </div>
      </div>
      {/* Step nodes */}
      {steps.map((s, i) => {
        const angle = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
        const x = 170 + r * Math.cos(angle);
        const y = 170 + r * Math.sin(angle);
        const Icon = s.icon;
        return (
          <motion.div key={s.label} className="absolute z-20 flex flex-col items-center"
            style={{ left: x - 24, top: y - 24 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: `${s.color}15`, border: `1.5px solid ${s.color}30` }}>
              <Icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <p className="text-[8px] font-bold text-center mt-1.5 whitespace-pre-line leading-tight"
              style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Feature Card (premium) ── */
function FeatureCard({ icon: Icon, title, desc, color, image, index }: {
  icon: any; title: string; desc: string; color: string; image: string; index: number;
}) {
  return (
    <motion.div className="group relative overflow-hidden rounded-2xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.1, duration: 0.7, ease }}
      whileHover={{ y: -4, borderColor: `${color}25` }}>
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}08, transparent 70%)` }} />
      {/* Image area */}
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ filter: "brightness(0.4) saturate(1.2)" }}
          loading="lazy" />
        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, transparent 0%, #0a0b0d 100%)` }} />
        {/* Icon badge */}
        <div className="absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}25`, backdropFilter: "blur(12px)" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {/* Content */}
      <div className="p-6 pt-0 relative z-10" style={{ marginTop: -24 }}>
        <h3 className="text-base font-black text-white mb-2">{title}</h3>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN LANDING
   ══════════════════════════════════════════════════════════ */
const Landing = () => {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const features = [
    {
      icon: Activity, title: "Reads your body",
      desc: "HRV, readiness, sleep, heart rate, respiratory rate, stress — all from your Oura Ring or Apple Watch. Real numbers, not guesses.",
      color: "#6EE7FF",
      image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format",
    },
    {
      icon: Dumbbell, title: "Programs your workout",
      desc: "A 3-layer system picks structure, loads, and movements. The AI writes the session. A validator checks every movement against your equipment.",
      color: "#FF5C35",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&auto=format",
    },
    {
      icon: TrendingUp, title: "Gets harder as you do",
      desc: "Every movement tracks load across sessions. Hit the prescribed weight twice cleanly — it bumps. Grind at RPE 10 — it holds.",
      color: "#C2FF4A",
      image: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&q=80&auto=format",
    },
    {
      icon: Shield, title: "Catches overtraining",
      desc: "Four biometric signals compared against your baselines with statistical control limits. If your body needs rest, the system forces it.",
      color: "#FFC36B",
      image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80&auto=format",
    },
    {
      icon: Brain, title: "Learns your patterns",
      desc: "The behavioral agent tracks your streak, skip patterns, and preferred training time. It adjusts and nudges when you're most likely to show up.",
      color: "#A78BFA",
      image: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80&auto=format",
    },
    {
      icon: Zap, title: "Closes the loop daily",
      desc: "Tomorrow's HRV tells the system whether yesterday's workout was too much, just right, or not enough. Every day sharper.",
      color: "#FF5D6C",
      image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80&auto=format",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative noise-overlay" style={{ background: "#0a0b0d" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes oura-number-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes glow-breathe { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes draw-in { from{stroke-dashoffset:var(--dash-length)} to{stroke-dashoffset:0} }
      `}</style>

      {/* ═══ HERO ═══ */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden">

        {/* Background hero image */}
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1600&q=80&auto=format"
            alt="" className="w-full h-full object-cover"
            style={{ filter: "brightness(0.15) saturate(1.3)" }} />
          {/* Gradient overlays */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,11,13,0.3) 0%, rgba(10,11,13,0.95) 85%, #0a0b0d 100%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 800px 600px at 50% 35%, rgba(255,92,53,0.08) 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Badge */}
          <motion.div className="mb-8"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="px-4 py-2 rounded-full flex items-center gap-2.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#C2FF4A", boxShadow: "0 0 8px rgba(194,255,74,0.5)" }} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                AI Training OS
              </span>
            </div>
          </motion.div>

          {/* Main layout: text + ring */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* Left: Copy */}
            <div className="flex-1 text-center lg:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.9, ease }}
                className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-[-0.03em] mb-6 text-white"
                style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                Your body<br />
                already knows.<br />
                <span className="text-glow-pulse">YU listens.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
                className="text-base md:text-lg max-w-xl leading-relaxed mb-10"
                style={{ color: "rgba(255,255,255,0.4)" }}>
                YU reads your wearable, programs today's workout, tracks every set,
                and adjusts tomorrow based on how your body responded.
              </motion.p>

              {/* CTAs */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
                className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                <Link to="/onboarding" className="no-underline">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="group px-8 py-4 rounded-2xl font-black text-sm tracking-wide border-0 cursor-pointer flex items-center gap-2 transition-shadow duration-300"
                    style={{ background: "linear-gradient(135deg, #FF5C35, #FF7A54)", color: "#fff",
                      boxShadow: "0 0 40px rgba(255,92,53,0.25), 0 4px 20px rgba(255,92,53,0.2)" }}>
                    Start training
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                </Link>
                <a href="#how-it-works" className="no-underline">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="px-6 py-4 rounded-2xl font-bold text-sm tracking-wide border-0 cursor-pointer transition-all duration-300"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    See how it works
                  </motion.button>
                </a>
              </motion.div>
            </div>

            {/* Right: Readiness Ring */}
            <motion.div className="flex-shrink-0 hidden md:block"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 1, ease }}>
              <ReadinessRing />
            </motion.div>
          </div>

          {/* Stats bar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-20 w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-12 md:gap-20 py-6 px-8 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}>
              {[
                { value: "183+", label: "days trained" },
                { value: "8", label: "auto-progressed" },
                { value: "3", label: "ML models" },
              ].map((s, i) => <Stat key={s.label} value={s.value} label={s.label} index={i} />)}
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }}>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full flex items-start justify-center pt-2"
            style={{ border: "1.5px solid rgba(255,255,255,0.1)" }}>
            <div className="w-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ═══ PARTNER STRIP ═══ */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] text-center font-bold tracking-[0.3em] uppercase mb-6"
            style={{ color: "rgba(255,255,255,0.15)" }}>Powered by</p>
          <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap">
            {[
              { name: "Oura Ring", logo: "/oura-logo.png" },
              { name: "Eight Sleep", logo: "/eightsleep-logo.png" },
            ].map((p) => (
              <img key={p.name} src={p.logo} alt={p.name}
                className="h-6 md:h-7 object-contain" style={{ filter: "brightness(0.5) grayscale(0.5)", opacity: 0.5 }} />
            ))}
            {["Apple Watch", "Google Gemini", "XGBoost"].map((name) => (
              <span key={name} className="text-[11px] font-bold tracking-wider"
                style={{ color: "rgba(255,255,255,0.15)" }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRODUCT EXPLANATION — 3 STEPS ═══ */}
      <section className="py-24 px-6" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.8, ease }}>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: "#FF5C35" }}>
              How it works
            </p>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.05]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Three steps. Zero guesswork.
            </h2>
          </motion.div>

          <div className="space-y-32">
            {/* Step 1 */}
            <motion.div className="flex flex-col md:flex-row items-center gap-12"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, ease }}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: "rgba(110,231,255,0.1)", color: "#6EE7FF", border: "1px solid rgba(110,231,255,0.2)" }}>1</span>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#6EE7FF" }}>Connect</p>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                  Your ring talks to YU.
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  One tap connects your Oura Ring or Apple Watch. YU instantly reads 170+ days of sleep, HRV, readiness, and stress data.
                  No CSV exports. No manual entry. Your body's story, told in numbers.
                </p>
              </div>
              <div className="flex-1 relative">
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(110,231,255,0.1)" }}>
                  <img src="https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=800&q=80&auto=format"
                    alt="Wearable data" className="w-full h-64 object-cover"
                    style={{ filter: "brightness(0.35) saturate(1.2)" }} loading="lazy" />
                  <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(110,231,255,0.05) 0%, transparent 50%)" }} />
                </div>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div className="flex flex-col md:flex-row-reverse items-center gap-12"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, ease }}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: "rgba(255,92,53,0.1)", color: "#FF5C35", border: "1px solid rgba(255,92,53,0.2)" }}>2</span>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#FF5C35" }}>Train</p>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                  AI writes your session.
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Based on your readiness, recovery state, and training history — YU generates the exact workout for today.
                  Structure, loads, movements, rest times. Then validates every exercise against your equipment and ability.
                </p>
              </div>
              <div className="flex-1 relative">
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,92,53,0.1)" }}>
                  <img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80&auto=format"
                    alt="AI workout" className="w-full h-64 object-cover"
                    style={{ filter: "brightness(0.35) saturate(1.2)" }} loading="lazy" />
                  <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(255,92,53,0.05) 0%, transparent 50%)" }} />
                </div>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div className="flex flex-col md:flex-row items-center gap-12"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, ease }}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: "rgba(194,255,74,0.1)", color: "#C2FF4A", border: "1px solid rgba(194,255,74,0.2)" }}>3</span>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#C2FF4A" }}>Adapt</p>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                  Tomorrow adjusts automatically.
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Your next-morning HRV tells YU whether yesterday's session was too much, just right, or not enough.
                  The system learns. Every day it gets sharper. After 30 sessions, it knows your body better than any coach.
                </p>
              </div>
              <div className="flex-1 relative">
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(194,255,74,0.1)" }}>
                  <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80&auto=format"
                    alt="Recovery adaptation" className="w-full h-64 object-cover"
                    style={{ filter: "brightness(0.35) saturate(1.2)" }} loading="lazy" />
                  <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(194,255,74,0.05) 0%, transparent 50%)" }} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
              The System
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Not an app. <span className="text-glow-pulse">A training OS.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE CLOSED LOOP (visual) ═══ */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 800px 500px at 50% 50%, rgba(255,92,53,0.04) 0%, transparent 70%)" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase mb-4" style={{ color: "#FF5C35" }}>
              The Engine
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Every session feeds the next.
            </h2>
            <p className="text-sm max-w-lg mx-auto mb-16" style={{ color: "rgba(255,255,255,0.3)" }}>
              The closed loop is the core of YU. Seven steps that repeat every day,
              each one making the system sharper, your workouts better, your recovery smarter.
            </p>
          </motion.div>

          <div className="flex justify-center">
            <LoopDiagram />
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF / QUOTE ═══ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div className="rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,92,53,0.04) 0%, transparent 60%)" }} />
            <p className="text-xl md:text-2xl font-black text-white leading-relaxed mb-6 relative z-10"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              "I stopped guessing what to do in the gym. YU reads my Oura data, builds the workout, and adjusts when I'm crushed.
              183 days in and my HRV baseline has gone up 12%."
            </p>
            <div className="flex items-center justify-center gap-3 relative z-10">
              <img src="/me.png" alt="User" className="w-10 h-10 rounded-full object-cover"
                style={{ border: "2px solid rgba(255,92,53,0.3)" }} />
              <div className="text-left">
                <p className="text-sm font-bold text-white">Omar</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Founder · 183-day streak</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 600px 400px at 50% 80%, rgba(255,92,53,0.06) 0%, transparent 70%)" }} />
        <motion.div className="max-w-2xl mx-auto text-center relative z-10"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8, ease }}>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-5 tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ready to stop guessing?
          </h2>
          <p className="text-base mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
            Connect your wearable. Get your first AI workout in under 3 minutes.
          </p>
          <Link to="/onboarding" className="no-underline">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="group px-12 py-5 rounded-2xl font-black text-base border-0 cursor-pointer flex items-center gap-3 mx-auto transition-shadow duration-300"
              style={{ background: "linear-gradient(135deg, #FF5C35, #FF7A54)", color: "#fff",
                boxShadow: "0 0 60px rgba(255,92,53,0.25), 0 4px 30px rgba(255,92,53,0.15)" }}>
              Start training free
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em" }}>YU</span>
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>RestOS</span>
          </div>
          <div className="flex items-center gap-6">
            {["MIT Sloan", "Harvard Resolution Hackathon"].map((s) => (
              <span key={s} className="text-[10px] font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.12)" }}>{s}</span>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.1)" }}>
            &copy; 2026 YU
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
