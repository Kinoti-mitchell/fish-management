// src/components/ProtectedComponent.tsx
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { Alert, AlertDescription } from './ui/alert';
import { Shield, Lock, AlertTriangle } from 'lucide-react';

interface ProtectedComponentProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requiredAnyPermission?: string[];
  requiredAllPermissions?: string[];
  resource?: string;
  action?: string;
  section?: string;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  children,
  requiredRole,
  requiredRoles,
  requiredPermissions = [],
  requiredAnyPermission = [],
  requiredAllPermissions = [],
  resource,
  action = 'read',
  section,
  fallback,
  showFallback = true
}) => {
  const { 
    user, 
    userProfile, 
    loading, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    canAccess, 
    canPerform,
    isAdmin 
  } = usePermissions();

  // Show loading state
  if (loading) {
    return showFallback ? (
      <Alert className="border-blue-200 bg-blue-50">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <AlertDescription className="text-blue-800">
          Loading permissions...
        </AlertDescription>
      </Alert>
    ) : null;
  }

  // Check if user is authenticated
  if (!user) {
    return showFallback ? (
      fallback || (
        <Alert className="border-red-200 bg-red-50">
          <Lock className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You must be logged in to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check section access
  if (section && !canAccess(section)) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You don't have permission to access this section.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check specific role
  if (requiredRole && userProfile?.role !== requiredRole && !isAdmin()) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You need {requiredRole} role to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check any of multiple roles
  if (requiredRoles && !requiredRoles.includes(userProfile?.role || '') && !isAdmin()) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You need one of these roles to access this content: {requiredRoles.join(', ')}
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check specific permissions
  if (requiredPermissions.length > 0 && !requiredPermissions.every(permission => hasPermission(permission))) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You don't have the required permissions to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check any permission
  if (requiredAnyPermission.length > 0 && !hasAnyPermission(requiredAnyPermission)) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You need at least one of the required permissions to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check all permissions
  if (requiredAllPermissions.length > 0 && !hasAllPermissions(requiredAllPermissions)) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You need all the required permissions to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check resource-based permissions
  if (resource && !canPerform(action, resource)) {
    return showFallback ? (
      fallback || (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You don't have permission to {action} {resource}.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  return <>{children}</>;
};

// RoleGate component
interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}

export const RoleGate: React.FC<RoleGateProps> = ({ 
  children, 
  allowedRoles, 
  fallback 
}) => {
  const { user, userProfile, isAdmin } = usePermissions();

  if (!user || (!allowedRoles.includes(userProfile?.role || '') && !isAdmin())) {
    return fallback || null;
  }

  return <>{children}</>;
};