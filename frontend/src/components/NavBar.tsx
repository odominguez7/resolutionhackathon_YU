import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Zap, Activity, Shield } from "lucide-react";

const navLinks = [
  { path: "/oura", label: "Dashboard", icon: Activity },
  { path: "/drift", label: "Burnout Check", icon: Zap },
  { path: "/recovery", label: "Recovery Plan", icon: Shield },
];

const NavBar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Hide nav on landing
  if (location.pathname === "/") return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04]"
      style={{ background: "rgba(8,11,28,0.88)", backdropFilter: "blur(24px)" }}>
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tight"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            YU
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">RestOS</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => {
            const active = location.pathname === l.path;
            return (
              <Link key={l.path} to={l.path}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200"
                style={{
                  color: active ? "#C4B5FD" : "rgba(255,255,255,0.3)",
                  background: active ? "rgba(139,92,246,0.1)" : "transparent",
                }}>
                <l.icon className="w-3.5 h-3.5" />
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-slate-400 border-0 bg-transparent cursor-pointer p-1">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/[0.04] px-5 py-3 space-y-1"
          style={{ background: "rgba(8,11,28,0.95)" }}>
          {navLinks.map((l) => (
            <Link key={l.path} to={l.path} onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                color: location.pathname === l.path ? "#C4B5FD" : "rgba(255,255,255,0.5)",
                background: location.pathname === l.path ? "rgba(139,92,246,0.08)" : "transparent",
              }}>
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
