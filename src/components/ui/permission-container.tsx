import React from 'react';
import { Card, CardContent } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { 
  Lock, 
  Shield, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Info,
  User,
  Crown,
  Key
} from 'lucide-react';

interface PermissionContainerProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user needs ANY permission
  fallback?: React.ReactNode;
  showFallback?: boolean;
  hideContent?: boolean; // If true, hide content instead of showing fallback
  className?: string;
  title?: string;
  description?: string;
  userRole?: string;
  showRoleInfo?: boolean;
}

interface NoPermissionFallbackProps {
  permission?: string;
  permissions?: string[];
  userRole?: string;
  showRoleInfo?: boolean;
  title?: string;
  description?: string;
}

const NoPermissionFallback: React.FC<NoPermissionFallbackProps> = ({
  permission,
  permissions,
  userRole,
  showRoleInfo = true,
  title,
  description
}) => {
  const getPermissionIcon = () => {
    if (permissions && permissions.length > 1) {
      return <Shield className="h-8 w-8 text-amber-500" />;
    }
    if (permission === 'user_management' || permission === 'add_users' || permission === 'edit_users') {
      return <User className="h-8 w-8 text-blue-500" />;
    }
    if (permission === 'reports' || permission === 'export_reports') {
      return <Crown className="h-8 w-8 text-purple-500" />;
    }
    return <Lock className="h-8 w-8 text-gray-500" />;
  };

  const getPermissionName = () => {
    if (permissions && permissions.length > 1) {
      return `${permissions.length} Required Permissions`;
    }
    if (permission) {
      return permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Required Permission';
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'warehouse_manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'processor': return 'bg-green-100 text-green-800 border-green-200';
      case 'outlet_manager': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 relative z-50">
      <CardContent className="p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          {/* Icon */}
          <div className="p-4 rounded-full bg-white shadow-lg border-2 border-amber-200">
            {getPermissionIcon()}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">
              {title || 'Access Restricted'}
            </h3>
            <p className="text-gray-600 max-w-md">
              {description || `You don't have permission to access this feature.`}
            </p>
          </div>

          {/* Permission Info */}
          <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Key className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">Required:</span>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              {getPermissionName()}
            </Badge>
          </div>

          {/* User Role Info */}
          {showRoleInfo && userRole && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Your Role:</span>
              </div>
              <Badge className={getRoleBadgeColor(userRole)}>
                {userRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => window.history.back()}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 max-w-sm">
            <div className="flex items-center justify-center space-x-1">
              <Info className="h-3 w-3" />
              <span>Contact your administrator to request access to this feature.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PermissionContainer: React.FC<PermissionContainerProps> = ({
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
  userRole,
  showRoleInfo = true
}) => {
  // This would typically use your permission hook
  // For now, we'll use a simple mock - replace with actual permission logic
  const hasPermission = (): boolean => {
    // Mock permission check - replace with actual logic from usePermissions hook
    if (!permission && !permissions) return true;
    
    // This is a placeholder - replace with actual permission checking logic
    // const { hasPermission: checkPermission } = usePermissions();
    
    // Mock logic for demonstration
    if (userRole === 'admin') return true;
    if (permission === 'view_dashboard') return true;
    if (permission === 'warehouse_entry' && ['admin', 'warehouse_manager'].includes(userRole || '')) return true;
    if (permission === 'user_management' && userRole === 'admin') return true;
    
    return false;
  };

  const userHasAccess = hasPermission();

  // If user has access, show content
  if (userHasAccess) {
    return <div className={className}>{children}</div>;
  }

  // If hiding content, return null
  if (hideContent) {
    return null;
  }

  // Show fallback
  if (showFallback) {
    if (fallback) {
      return <div className={`relative z-50 ${className}`}>{fallback}</div>;
    }

    return (
      <div className={`relative z-50 ${className}`}>
        <NoPermissionFallback
          permission={permission}
          permissions={permissions}
          userRole={userRole}
          showRoleInfo={showRoleInfo}
          title={title}
          description={description}
        />
      </div>
    );
  }

  // If not showing fallback, return null
  return null;
};

// Convenience components for common use cases
export const AdminOnly: React.FC<Omit<PermissionContainerProps, 'permission'>> = (props) => (
  <PermissionContainer permission="user_management" {...props} />
);

export const WarehouseManagerOnly: React.FC<Omit<PermissionContainerProps, 'permission'>> = (props) => (
  <PermissionContainer permission="warehouse_entry" {...props} />
);

export const ProcessorOnly: React.FC<Omit<PermissionContainerProps, 'permission'>> = (props) => (
  <PermissionContainer permission="processing" {...props} />
);

export const ReportsOnly: React.FC<Omit<PermissionContainerProps, 'permission'>> = (props) => (
  <PermissionContainer permission="reports" {...props} />
);

// Hook for easy permission checking
export const usePermissionCheck = () => {
  const checkPermission = (permission: string): boolean => {
    // Replace with actual permission logic
    const userRole = 'viewer'; // Mock - get from auth context
    if (userRole === 'admin') return true;
    if (permission === 'view_dashboard') return true;
    return false;
  };

  const checkPermissions = (permissions: string[], requireAll = false): boolean => {
    if (requireAll) {
      return permissions.every(permission => checkPermission(permission));
    }
    return permissions.some(permission => checkPermission(permission));
  };

  return { checkPermission, checkPermissions };
};
