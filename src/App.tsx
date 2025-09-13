import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";
import { initTheme } from "@/utils/theme";
import { supabase } from "@/lib/supabase"; // ✅ import supabase

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // initialize theme once on app load
  useEffect(() => {
    initTheme();
  }, []);

  // ✅ Listen to Supabase auth state changes
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session); // update auth state automatically
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = async () => {
    await supabase.auth.signOut(); // ✅ sign out in supabase
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Auth onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings onLogout={handleLogout} />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
