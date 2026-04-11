import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Zap, Brain, Activity, Clock, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const mainLinks = [
  { path: "/today", label: "Today", icon: Zap },
  { path: "/insights", label: "Insights", icon: Brain },
  { path: "/data", label: "Data", icon: Activity },
  { path: "/history", label: "History", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
];

const NavBar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/" || location.pathname === "/onboarding") return null;
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* ── Top Bar (desktop + mobile) ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: "rgba(10, 11, 13, 0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">
          {/* YU Brand Mark */}
          <Link to="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
            <div className="relative">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                className="absolute inset-0"
                style={{ filter: "blur(2px)" }}
              >
                <defs>
                  <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FF5C35" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#FF5C35" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="16" cy="16" r="14" fill="url(#glowGradient)" />
              </svg>

              <motion.div
                whileHover={{ scale: 1.05 }}
                style={{ position: "relative", zIndex: 1 }}
              >
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#FFFFFF",
                    display: "block",
                    lineHeight: "1",
                  }}
                >
                  YU
                </span>
              </motion.div>
            </div>

            {/* Live Dot */}
            <div className="relative flex items-center">
              <motion.div
                animate={{
                  opacity: [1, 0.4, 1],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: "6px",
                  height: "6px",
                  backgroundColor: "#C2FF4A",
                  borderRadius: "50%",
                }}
              />
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {mainLinks.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className="flex items-center gap-1.5 px-1 py-1.5 transition-all duration-200 relative group"
                style={{
                  color: isActive(l.path) ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  textDecoration: "none",
                }}
              >
                <l.icon className="w-3.5 h-3.5" />
                <span>{l.label}</span>

                {isActive(l.path) && (
                  <motion.div
                    layoutId="underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: "#FF5C35" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}

                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: isActive(l.path) ? "#FF5C35" : "rgba(255, 92, 53, 0.4)",
                  }}
                />
              </Link>
            ))}
          </div>

          {/* Mobile hamburger — hidden, we use bottom tabs instead */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden border-0 bg-transparent cursor-pointer p-1 transition-colors"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile slide-down menu (fallback) */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="md:hidden px-5 py-3 space-y-1"
              style={{
                background: "#0a0b0d",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              {mainLinks.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 transition-all duration-200"
                  style={{
                    color: isActive(l.path) ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    borderRadius: 8,
                    borderLeft: isActive(l.path) ? "2px solid #FF5C35" : "2px solid transparent",
                    paddingLeft: isActive(l.path) ? "12px" : "14px",
                  }}
                >
                  <l.icon className="w-4 h-4" />
                  {l.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Mobile Bottom Tab Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background: "rgba(10, 11, 13, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-around px-2 h-16">
          {mainLinks.map((l) => {
            const active = isActive(l.path);
            return (
              <Link
                key={l.path}
                to={l.path}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative"
                style={{ textDecoration: "none" }}
              >
                {/* Active glow */}
                {active && (
                  <motion.div
                    layoutId="tab-glow"
                    className="absolute -top-px left-1/2 -translate-x-1/2"
                    style={{
                      width: 24,
                      height: 2,
                      borderRadius: 2,
                      background: "#FF5C35",
                      boxShadow: "0 0 12px rgba(255, 92, 53, 0.5)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                <l.icon
                  className="w-5 h-5 transition-colors duration-200"
                  style={{
                    color: active ? "#FF5C35" : "rgba(255, 255, 255, 0.35)",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: "0.04em",
                    color: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)",
                    transition: "color 0.2s, font-weight 0.2s",
                  }}
                >
                  {l.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default NavBar;
