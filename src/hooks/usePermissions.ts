import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { useAuth } from '../components/AuthContext';

interface Permission {
  resource: string;
  action: string;
  condition?: string;
}

interface UserRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  icon: string;
  color: string;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// Default permissions for roles - now dynamic based on database
const getDefaultPermissions = (roleName: string): string[] => {
  // Return basic read permissions as fallback
  // Actual permissions will be loaded from the database
  return ['read:basic'];
};

export function usePermissions() {
  const { user: userProfile, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      // Set default permissions immediately for faster loading
      const defaultPermissions = getDefaultPermissions(userProfile.role);
      setPermissions(defaultPermissions);
      
      // Fetch detailed role info in background (non-blocking)
      fetchUserRole(userProfile.role);
    } else {
      setUserRole(null);
      setPermissions([]);
      setLoading(false);
    }
  }, [userProfile]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Permissions loading timeout, using default permissions');
        setLoading(false);
        if (userProfile?.role) {
          const defaultPermissions = getDefaultPermissions(userProfile.role);
          setPermissions(defaultPermissions);
        }
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [loading, userProfile]);

  const fetchUserRole = async (roleName: string) => {
    try {
      // Fetch user role details (non-blocking)
      const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('name', roleName)
        .eq('is_active', true)
        .single();

      if (roleError) {
        console.warn('Error fetching user role, using default permissions:', roleError);
        // Set default permissions based on role name
        const defaultPermissions = getDefaultPermissions(roleName);
        setUserRole({
          id: 'default',
          name: roleName,
          display_name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
          description: `Default ${roleName} role`,
          permissions: defaultPermissions,
          icon: 'user',
          color: 'blue',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setPermissions(defaultPermissions);
        setLoading(false);
        return;
      }

      setUserRole(role);
      
      // Safely parse permissions
      let parsedPermissions: string[] = [];
      try {
        if (Array.isArray(role.permissions)) {
          parsedPermissions = role.permissions;
        } else if (typeof role.permissions === 'string') {
          parsedPermissions = JSON.parse(role.permissions);
        } else {
          parsedPermissions = [];
        }
      } catch (error) {
        console.warn('Error parsing permissions, using empty array:', error);
        parsedPermissions = [];
      }
      
      setPermissions(parsedPermissions);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setUserRole(null);
      setPermissions([]);
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!permissions.length) return false;
    
    // Admin has all permissions
    if (permissions.includes('*') || permissions.includes('admin:*')) {
      return true;
    }

    // Check for exact permission match
    if (permissions.includes(permission)) {
      return true;
    }

    // Check for wildcard permissions
    const [action, resource] = permission.split(':');
    if (action && resource) {
      // Check for action wildcard
      if (permissions.includes(`${action}:*`)) {
        return true;
      }
      // Check for resource wildcard
      if (permissions.includes(`*:${resource}`)) {
        return true;
      }
    }

    return false;
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every(permission => hasPermission(permission));
  };

  const canAccess = (section: string): boolean => {
    // If user role fetching is still loading, allow basic access
    if (loading) {
      return section === 'dashboard'; // Only allow dashboard access while loading
    }
    
    // Admin has access to everything
    if (isAdmin()) {
      return true;
    }
    
    // Map sections to required permissions
    const sectionPermissions: { [key: string]: string[] } = {
      'dashboard': ['read:basic'],
      'warehouse-entry': ['write:inventory'],
      'processing': ['write:processing'],
      'sorting': ['write:processing'],
      'inventory': ['read:inventory'],
      'outlet-orders': ['read:sales'],
      'dispatch': ['write:logistics'],
      'outlet-receiving': ['read:sales'],
      'reports': ['read:basic'],
      'user-management': ['admin:*', 'write:users']
    };
    
    const requiredPermissions = sectionPermissions[section] || [];
    return hasAnyPermission(requiredPermissions);
  };

  const canPerform = (action: string, resource: string): boolean => {
    const permission = `${action}:${resource}`;
    return hasPermission(permission);
  };

  const isAdmin = (): boolean => {
    // Check if user has admin permissions or the '*' permission
    return permissions.includes('*') || permissions.includes('admin:*') || permissions.includes('admin_access');
  };

  const isManager = (): boolean => {
    // Check if user has management permissions
    return permissions.includes('*') || 
           permissions.includes('admin:*') || 
           permissions.includes('manage_users') ||
           permissions.includes('manage_roles') ||
           permissions.includes('system_settings');
  };

  const canManageUsers = (): boolean => {
    return isAdmin() || hasPermission('write:users');
  };

  const canManageRoles = (): boolean => {
    return isAdmin() || hasPermission('write:roles');
  };

  const canViewAuditLogs = (): boolean => {
    return isAdmin() || hasPermission('read:audit');
  };

  const canExportData = (): boolean => {
    return isAdmin() || hasPermission('export:data');
  };

  const canModifySystemSettings = (): boolean => {
    return isAdmin() || hasPermission('write:system');
  };

  return {
    user: userProfile,
    userProfile,
    userRole,
    permissions,
    loading: loading || authLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    canPerform,
    isAdmin,
    isManager,
    canManageUsers,
    canManageRoles,
    canViewAuditLogs,
    canExportData,
    canModifySystemSettings
  };
}