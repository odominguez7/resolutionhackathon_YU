import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/contexts/PlanContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnimatePresence } from "framer-motion";
import NavBar from "@/components/NavBar";
import SmoothScroll from "@/components/SmoothScroll";
import PageTransition from "@/components/PageTransition";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Agent from "@/pages/Agent";
import AskYU from "@/pages/AskYU";
import OuraProfile from "@/pages/OuraProfile";
import Drift from "@/pages/Drift";
import Recovery from "@/pages/Recovery";
import Employer from "@/pages/Employer";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboarded } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0b0d" }}><div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" /></div>;
  if (!user) return <Navigate to="/onboarding" replace />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/agent" element={<ProtectedRoute><PageTransition><Agent /></PageTransition></ProtectedRoute>} />
        <Route path="/ask" element={<ProtectedRoute><PageTransition><AskYU /></PageTransition></ProtectedRoute>} />
        <Route path="/oura" element={<ProtectedRoute><PageTransition><OuraProfile /></PageTransition></ProtectedRoute>} />
        <Route path="/drift" element={<ProtectedRoute><PageTransition><Drift /></PageTransition></ProtectedRoute>} />
        <Route path="/recovery" element={<ProtectedRoute><PageTransition><Recovery /></PageTransition></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
        <Route path="/employer" element={<PageTransition><Employer /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === "/" || location.pathname === "/onboarding";
  return (
    <>
      <SmoothScroll />
      {!isLanding && <NavBar />}
      <main className={isLanding ? "" : "pt-14"}>
        <AnimatedRoutes />
      </main>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PlanProvider>
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </PlanProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
