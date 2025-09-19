import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Shield, Eye, ChevronRight, User, Key, 
  Crown, Users, Package, Scissors, CheckCircle,
  Tractor, ShoppingCart, Truck, ClipboardList,
  Warehouse, BarChart3, Settings, FileText,
  Download, Home, Trash2, UserPlus, UserMinus,
  ShieldCheck, Wheat, Send, FileBarChart
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

interface UserPermissionsViewProps {
  className?: string;
  showAsModal?: boolean;
  onClose?: () => void;
}

// Permission categories and their icons
const PERMISSION_CATEGORIES = {
  'System Administration': { icon: Crown, color: 'bg-red-100 text-red-800 border-red-200' },
  'Basic Access': { icon: Home, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Inventory Management': { icon: Package, color: 'bg-green-100 text-green-800 border-green-200' },
  'Processing Operations': { icon: Scissors, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'Quality Control': { icon: CheckCircle, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Farming Operations': { icon: Tractor, color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Sales & Customer Management': { icon: ShoppingCart, color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'Logistics & Dispatch': { icon: Truck, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Orders Management': { icon: ClipboardList, color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'Warehouse Operations': { icon: Warehouse, color: 'bg-gray-100 text-gray-800 border-gray-200' },
  'Reports & Analytics': { icon: BarChart3, color: 'bg-cyan-100 text-cyan-800 border-cyan-200' }
};

// Permission icons mapping
const PERMISSION_ICONS: { [key: string]: any } = {
  '*': Crown,
  'admin_access': Shield,
  'manage_users': Users,
  'manage_roles': ShieldCheck,
  'view_audit_logs': FileText,
  'system_settings': Settings,
  'export_data': Download,
  'basic_access': Home,
  'read_all_data': Eye,
  'view_inventory': Package,
  'manage_inventory': Package,
  'delete_inventory': Trash2,
  'view_processing': Scissors,
  'manage_processing': Scissors,
  'delete_processing': Trash2,
  'view_quality': CheckCircle,
  'manage_quality': CheckCircle,
  'delete_quality': Trash2,
  'view_farming': Tractor,
  'manage_farming': Tractor,
  'delete_farming': Trash2,
  'view_harvests': Wheat,
  'manage_harvests': Wheat,
  'delete_harvests': Trash2,
  'view_sales': ShoppingCart,
  'manage_sales': ShoppingCart,
  'delete_sales': Trash2,
  'view_customers': Users,
  'manage_customers': UserPlus,
  'delete_customers': UserMinus,
  'view_logistics': Truck,
  'manage_logistics': Truck,
  'delete_logistics': Trash2,
  'view_dispatch': Send,
  'manage_dispatch': Send,
  'delete_dispatch': Trash2,
  'view_orders': ClipboardList,
  'manage_orders': ClipboardList,
  'delete_orders': Trash2,
  'view_warehouse': Warehouse,
  'manage_warehouse': Warehouse,
  'delete_warehouse': Trash2,
  'view_reports': BarChart3,
  'create_reports': FileBarChart,
  'export_reports': Download
};

// All permissions from PermissionsDropdown for reference
const ALL_PERMISSIONS = [
  // System Administration
  { id: '*', name: 'All Permissions', description: 'Full system access - can do everything (Admin only)', category: 'System Administration' },
  { id: 'admin_access', name: 'Admin Access', description: 'Full administrative access to all system functions', category: 'System Administration' },
  { id: 'manage_users', name: 'Manage Users', description: 'Create, edit, and delete user accounts', category: 'System Administration' },
  { id: 'manage_roles', name: 'Manage Roles', description: 'Create, edit, and delete user roles and permissions', category: 'System Administration' },
  { id: 'view_audit_logs', name: 'View Audit Logs', description: 'Access system audit logs and activity history', category: 'System Administration' },
  { id: 'system_settings', name: 'System Settings', description: 'Configure system-wide settings and preferences', category: 'System Administration' },
  { id: 'export_data', name: 'Export Data', description: 'Export system data in various formats', category: 'System Administration' },

  // Basic Access
  { id: 'basic_access', name: 'Basic Access', description: 'Basic system access and navigation', category: 'Basic Access' },
  { id: 'read_all_data', name: 'Read All Data', description: 'View all system data without modification rights', category: 'Basic Access' },

  // Inventory Management
  { id: 'view_inventory', name: 'View Inventory', description: 'View fish inventory and stock levels', category: 'Inventory Management' },
  { id: 'manage_inventory', name: 'Manage Inventory', description: 'Add, update, and modify inventory records', category: 'Inventory Management' },
  { id: 'delete_inventory', name: 'Delete Inventory', description: 'Remove inventory records and items', category: 'Inventory Management' },

  // Processing Operations
  { id: 'view_processing', name: 'View Processing', description: 'View fish processing operations and records', category: 'Processing Operations' },
  { id: 'manage_processing', name: 'Manage Processing', description: 'Create and update processing operations', category: 'Processing Operations' },
  { id: 'delete_processing', name: 'Delete Processing', description: 'Remove processing records and operations', category: 'Processing Operations' },

  // Quality Control
  { id: 'view_quality', name: 'View Quality', description: 'View quality control records and assessments', category: 'Quality Control' },
  { id: 'manage_quality', name: 'Manage Quality', description: 'Create and update quality control assessments', category: 'Quality Control' },
  { id: 'delete_quality', name: 'Delete Quality', description: 'Remove quality control records', category: 'Quality Control' },

  // Farming Operations
  { id: 'view_farming', name: 'View Farming', description: 'View farming operations and records', category: 'Farming Operations' },
  { id: 'manage_farming', name: 'Manage Farming', description: 'Create and update farming operations', category: 'Farming Operations' },
  { id: 'delete_farming', name: 'Delete Farming', description: 'Remove farming operation records', category: 'Farming Operations' },
  { id: 'view_harvests', name: 'View Harvests', description: 'View harvest records and data', category: 'Farming Operations' },
  { id: 'manage_harvests', name: 'Manage Harvests', description: 'Create and update harvest records', category: 'Farming Operations' },
  { id: 'delete_harvests', name: 'Delete Harvests', description: 'Remove harvest records', category: 'Farming Operations' },

  // Sales & Customer Management
  { id: 'view_sales', name: 'View Sales', description: 'View sales records and transactions', category: 'Sales & Customer Management' },
  { id: 'manage_sales', name: 'Manage Sales', description: 'Create and update sales transactions', category: 'Sales & Customer Management' },
  { id: 'delete_sales', name: 'Delete Sales', description: 'Remove sales records and transactions', category: 'Sales & Customer Management' },
  { id: 'view_customers', name: 'View Customers', description: 'View customer information and records', category: 'Sales & Customer Management' },
  { id: 'manage_customers', name: 'Manage Customers', description: 'Create and update customer information', category: 'Sales & Customer Management' },
  { id: 'delete_customers', name: 'Delete Customers', description: 'Remove customer records', category: 'Sales & Customer Management' },

  // Logistics & Dispatch
  { id: 'view_logistics', name: 'View Logistics', description: 'View logistics and transportation records', category: 'Logistics & Dispatch' },
  { id: 'manage_logistics', name: 'Manage Logistics', description: 'Create and update logistics operations', category: 'Logistics & Dispatch' },
  { id: 'delete_logistics', name: 'Delete Logistics', description: 'Remove logistics records', category: 'Logistics & Dispatch' },
  { id: 'view_dispatch', name: 'View Dispatch', description: 'View dispatch records and deliveries', category: 'Logistics & Dispatch' },
  { id: 'manage_dispatch', name: 'Manage Dispatch', description: 'Create and update dispatch operations', category: 'Logistics & Dispatch' },
  { id: 'delete_dispatch', name: 'Delete Dispatch', description: 'Remove dispatch records', category: 'Logistics & Dispatch' },

  // Orders Management
  { id: 'view_orders', name: 'View Orders', description: 'View outlet orders and requests', category: 'Orders Management' },
  { id: 'manage_orders', name: 'Manage Orders', description: 'Create, update, and process orders', category: 'Orders Management' },
  { id: 'delete_orders', name: 'Delete Orders', description: 'Remove order records', category: 'Orders Management' },

  // Warehouse Operations
  { id: 'view_warehouse', name: 'View Warehouse', description: 'View warehouse operations and storage', category: 'Warehouse Operations' },
  { id: 'manage_warehouse', name: 'Manage Warehouse', description: 'Create and update warehouse operations', category: 'Warehouse Operations' },
  { id: 'delete_warehouse', name: 'Delete Warehouse', description: 'Remove warehouse operation records', category: 'Warehouse Operations' },

  // Reports & Analytics
  { id: 'view_reports', name: 'View Reports', description: 'View system reports and analytics', category: 'Reports & Analytics' },
  { id: 'create_reports', name: 'Create Reports', description: 'Generate custom reports and analytics', category: 'Reports & Analytics' },
  { id: 'export_reports', name: 'Export Reports', description: 'Export reports to CSV and other formats', category: 'Reports & Analytics' }
];

export function UserPermissionsView({ className = '', showAsModal = false, onClose }: UserPermissionsViewProps) {
  const { userProfile, userRole, permissions, loading } = usePermissions();
  const [isExpanded, setIsExpanded] = useState(false);

  // Get user's permissions with details
  const getUserPermissions = () => {
    if (loading) return [];
    if (!permissions || permissions.length === 0) return [];
    
    // If user has all permissions
    if (permissions.includes('*')) {
      return ALL_PERMISSIONS;
    }
    
    // Get detailed permission info
    return permissions.map(permissionId => 
      ALL_PERMISSIONS.find(p => p.id === permissionId)
    ).filter(Boolean);
  };

  const userPermissions = getUserPermissions();
  
  // Group permissions by category
  const permissionsByCategory = userPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  const hasAllPermissions = permissions.includes('*');

  const Content = () => (
    <div className={className}>
      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">Loading permissions...</p>
                <p className="text-xs text-gray-600">Please wait while we fetch your permissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {!loading && (!userProfile || !permissions) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Shield className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">Unable to load permissions</p>
                <p className="text-xs text-gray-600">There was an issue loading your permissions. Please try refreshing the page.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!loading && userProfile && permissions && (
        <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-600" />
            Your Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-blue-900">
                {userProfile?.first_name} {userProfile?.last_name}
              </p>
              <p className="text-xs text-blue-600">
                {userProfile?.email}
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {userRole?.name?.replace('_', ' ').toUpperCase() || userRole?.display_name?.toUpperCase() || 'USER'}
            </Badge>
          </div>

          {/* Permissions Summary */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Total Permissions:</span>
              <Badge variant="outline" className="bg-white">
                {hasAllPermissions ? 'All Permissions' : `${userPermissions.length} permissions`}
              </Badge>
            </div>
            {hasAllPermissions && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Crown className="h-4 w-4" />
                <span>You have full administrative access to the system</span>
              </div>
            )}
          </div>

          {/* Permissions by Category */}
          {!hasAllPermissions && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-gray-700">Permission Categories</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-6 px-2 text-xs"
                >
                  {isExpanded ? 'Collapse' : 'Expand'} All
                  <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </Button>
              </div>

              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {Object.entries(permissionsByCategory).map(([category, categoryPermissions]) => {
                    const CategoryIcon = PERMISSION_CATEGORIES[category]?.icon || Shield;
                    const categoryColor = PERMISSION_CATEGORIES[category]?.color || 'bg-gray-100 text-gray-800 border-gray-200';
                    
                    return (
                      <div key={category} className="border rounded-lg">
                        <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
                          <CategoryIcon className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-sm text-gray-700">{category}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {categoryPermissions.length} permissions
                          </Badge>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          {categoryPermissions.map((permission) => {
                            const PermissionIcon = PERMISSION_ICONS[permission.id] || Key;
                            return (
                              <div key={permission.id} className="flex items-start gap-2 p-2 bg-white rounded border">
                                <PermissionIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900">{permission.name}</p>
                                  <p className="text-xs text-gray-500">{permission.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* All Permissions View */}
          {hasAllPermissions && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700">Available System Permissions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(PERMISSION_CATEGORIES).map(([category, categoryInfo]) => {
                  const CategoryIcon = categoryInfo.icon;
                  const categoryPermissions = ALL_PERMISSIONS.filter(p => p.category === category);
                  
                  return (
                    <div key={category} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm text-gray-700">{category}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {categoryPermissions.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {categoryPermissions.slice(0, 3).map((permission) => (
                          <div key={permission.id} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-gray-600">{permission.name}</span>
                          </div>
                        ))}
                        {categoryPermissions.length > 3 && (
                          <div className="text-xs text-gray-500 ml-3.5">
                            +{categoryPermissions.length - 3} more permissions
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );

  if (showAsModal) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Your Role & Permissions
            </DialogTitle>
            <DialogDescription>
              View your assigned role and the permissions you have in the Fish Management System
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Content />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return <Content />;
}
