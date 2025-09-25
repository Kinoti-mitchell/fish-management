import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './AuthContext';
import { PermissionContainer } from './ui/permission-container';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  hideContent?: boolean;
  className?: string;
  title?: string;
  description?: string;
  showRoleInfo?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
  showFallback = true,
  hideContent = false,
  className = '',
  title,
  description,
  showRoleInfo = true
}) => {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();

  const userHasAccess = (): boolean => {
    if (!permission && !permissions) return true;
    
    if (permissions && permissions.length > 0) {
      if (requireAll) {
        return permissions.every(perm => hasPermission(perm));
      }
      return permissions.some(perm => hasPermission(perm));
    }
    
    if (permission) {
      return hasPermission(permission);
    }
    
    return false;
  };

  const hasAccess = userHasAccess();

  return (
    <PermissionContainer
      permission={permission}
      permissions={permissions}
      requireAll={requireAll}
      fallback={fallback}
      showFallback={showFallback}
      hideContent={hideContent}
      className={className}
      title={title}
      description={description}
      userRole={user?.role}
      showRoleInfo={showRoleInfo}
    >
      {hasAccess ? children : null}
    </PermissionContainer>
  );
};

// Convenience components for common use cases
export const AdminOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="user_management" 
    title="Administrator Access Required"
    description="This feature is only available to system administrators."
    {...props} 
  />
);

export const WarehouseManagerOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="warehouse_entry" 
    title="Warehouse Manager Access Required"
    description="This feature requires warehouse management permissions."
    {...props} 
  />
);

export const ProcessorOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="processing" 
    title="Processing Access Required"
    description="This feature requires fish processing permissions."
    {...props} 
  />
);

export const ReportsOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="reports" 
    title="Reports Access Required"
    description="This feature requires access to reports and analytics."
    {...props} 
  />
);

export const InventoryOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="inventory" 
    title="Inventory Access Required"
    description="This feature requires inventory management permissions."
    {...props} 
  />
);

export const OutletManagerOnly: React.FC<Omit<PermissionGuardProps, 'permission'>> = (props) => (
  <PermissionGuard 
    permission="outlet_orders" 
    title="Outlet Manager Access Required"
    description="This feature requires outlet management permissions."
    {...props} 
  />
);

// Component for multiple permission requirements
export const MultiPermissionGuard: React.FC<{
  children: React.ReactNode;
  permissions: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  hideContent?: boolean;
  className?: string;
  title?: string;
  description?: string;
}> = ({ permissions, requireAll = false, ...props }) => (
  <PermissionGuard
    permissions={permissions}
    requireAll={requireAll}
    title={props.title || `${requireAll ? 'All' : 'Any'} of ${permissions.length} Permissions Required`}
    description={props.description || `You need ${requireAll ? 'all' : 'at least one'} of the required permissions to access this feature.`}
    {...props}
  />
);

// Hook for conditional rendering based on permissions
export const usePermissionGuard = () => {
  const { hasPermission } = usePermissions();

  const canAccess = (permission?: string, permissions?: string[], requireAll = false): boolean => {
    if (!permission && !permissions) return true;
    
    if (permissions && permissions.length > 0) {
      if (requireAll) {
        return permissions.every(perm => hasPermission(perm));
      }
      return permissions.some(perm => hasPermission(perm));
    }
    
    if (permission) {
      return hasPermission(permission);
    }
    
    return false;
  };

  const hideIfNoPermission = (permission?: string, permissions?: string[], requireAll = false): boolean => {
    return !canAccess(permission, permissions, requireAll);
  };

  return { canAccess, hideIfNoPermission };
};
