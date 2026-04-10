import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/contexts/PlanContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import NavBar from "@/components/NavBar";
import SmoothScroll from "@/components/SmoothScroll";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy-loaded pages — code split into separate chunks
const Landing = lazy(() => import("@/pages/Landing"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Today = lazy(() => import("@/pages/Today"));
const Agent = lazy(() => import("@/pages/Agent"));
const AskYU = lazy(() => import("@/pages/AskYU"));
const OuraProfile = lazy(() => import("@/pages/OuraProfile"));
// Removed: Drift, Recovery, Employer — functionality absorbed into workout pipeline
const Settings = lazy(() => import("@/pages/Settings"));
const History = lazy(() => import("@/pages/History"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0b0d" }}>
    <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#FF5C35" }} />
  </div>
);

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
    <Suspense fallback={<PageLoader />}>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/today" element={<ProtectedRoute><PageTransition><Today /></PageTransition></ProtectedRoute>} />
        <Route path="/agent" element={<ProtectedRoute><PageTransition><Agent /></PageTransition></ProtectedRoute>} />
        <Route path="/oura" element={<ProtectedRoute><PageTransition><OuraProfile /></PageTransition></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><PageTransition><History /></PageTransition></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
    </Suspense>
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
          <ErrorBoundary>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ErrorBoundary>
        </PlanProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
