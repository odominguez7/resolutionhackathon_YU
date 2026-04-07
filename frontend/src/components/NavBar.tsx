import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Bot, MessageSquare, Activity, Users } from "lucide-react";

const mainLinks = [
  { path: "/agent", label: "Agent", icon: Bot },
  { path: "/ask", label: "Ask YU", icon: MessageSquare },
  { path: "/oura", label: "My Health", icon: Activity },
];

const NavBar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/") return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04]"
      style={{ background: "rgba(8,11,28,0.88)", backdropFilter: "blur(24px)" }}>
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tight"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            YU
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {mainLinks.map((l) => (
            <Link key={l.path} to={l.path}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200"
              style={{
                color: isActive(l.path) ? "#C4B5FD" : "rgba(255,255,255,0.3)",
                background: isActive(l.path) ? "rgba(139,92,246,0.1)" : "transparent",
              }}>
              <l.icon className="w-3.5 h-3.5" />
              {l.label}
            </Link>
          ))}

          {/* Separator + employer link */}
          <div className="w-px h-5 mx-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Link to="/employer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200"
            style={{
              color: isActive("/employer") ? "#4ade80" : "rgba(255,255,255,0.2)",
              background: isActive("/employer") ? "rgba(34,197,94,0.08)" : "transparent",
            }}>
            <Users className="w-3.5 h-3.5" />
            Employer
          </Link>
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
          {mainLinks.map((l) => (
            <Link key={l.path} to={l.path} onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                color: isActive(l.path) ? "#C4B5FD" : "rgba(255,255,255,0.5)",
                background: isActive(l.path) ? "rgba(139,92,246,0.08)" : "transparent",
              }}>
              <l.icon className="w-4 h-4" />
              {l.label}
            </Link>
          ))}
          <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.04)" }} />
          <Link to="/employer" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{
              color: isActive("/employer") ? "#4ade80" : "rgba(255,255,255,0.4)",
              background: isActive("/employer") ? "rgba(34,197,94,0.06)" : "transparent",
            }}>
            <Users className="w-4 h-4" />
            Employer
          </Link>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
