import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlanProvider } from "@/contexts/PlanContext";
import { AnimatePresence } from "framer-motion";
import NavBar from "@/components/NavBar";
import SmoothScroll from "@/components/SmoothScroll";
import PageTransition from "@/components/PageTransition";
import Landing from "@/pages/Landing";
import Agent from "@/pages/Agent";
import AskYU from "@/pages/AskYU";
import OuraProfile from "@/pages/OuraProfile";
import Drift from "@/pages/Drift";
import Recovery from "@/pages/Recovery";
import Employer from "@/pages/Employer";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/agent" element={<PageTransition><Agent /></PageTransition>} />
        <Route path="/ask" element={<PageTransition><AskYU /></PageTransition>} />
        <Route path="/oura" element={<PageTransition><OuraProfile /></PageTransition>} />
        <Route path="/drift" element={<PageTransition><Drift /></PageTransition>} />
        <Route path="/recovery" element={<PageTransition><Recovery /></PageTransition>} />
        <Route path="/employer" element={<PageTransition><Employer /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  return (
    <>
      <SmoothScroll />
      <NavBar />
      <main className={isLanding ? "" : "pt-14"}>
        <AnimatedRoutes />
      </main>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PlanProvider>
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </PlanProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
