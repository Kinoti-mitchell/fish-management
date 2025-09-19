import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AuthStatusProps {
  onAuthChange?: (isAuthenticated: boolean, user: any) => void;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ onAuthChange }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    checkAuthStatus();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setUser(session?.user || null);
      setSessionValid(!!session);
      onAuthChange?.(!!session?.user, session?.user);
    });

    return () => subscription.unsubscribe();
  }, [onAuthChange]);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      // Check session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Session check failed:', sessionError);
        setSessionValid(false);
        setUser(null);
        onAuthChange?.(false, null);
        return;
      }
      
      if (session && session.user) {
        setUser(session.user);
        setSessionValid(true);
        onAuthChange?.(true, session.user);
      } else {
        // No session, try to get user directly
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.warn('User check failed:', userError);
          setUser(null);
          setSessionValid(false);
          onAuthChange?.(false, null);
        } else if (user) {
          setUser(user);
          setSessionValid(true);
          onAuthChange?.(true, user);
        } else {
          setUser(null);
          setSessionValid(false);
          onAuthChange?.(false, null);
        }
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setUser(null);
      setSessionValid(false);
      onAuthChange?.(false, null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error('Failed to sign out: ' + error.message);
      } else {
        toast.success('Signed out successfully');
        setUser(null);
        setSessionValid(false);
        onAuthChange?.(false, null);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleRefreshAuth = async () => {
    await checkAuthStatus();
    toast.success('Authentication status refreshed');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking authentication...
      </div>
    );
  }

  if (!user || !sessionValid) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="flex items-center gap-1">
          <User className="w-3 h-3" />
          Not authenticated
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAuth}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="default" className="flex items-center gap-1">
        <User className="w-3 h-3" />
        {user.email}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="h-6 px-2 text-xs"
      >
        <LogOut className="w-3 h-3 mr-1" />
        Sign Out
      </Button>
    </div>
  );
};
