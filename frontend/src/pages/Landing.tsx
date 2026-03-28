import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Zap, Activity, ArrowRight, ChevronDown } from "lucide-react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, useInView } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import OuraProfile from "./OuraProfile";

/* ── Animated counter hook ── */
function useCounter(target: string, inView: boolean) {
  const [display, setDisplay] = useState("0");
  const numericMatch = target.match(/^([<>]?)(\$?)([\d,]+)(\+?)$/);

  useEffect(() => {
    if (!inView || !numericMatch) {
      if (!numericMatch) setDisplay(target);
      return;
    }
    const prefix = (numericMatch[1] || "") + (numericMatch[2] || "");
    const suffix = numericMatch[4] || "";
    const end = parseInt(numericMatch[3].replace(/,/g, ""), 10);
    const duration = 1800;
    const steps = 60;
    const increment = end / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(eased * end);
      if (current >= end) {
        current = end;
        clearInterval(timer);
      }
      const formatted = current >= 1000 ? current.toLocaleString() : String(current);
      setDisplay(`${prefix}${formatted}${suffix}`);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [inView, target]);

  return display;
}

/* ── Stat counter component ── */
function AnimatedStat({ value, label, index }: { value: string; label: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const display = useCounter(value, inView);

  return (
    <motion.div
      ref={ref}
      className="text-center px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <p
        className="text-3xl md:text-4xl font-extrabold mb-1 tabular-nums"
        style={{
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {display}
      </p>
      <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
    </motion.div>
  );
}

/* ── Glow card with cursor tracking ── */
function GlowCard({ children, color }: { children: React.ReactNode; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className="relative rounded-2xl p-8 flex flex-col items-center text-center gap-4 h-full overflow-hidden group cursor-default"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -8, scale: 1.02, borderColor: `${color}40` }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      {/* Cursor glow */}
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      />
      {children}
    </motion.div>
  );
}

/* ── Word-by-word text reveal ── */
function WordReveal({ text, className, style, delay = 0 }: { text: string; className?: string; style?: React.CSSProperties; delay?: number }) {
  const words = text.split(" ");
  return (
    <motion.p className={className} style={style}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            delay: delay + i * 0.04,
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </motion.p>
  );
}

/* ── Animated gradient mesh background ── */
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Primary blob */}
      <motion.div
        className="absolute"
        style={{
          width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          filter: "blur(120px)",
          top: "20%", left: "30%",
        }}
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Secondary blob */}
      <motion.div
        className="absolute"
        style={{
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          filter: "blur(100px)",
          top: "40%", right: "20%",
        }}
        animate={{
          x: [0, -60, 30, 0],
          y: [0, 50, -80, 0],
          scale: [1, 0.85, 1.15, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Accent blob */}
      <motion.div
        className="absolute"
        style={{
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
          bottom: "10%", left: "50%",
        }}
        animate={{
          x: [0, 40, -60, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Noise overlay for texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          opacity: 0.4,
        }}
      />
    </div>
  );
}

/* ── Main landing ── */
const Landing = () => {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  const features = [
    {
      icon: Activity,
      title: "Oura + Eight Sleep + Calendar",
      desc: "Your ring, your bed, and your schedule. All connected. Zero setup.",
      color: "#3b82f6",
    },
    {
      icon: Zap,
      title: "Gemini reads it for you",
      desc: "AI turns your data into plain language. What's working, what's not, and what to do about it.",
      color: "#8b5cf6",
    },
    {
      icon: Brain,
      title: "One tap. Day planned.",
      desc: "Workout, recovery, sleep settings, calendar blocks. All personalized to how your body is doing today.",
      color: "#10b981",
    },
  ];

  const stats = [
    { value: "170+", label: "days of real data" },
    { value: "10000+", label: "daily data points" },
    { value: "24", label: "hour action plans" },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes orbRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .gradient-hero {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: shimmer 4s linear infinite;
        }
        .orb-ring {
          position: absolute; width: 600px; height: 600px; border-radius: 50%;
          border: 1px solid rgba(139,92,246,0.1); animation: orbRotate 25s linear infinite;
          pointer-events: none;
        }
        .orb-ring::before {
          content: ''; position: absolute; top: -4px; left: 50%; width: 8px; height: 8px;
          border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 20px 4px rgba(139,92,246,0.5);
        }
        .stat-divider { width: 1px; height: 48px; background: linear-gradient(to bottom, transparent, rgba(139,92,246,0.3), transparent); }
        html { scroll-behavior: smooth; }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ background: "#0a0e1a" }}>

        {/* ── Single-screen hero: Title + Photo + Plan ── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
          <GradientMesh />

          <motion.div className="relative z-10 max-w-4xl mx-auto mb-2">
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-3"
              style={{ color: "rgba(139,92,246,0.6)" }}
            >
              Structure for the unstructured
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-3 text-white"
            >
              One tap. <span className="gradient-hero">Your whole week, planned.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-sm max-w-md mx-auto leading-relaxed"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              You know what to do. Starting is the hard part.
              <br />
              <span style={{ color: "rgba(255,255,255,0.5)" }}>We turn your data into a clear plan you can actually follow.</span>
            </motion.p>
          </motion.div>

          {/* The PlanOrbit IS the hero -- embedded directly */}
          <motion.div
            id="live-demo"
            className="relative z-10 w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >

          {/* Embedded dashboard (PlanOrbit is inside OuraProfile) */}
          <OuraProfile />
          </motion.div>
        </section>

        {/* ── How it works (compact banner) ── */}
        <section className="px-6 py-10 max-w-4xl mx-auto w-full">
          <motion.p
            className="text-center text-[10px] font-bold tracking-[0.25em] uppercase mb-8"
            style={{ color: "rgba(255,255,255,0.2)" }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            How it works
          </motion.p>
          <div className="grid md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title}
                className="rounded-xl p-4 text-center"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <f.icon className="w-5 h-5 mx-auto mb-2" style={{ color: f.color }} />
                <p className="text-sm font-bold text-white mb-1">{f.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3">
            {["Oura Ring", "Google Gemini 2.5 Pro", "Eight Sleep", "iCloud Calendar"].map((s) => (
              <span key={s} className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.2)" }}>{s}</span>
            ))}
          </div>
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.08)" }}>
            Resolution Hackathon @ Harvard, March 28, 2026
          </p>
        </div>
      </div>
    </>
  );
};

export default Landing;
