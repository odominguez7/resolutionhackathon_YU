import { Link, useLocation } from "react-router-dom";

const pageNames: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/checkin": "Check-In",
  "/drift": "Drift Alert",
  "/recovery": "Recovery Plan",
  "/action-status": "Action Status",
  "/debrief": "Morning Debrief",
  "/xray": "X-Ray Mode",
};

const NavBar = () => {
  const location = useLocation();
  const currentPage = pageNames[location.pathname] || "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border">
      <Link to="/" className="text-xl font-bold gradient-text">
        YU RestOS
      </Link>
      <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
        {currentPage}
      </span>
      <div className="w-24" />
    </nav>
  );
};

export default NavBar;
