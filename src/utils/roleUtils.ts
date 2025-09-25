// src/utils/roleUtils.ts
export const ROLE_HIERARCHY = {
    admin: 5,
    processor: 4,
    warehouse_manager: 3,
    outlet_manager: 3,
    viewer: 1
  };
  
  export const ROLE_DESCRIPTIONS = {
    admin: {
      title: 'Administrator',
      description: 'Full system access and user management',
      permissions: ['All permissions', 'User management', 'System configuration'],
      color: 'red'
    },
    processor: {
      title: 'Processor',
      description: 'Fish processing operations and oversight',
      permissions: ['Processing records', 'Inventory management', 'Audit logs'],
      color: 'blue'
    },
    warehouse_manager: {
      title: 'Warehouse Manager',
      description: 'Warehouse operations and inventory control',
      permissions: ['Warehouse entries', 'Inventory management', 'Dispatch records'],
      color: 'purple'
    },
    outlet_manager: {
      title: 'Outlet Manager',
      description: 'Outlet operations and order management',
      permissions: ['Outlet orders', 'Inventory viewing', 'Dispatch records'],
      color: 'green'
    },
    viewer: {
      title: 'Viewer',
      description: 'Read-only access to system information',
      permissions: ['View inventory', 'View dispatch records'],
      color: 'gray'
    }
  };
  
  export const getRoleLevel = (role: string): number => {
    return ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 0;
  };
  
  export const canAssignRole = (currentUserRole: string, targetRole: string): boolean => {
    const currentLevel = getRoleLevel(currentUserRole);
    const targetLevel = getRoleLevel(targetRole);
    
    // Only admins can assign admin role
    if (targetRole === 'admin') {
      return currentUserRole === 'admin';
    }
    
    // Users can only assign roles lower than their own level
    return currentLevel > targetLevel;
  };
  
  export const getAvailableRoles = (currentUserRole: string): string[] => {
    return Object.keys(ROLE_HIERARCHY).filter(role => {
      return canAssignRole(currentUserRole, role);
    });
  };