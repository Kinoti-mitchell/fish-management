import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
}

interface PermissionsDropdownProps {
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  className?: string;
}

// Tailored permissions for Fish Management System
const ALL_PERMISSIONS: Permission[] = [
  // System Administration
  {
    id: '*',
    name: 'All Permissions',
    description: 'Full system access - can do everything (Admin only)',
    category: 'System Administration',
    icon: 'Crown'
  },
  {
    id: 'manage_users',
    name: 'Manage Users',
    description: 'Create, edit, and delete user accounts and roles',
    category: 'System Administration',
    icon: 'Users'
  },
  {
    id: 'view_audit_logs',
    name: 'View Audit Logs',
    description: 'Access system audit logs and activity history',
    category: 'System Administration',
    icon: 'FileText'
  },
  {
    id: 'export_data',
    name: 'Export Data',
    description: 'Export system data in various formats',
    category: 'System Administration',
    icon: 'Download'
  },

  // Dashboard & Overview
  {
    id: 'view_dashboard',
    name: 'View Dashboard',
    description: 'Access the main dashboard and overview',
    category: 'Dashboard & Overview',
    icon: 'Home'
  },

  // Fish Entry & Warehouse
  {
    id: 'view_fish_entry',
    name: 'View Fish Entry',
    description: 'View fish entry records and warehouse operations',
    category: 'Fish Entry & Warehouse',
    icon: 'Warehouse'
  },
  {
    id: 'manage_fish_entry',
    name: 'Manage Fish Entry',
    description: 'Create and update fish entry records',
    category: 'Fish Entry & Warehouse',
    icon: 'Warehouse'
  },
  {
    id: 'view_warehouse',
    name: 'View Warehouse',
    description: 'View warehouse storage and operations',
    category: 'Fish Entry & Warehouse',
    icon: 'Package'
  },
  {
    id: 'manage_warehouse',
    name: 'Manage Warehouse',
    description: 'Update warehouse storage and operations',
    category: 'Fish Entry & Warehouse',
    icon: 'Package'
  },

  // Processing Operations
  {
    id: 'view_processing',
    name: 'View Processing',
    description: 'View fish processing operations and records',
    category: 'Processing Operations',
    icon: 'Scissors'
  },
  {
    id: 'manage_processing',
    name: 'Manage Processing',
    description: 'Create and update fish processing operations',
    category: 'Processing Operations',
    icon: 'Scissors'
  },
  {
    id: 'view_sorting',
    name: 'View Sorting',
    description: 'View fish sorting operations and records',
    category: 'Processing Operations',
    icon: 'Filter'
  },
  {
    id: 'manage_sorting',
    name: 'Manage Sorting',
    description: 'Create and update fish sorting operations',
    category: 'Processing Operations',
    icon: 'Filter'
  },

  // Inventory Management
  {
    id: 'view_inventory',
    name: 'View Inventory',
    description: 'View fish inventory and stock levels',
    category: 'Inventory Management',
    icon: 'Package'
  },
  {
    id: 'manage_inventory',
    name: 'Manage Inventory',
    description: 'Update inventory records and stock levels',
    category: 'Inventory Management',
    icon: 'Package'
  },

  // Outlet Operations
  {
    id: 'view_outlet_orders',
    name: 'View Outlet Orders',
    description: 'View outlet order records and status',
    category: 'Outlet Operations',
    icon: 'ShoppingCart'
  },
  {
    id: 'manage_outlet_orders',
    name: 'Manage Outlet Orders',
    description: 'Create and update outlet orders',
    category: 'Outlet Operations',
    icon: 'ShoppingCart'
  },
  {
    id: 'view_outlet_receiving',
    name: 'View Outlet Receiving',
    description: 'View outlet receiving records and confirmations',
    category: 'Outlet Operations',
    icon: 'CheckSquare'
  },
  {
    id: 'manage_outlet_receiving',
    name: 'Manage Outlet Receiving',
    description: 'Update outlet receiving records and confirmations',
    category: 'Outlet Operations',
    icon: 'CheckSquare'
  },

  // Dispatch & Delivery
  {
    id: 'view_dispatch',
    name: 'View Dispatch',
    description: 'View dispatch operations and delivery records',
    category: 'Dispatch & Delivery',
    icon: 'Truck'
  },
  {
    id: 'manage_dispatch',
    name: 'Manage Dispatch',
    description: 'Create and update dispatch operations',
    category: 'Dispatch & Delivery',
    icon: 'Truck'
  },
  {
    id: 'view_delivery',
    name: 'View Delivery',
    description: 'View delivery records and status',
    category: 'Dispatch & Delivery',
    icon: 'Truck'
  },
  {
    id: 'manage_delivery',
    name: 'Manage Delivery',
    description: 'Update delivery records and status',
    category: 'Dispatch & Delivery',
    icon: 'Truck'
  },

  // Disposal Management
  {
    id: 'view_disposal',
    name: 'View Disposal',
    description: 'View disposal records and waste management',
    category: 'Disposal Management',
    icon: 'Trash2'
  },
  {
    id: 'manage_disposal',
    name: 'Manage Disposal',
    description: 'Create and update disposal records',
    category: 'Disposal Management',
    icon: 'Trash2'
  },

  // Client Management
  {
    id: 'view_clients',
    name: 'View Clients',
    description: 'View client information and records',
    category: 'Client Management',
    icon: 'Users'
  },
  {
    id: 'manage_clients',
    name: 'Manage Clients',
    description: 'Create and update client records',
    category: 'Client Management',
    icon: 'Users'
  },

  // Reports & Analytics
  {
    id: 'view_reports',
    name: 'View Reports',
    description: 'View system reports and analytics',
    category: 'Reports & Analytics',
    icon: 'BarChart3'
  },
  {
    id: 'export_reports',
    name: 'Export Reports',
    description: 'Export reports to CSV and other formats',
    category: 'Reports & Analytics',
    icon: 'Download'
  }
];

const CATEGORIES = [
  'System Administration',
  'Dashboard & Overview',
  'Fish Entry & Warehouse',
  'Processing Operations',
  'Inventory Management',
  'Outlet Operations',
  'Dispatch & Delivery',
  'Disposal Management',
  'Client Management',
  'Reports & Analytics'
];

export function PermissionsDropdown({ 
  selectedPermissions, 
  onPermissionsChange, 
  className = '' 
}: PermissionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(CATEGORIES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  const filteredPermissions = ALL_PERMISSIONS.filter(permission =>
    permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permissionsByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredPermissions.filter(p => p.category === category);
    return acc;
  }, {} as Record<string, Permission[]>);

  const togglePermission = (permissionId: string) => {
    if (permissionId === '*') {
      // If selecting "All Permissions", clear all others
      onPermissionsChange(['*']);
    } else {
      // Remove "All Permissions" if it exists and add/remove the specific permission
      const filteredPermissions = selectedPermissions.filter(id => id !== '*');
      
      const newPermissions = filteredPermissions.includes(permissionId)
        ? filteredPermissions.filter(id => id !== permissionId)
        : [...filteredPermissions, permissionId];
      
      // Remove any duplicates and update
      const uniquePermissions = [...new Set(newPermissions)];
      onPermissionsChange(uniquePermissions);
    }
    
    // Don't close dropdown automatically - let user select multiple permissions
    // setIsOpen(false);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearAll = () => {
    onPermissionsChange([]);
  };

  const selectAll = () => {
    onPermissionsChange(['*']);
  };

  const selectAllInCategory = (category: string) => {
    const categoryPermissions = ALL_PERMISSIONS.filter(p => p.category === category);
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    
    // Remove "All Permissions" if it exists and add category permissions
    const filteredPermissions = selectedPermissions.filter(id => id !== '*');
    const newPermissions = [...filteredPermissions, ...categoryPermissionIds];
    
    // Remove duplicates
    const uniquePermissions = [...new Set(newPermissions)];
    onPermissionsChange(uniquePermissions);
  };

  const clearAllInCategory = (category: string) => {
    const categoryPermissions = ALL_PERMISSIONS.filter(p => p.category === category);
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    
    // Remove category permissions
    const newPermissions = selectedPermissions.filter(id => !categoryPermissionIds.includes(id));
    onPermissionsChange(newPermissions);
  };

  const getPermissionIcon = (iconName?: string) => {
    // You can add icon mapping here if needed
    return null;
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between h-auto min-h-[40px] p-3"
      >
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">
              {selectedPermissions.length === 0
                ? 'Select permissions...'
                : selectedPermissions.includes('*')
                ? 'All Permissions'
                : `${selectedPermissions.length} permissions selected`}
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          {selectedPermissions.length > 0 && selectedPermissions.length <= 3 && !selectedPermissions.includes('*') && (
            <div className="flex flex-wrap gap-1 mt-2 w-full">
              {selectedPermissions.map(permissionId => {
                const permission = ALL_PERMISSIONS.find(p => p.id === permissionId);
                return (
                  <Badge
                    key={permissionId}
                    variant="secondary"
                    className="text-xs"
                  >
                    {permission?.name || permissionId}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-96">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={clearAll}>
                Clear All
              </Button>
            </div>
            {selectedPermissions.length > 0 && (
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                <strong>Currently selected:</strong> {selectedPermissions.includes('*') 
                  ? 'All Permissions' 
                  : selectedPermissions.map(id => ALL_PERMISSIONS.find(p => p.id === id)?.name || id).join(', ')}
              </div>
            )}
          </div>

          <ScrollArea className="max-h-80">
            <div className="p-2">
              {CATEGORIES.map(category => {
                const categoryPermissions = permissionsByCategory[category];
                if (categoryPermissions.length === 0) return null;

                const isExpanded = expandedCategories.includes(category);
                const selectedInCategory = categoryPermissions.filter(p => 
                  selectedPermissions.includes(p.id)
                ).length;

                return (
                  <div key={category} className="mb-2">
                    <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategory(category)}
                        className="flex-1 justify-between p-2 h-auto"
                    >
                      <span className="font-medium text-sm">
                        {category} ({selectedInCategory}/{categoryPermissions.length})
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                      {isExpanded && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllInCategory(category)}
                            className="h-6 px-2 text-xs"
                            title="Select all in category"
                          >
                            All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearAllInCategory(category)}
                            className="h-6 px-2 text-xs"
                            title="Clear all in category"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="ml-4 space-y-1">
                        {categoryPermissions.map(permission => {
                          const isSelected = selectedPermissions.includes(permission.id);
                          return (
                            <div
                              key={permission.id}
                              className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50'
                              }`}
                              onClick={() => togglePermission(permission.id)}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">
                                    {permission.name}
                                    </span>
                                    {permission.id === '*' && (
                                      <Badge variant="destructive" className="text-xs">
                                        Admin
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {permission.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Done button - always show when dropdown is open */}
          <div className="p-3 border-t bg-gray-50">
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 px-3 text-xs"
              >
                Done
              </Button>
            </div>
          </div>

          {selectedPermissions.length > 0 && (
            <div className="p-3 border-t bg-gray-50">
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedPermissions.map(permissionId => {
                  const permission = ALL_PERMISSIONS.find(p => p.id === permissionId);
                  return (
                    <Badge
                      key={permissionId}
                      variant="secondary"
                      className="text-xs"
                    >
                      {permission?.name || permissionId}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePermission(permissionId);
                        }}
                      />
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


