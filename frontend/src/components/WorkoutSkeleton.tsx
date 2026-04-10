import { motion } from "framer-motion";

/** Animated loading skeleton that looks like a workout card being built. */
export default function WorkoutSkeleton() {
  const pulse = { opacity: [0.3, 0.6, 0.3] };
  const trans = { duration: 1.5, repeat: Infinity, ease: "easeInOut" };
  const Bar = ({ w, delay = 0 }: { w: string; delay?: number }) => (
    <motion.div className="rounded-md" style={{ width: w, height: 12, background: "rgba(255,92,53,0.08)" }}
      animate={pulse} transition={{ ...trans, delay }} />
  );

  return (
    <div className="space-y-4 py-2">
      {/* Title */}
      <div className="flex items-center justify-between">
        <Bar w="60%" />
        <Bar w="15%" delay={0.2} />
      </div>

      {/* Why block */}
      <motion.div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        animate={pulse} transition={{ ...trans, delay: 0.1 }}>
        <Bar w="40%" />
        <div className="mt-2"><Bar w="90%" delay={0.3} /></div>
      </motion.div>

      {/* Warmup block */}
      <motion.div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        animate={pulse} transition={{ ...trans, delay: 0.2 }}>
        <Bar w="30%" />
        <div className="space-y-2 mt-3">
          <Bar w="70%" delay={0.4} />
          <Bar w="55%" delay={0.5} />
          <Bar w="65%" delay={0.6} />
        </div>
      </motion.div>

      {/* Main block */}
      <motion.div className="rounded-xl p-4" style={{ background: "rgba(255,92,53,0.03)", border: "1px solid rgba(255,92,53,0.06)" }}
        animate={pulse} transition={{ ...trans, delay: 0.3 }}>
        <Bar w="45%" />
        <div className="space-y-2 mt-3">
          <Bar w="80%" delay={0.5} />
          <Bar w="70%" delay={0.6} />
          <Bar w="75%" delay={0.7} />
          <Bar w="60%" delay={0.8} />
        </div>
      </motion.div>

      {/* Cooldown block */}
      <motion.div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        animate={pulse} transition={{ ...trans, delay: 0.4 }}>
        <Bar w="30%" />
        <div className="space-y-2 mt-3">
          <Bar w="60%" delay={0.7} />
          <Bar w="50%" delay={0.8} />
        </div>
      </motion.div>

      <p className="text-[10px] text-center" style={{ color: "rgba(255,92,53,0.4)" }}>
        Building your session from live biometrics...
      </p>
    </div>
  );
}
