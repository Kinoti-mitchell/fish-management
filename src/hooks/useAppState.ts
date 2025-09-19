import { useState, useEffect } from "react";
import { supabase, handleSupabaseError, withRetry } from "../lib/supabaseClient";
import { AppState, NavigationSection } from "../types";
import { User } from "@supabase/supabase-js";

export function useAppState() {
  const [appState, setAppState] = useState<AppState>({
    appState: "landing",
    isLoggedIn: false,
    currentSection: "dashboard",
  });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Always rely on Supabase session

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAppState(prev => ({
          ...prev,
          appState: "app",
          isLoggedIn: true,
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
            role: session.user.user_metadata?.role || "viewer",
          },
        }));
      }
    };

    checkSession();
  }, []);

  const goToLanding = () => {
    setAppState(prev => ({ ...prev, appState: "landing" }));
  };

  const goToLogin = () => {
    setAppState(prev => ({ ...prev, appState: "login" }));
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      // Check if Supabase is properly configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Always use real Supabase auth

      const { data, error } = await withRetry(async () => {
        return await supabase.auth.signInWithPassword({
          email,
          password,
        });
      });

      if (error) {
        const errorMessage = handleSupabaseError(error, 'login');
        console.error("Login error:", errorMessage);
        return false;
      }

      if (data.user) {
        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        setAppState(prev => ({
          ...prev,
          appState: "app",
          isLoggedIn: true,
          user: {
            id: data.user.id,
            email: data.user.email ?? "",
            role: profile?.role || data.user.user_metadata?.role || "viewer",
          },
          currentSection: "dashboard",
        }));
        return true;
      }
      return false;
    } catch (err: any) {
      const errorMessage = handleSupabaseError(err, 'login');
      console.error("Login error:", errorMessage);
      return false;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    
    setAppState({
      appState: "landing",
      isLoggedIn: false,
      currentSection: "dashboard",
    });
  };

  const handleNavigate = (section: NavigationSection, itemId?: string) => {
    setAppState(prev => ({
      ...prev,
      currentSection: section,
      selectedItemId: itemId,
    }));
  };

  return {
    ...appState,
    goToLanding,
    goToLogin,
    handleLogin,
    handleLogout,
    handleNavigate,
  };
}
