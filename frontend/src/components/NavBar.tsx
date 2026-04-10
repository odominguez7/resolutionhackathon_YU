import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Bot, MessageSquare, Activity, Settings, Clock } from "lucide-react";

const YU = {
  bg: "rgba(255,255,255,0.92)",
  ink: "#1C2B3A",
  muted: "#6B7280",
  label: "#9CA3AF",
  line: "#E5E7EB",
  teal: "#00BFA6",
};

const mainLinks = [
  { path: "/agent", label: "Agent", icon: Bot },
  { path: "/ask", label: "Ask YU", icon: MessageSquare },
  { path: "/oura", label: "My Health", icon: Activity },
  { path: "/history", label: "History", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
];

const NavBar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/" || location.pathname === "/onboarding") return null;
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: YU.bg,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${YU.line}`,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: YU.teal }}>
            YU
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {mainLinks.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className="flex items-center gap-1.5 px-3.5 py-1.5 transition-all duration-200"
              style={{
                color: isActive(l.path) ? YU.ink : YU.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                textDecoration: "none",
                borderRadius: 999,
                background: isActive(l.path) ? `${YU.teal}10` : "transparent",
                border: isActive(l.path) ? `1px solid ${YU.teal}30` : "1px solid transparent",
              }}
            >
              <l.icon className="w-3.5 h-3.5" />
              {l.label}
            </Link>
          ))}
          {/* Employer link removed */}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden border-0 bg-transparent cursor-pointer p-1" style={{ color: YU.muted }}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden px-5 py-3 space-y-1"
          style={{ background: "#fff", borderTop: `1px solid ${YU.line}` }}
        >
          {mainLinks.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 transition-colors"
              style={{
                color: isActive(l.path) ? YU.ink : YU.muted,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: 12,
                background: isActive(l.path) ? `${YU.teal}10` : "transparent",
              }}
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default NavBar;
