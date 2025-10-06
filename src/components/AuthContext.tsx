// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { profileService } from '../services/database';
import { toast } from 'sonner';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'processor' | 'outlet_manager' | 'warehouse_manager' | 'viewer';
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: () => boolean;
  canAccess: (resource: string, action?: string) => boolean;
  refreshUser: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Simple profile creation - just return a basic profile
  const createUserProfile = async (userId: string, authEmail?: string): Promise<User> => {
    const email = authEmail?.toLowerCase() || '';
    
    // Default profile - no hardcoded user logic
    const userProfile = {
      id: userId,
      email: authEmail || '',
      first_name: 'User',
      last_name: 'Name',
      role: 'viewer' as const,
      phone: '',
      is_active: true,
      last_login: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return userProfile;
  };

  // No database operations needed - all user data is managed in memory

  // Sign in function - using custom authentication with profiles table
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      // Find user in database with network error handling
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        setLoading(false);
        
        // Handle network connection errors
        if (userError && (
          userError.message?.includes('fetch') ||
          userError.message?.includes('network') ||
          userError.message?.includes('ERR_NETWORK') ||
          userError.message?.includes('ERR_NAME_NOT_RESOLVED') ||
          userError.message?.includes('Failed to fetch')
        )) {
          return { success: false, error: 'No network connection. Please check your internet connection and try again.' };
        }
        
        // Check if it's a "not found" error vs other database errors
        if (userError && userError.code === 'PGRST116') {
          return { success: false, error: 'Email address not found. Please check your email or contact your administrator.' };
        }
        return { success: false, error: 'Email address not found. Please check your email or contact your administrator.' };
      }

      // Check password using bcrypt
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordValid) {
        setLoading(false);
        return { success: false, error: 'Wrong password. Please try again or contact your administrator to reset your password.' };
      }

      // Create user profile object
      const userProfile: User = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        phone: user.phone,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
      
      setUser(userProfile);
      
      // Store user in sessionStorage for audit logging
      sessionStorage.setItem('currentUser', JSON.stringify(userProfile));
      
      // Create a mock Supabase user for compatibility
      const mockSupabaseUser = {
        id: userProfile.id,
        email: userProfile.email,
        user_metadata: {
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          role: userProfile.role,
          phone: userProfile.phone
        }
      };
      setSupabaseUser(mockSupabaseUser as any);
      
      // Create a mock session for compatibility
      const mockSession = {
        access_token: 'demo-token-' + userProfile.id,
        refresh_token: 'demo-refresh-' + userProfile.id,
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser
      };
      setSession(mockSession as any);

      // Log login audit event
      try {
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert([{
            user_id: userProfile.id,
            action: 'LOGIN',
            table_name: 'auth',
            record_id: userProfile.id,
            old_values: null,
            new_values: JSON.stringify({ login_time: new Date().toISOString() }),
            ip_address: null,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString()
          }]);
        
        if (auditError) {
          console.warn('Failed to log login audit event:', auditError);
        }
      } catch (auditError) {
        console.warn('Failed to log login audit event:', auditError);
      }

      toast.success(`Welcome back, ${userProfile.first_name}!`);
      setLoading(false);
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      
      // Handle network connection errors in the catch block
      if (error && (
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('ERR_NETWORK') ||
        error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
        error.message?.includes('Failed to fetch') ||
        error.name === 'TypeError' && error.message?.includes('fetch')
      )) {
        return { success: false, error: 'No network connection. Please check your internet connection and try again.' };
      }
      
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      // Log logout audit event before clearing user data
      if (user) {
        try {
          const { error: auditError } = await supabase
            .from('audit_logs')
            .insert([{
              user_id: user.id,
              action: 'LOGOUT',
              table_name: 'auth',
              record_id: user.id,
              old_values: null,
              new_values: JSON.stringify({ logout_time: new Date().toISOString() }),
              ip_address: null,
              user_agent: navigator.userAgent,
              created_at: new Date().toISOString()
            }]);
          
          if (auditError) {
            console.warn('Failed to log logout audit event:', auditError);
          }
        } catch (auditError) {
          console.warn('Failed to log logout audit event:', auditError);
        }
      }

      // No need to call Supabase Auth signOut since we're using custom authentication

      // Clear user from sessionStorage
      sessionStorage.removeItem('currentUser');
      
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (supabaseUser) {
      const userProfile = await createUserProfile(supabaseUser.id, supabaseUser.email || undefined);
      setUser(userProfile);
    }
  };

  // Update user profile
  const updateUserProfile = async (updates: Partial<User>): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      // Update in database
      const updatedProfile = await profileService.updateProfile(user.id, updates);

      // Update local state
      setUser({
        ...user,
        ...updates,
        updated_at: new Date().toISOString()
      });

      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error: any) {
      toast.error('Failed to update profile');
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  };

  // Role checking functions
  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  // Permission checking function
  const canAccess = (resource: string, action: string = 'read'): boolean => {
    if (!user || !user.is_active) return false;

    const role = user.role;

    // Admin has access to everything
    if (role === 'admin') return true;

    // Define permission matrix
    const permissions: Record<string, Record<string, string[]>> = {
      users: {
        read: ['admin'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin']
      },
      audit_logs: {
        read: ['admin', 'processor']
      },
      processing_records: {
        read: ['admin', 'processor', 'warehouse_manager'],
        create: ['admin', 'processor'],
        update: ['admin', 'processor'],
        delete: ['admin']
      },
      outlet_orders: {
        read: ['admin', 'outlet_manager', 'processor'],
        create: ['admin', 'outlet_manager'],
        update: ['admin', 'outlet_manager'],
        delete: ['admin']
      },
      warehouse_entries: {
        read: ['admin', 'warehouse_manager', 'processor'],
        create: ['admin', 'warehouse_manager'],
        update: ['admin', 'warehouse_manager'],
        delete: ['admin']
      },
      dispatch_records: {
        read: ['admin', 'processor', 'outlet_manager', 'warehouse_manager', 'viewer'],
        create: ['admin', 'processor', 'warehouse_manager'],
        update: ['admin', 'processor', 'warehouse_manager'],
        delete: ['admin']
      },
      fish_inventory: {
        read: ['admin', 'processor', 'outlet_manager', 'warehouse_manager', 'viewer'],
        create: ['admin', 'processor', 'warehouse_manager'],
        update: ['admin', 'processor', 'warehouse_manager'],
        delete: ['admin']
      }
    };

    const resourcePermissions = permissions[resource];
    if (!resourcePermissions) return false;

    const actionPermissions = resourcePermissions[action];
    if (!actionPermissions) return false;

    return actionPermissions.includes(role);
  };

  // Handle auth state changes - simplified for custom authentication
  useEffect(() => {
    // Set loading to false immediately - no complex session management needed
    setLoading(false);
  }, []);

  const value: AuthContextType = {
    user,
    supabaseUser,
    session,
    loading,
    signIn,
    signOut,
    hasRole,
    hasAnyRole,
    isAdmin,
    canAccess,
    refreshUser,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};