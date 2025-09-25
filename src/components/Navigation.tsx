import { Button } from "./ui/button";
import { 
  Package, Home, Menu, LogOut, User, 
  Warehouse, Scissors, ShoppingCart, Truck, CheckSquare, BarChart3, Users, Filter, Shield, Trash2, ArrowRight
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "./ui/sheet";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { useState } from "react";
import { NavigationSection } from "../types";
import { usePermissions } from "../hooks/usePermissions";
import { ErrorBoundary } from "./ErrorBoundary";
import { RioFishLogo } from "./RioFishLogo";

interface NavigationProps {
  currentSection: NavigationSection;
  onNavigate: (section: NavigationSection) => void;
  onLogout: () => void;
}

export function Navigation({ currentSection, onNavigate, onLogout }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { userProfile, canAccess, isAdmin, loading, permissions } = usePermissions();


  const getIcon = (iconName: string) => {
    const icons = {
      Home, Warehouse, Scissors, Package, ShoppingCart, Truck, CheckSquare, BarChart3, Users, Filter, Trash2, ArrowRight
    };
    return icons[iconName as keyof typeof icons] || Home;
  };


  const navSections = [
    {
      title: "Overview",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'Home', permissions: ['read:basic'] }
      ]
    },
    {
      title: "Warehouse Operations", 
      items: [
        { id: 'warehouse-entry', label: 'Fish Entry', icon: 'Warehouse', permissions: ['write:inventory'] },
        { id: 'processing', label: 'Processing', icon: 'Scissors', permissions: ['write:processing'] },
        { id: 'sorting', label: 'Sorting', icon: 'Filter', permissions: ['write:processing'] },
        { id: 'inventory', label: 'Inventory', icon: 'Package', permissions: ['read:inventory'] },
        { id: 'transfers', label: 'Transfers', icon: 'ArrowRight', permissions: ['read:inventory'] },
        { id: 'disposal', label: 'Disposal', icon: 'Trash2', permissions: ['write:disposal'] }
      ]
    },
    {
      title: "Outlet Sales",
      items: [
        { id: 'outlet-orders', label: 'Outlet Orders', icon: 'ShoppingCart', permissions: ['read:sales'] },
        { id: 'dispatch', label: 'Dispatch', icon: 'Truck', permissions: ['write:logistics'] },
        { id: 'outlet-receiving', label: 'Outlet Receiving', icon: 'CheckSquare', permissions: ['read:sales'] }
      ]
    },
    {
      title: "Analytics",
      items: [
        { id: 'reports', label: 'Reports & Analytics', icon: 'BarChart3', permissions: ['read:basic'] }
      ]
    },
    {
      title: "System Administration",
      items: [
        { id: 'user-management', label: 'User Management', icon: 'Users', permissions: ['admin:*', 'write:users'] }
      ]
    }
  ];

  const NavContent = () => {
    try {
      // If still loading, show basic navigation for admin users only
      if (loading && userProfile?.role === 'admin') {
        return (
          <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
            <nav className="space-y-4 flex-1">
              {navSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h3 className="px-3 text-xs font-semibold text-white uppercase tracking-wide mb-2" style={{ color: 'white !important' }}>
                    {section.title}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = getIcon(item.icon);
                      const isActive = currentSection === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          className={`w-full flex items-center gap-3 h-10 text-left font-medium mx-2 text-sm px-3 rounded-lg transition-colors ${
                            isActive 
                              ? "bg-blue-700 text-white border-r-2 border-white" 
                              : "text-white hover:text-white hover:bg-blue-700"
                          }`}
                          style={{ color: 'white !important' }}
                          onClick={() => {
                            onNavigate(item.id as NavigationSection);
                            setIsOpen(false);
                          }}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-white"}`} style={{ color: 'white !important' }} />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className={`text-xs h-5 px-2 rounded-full flex items-center ${
                              isActive ? "bg-white text-blue-700" : "bg-blue-500 text-white"
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        );
      }

    // Filter sections and items based on permissions
    const filteredSections = navSections.map(section => ({
      ...section,
      items: section.items.filter(item => {
        // If still loading permissions, only show dashboard
        if (loading) {
          return item.id === 'dashboard';
        }
        
        // If no permissions specified, allow access
        if (!item.permissions) return true;
        
        // Admin has access to everything
        if (isAdmin()) return true;
        
        // Check if user can access this section
        const hasAccess = canAccess(item.id);
        return hasAccess;
      })
    })).filter(section => section.items.length > 0);

    // Navigation filtering is working correctly

    return (
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
        <nav className="space-y-4 flex-1">
          {filteredSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="px-3 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = getIcon(item.icon);
                  const isActive = currentSection === item.id;
                  
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start gap-3 h-10 text-left font-medium mx-2 text-sm px-3 overflow-hidden ${
                        isActive 
                          ? "bg-blue-600 text-white shadow-md" 
                          : "text-blue-800 hover:text-blue-900 hover:bg-blue-200"
                      }`}
                      onClick={() => {
                        onNavigate(item.id as NavigationSection);
                        setIsOpen(false);
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs h-4 px-1.5 rounded-full ${
                            isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""
                          }`}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="border-t border-blue-200 pt-3 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-700 rounded-lg mx-1">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-white text-blue-600 font-semibold text-xs">
                {userProfile?.first_name && userProfile?.last_name 
                  ? `${userProfile.first_name.charAt(0)}${userProfile.last_name.charAt(0)}` 
                  : 'RF'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs truncate text-white" style={{ color: 'white !important' }}>
                {userProfile?.first_name && userProfile?.last_name 
                  ? `${userProfile.first_name} ${userProfile.last_name}` 
                  : 'User'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white truncate" style={{ color: 'white !important' }}>
                  {userProfile?.role ? userProfile.role.replace('_', ' ').toUpperCase() : 'Rio Fish Farm'}
                </p>
                {permissions && permissions.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-white text-blue-600 border-white">
                    {permissions.includes('*') ? 'All' : permissions.length}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          
          <button
            className="w-full flex items-center gap-2 h-8 text-left font-medium text-red-200 hover:text-white hover:bg-red-600 mx-1 text-sm px-3 rounded-lg transition-colors"
            onClick={() => {
              onLogout();
              setIsOpen(false);
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    );
    } catch (error) {
      console.error('Navigation error:', error);
      return <FallbackNavContent />;
    }
  };

  // Fallback navigation content in case of errors
  const FallbackNavContent = () => (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
      <nav className="space-y-4 flex-1">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 lg:mb-2">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = currentSection === item.id;
                return renderNavItem(item, isActive);
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t pt-3 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg mx-1">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
              RF
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs truncate">User</p>
            <p className="text-xs text-muted-foreground truncate">Rio Fish Farm</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-8 text-left font-medium text-destructive hover:text-destructive hover:bg-destructive/10 mx-1 text-sm"
          onClick={() => {
            onLogout();
            setIsOpen(false);
          }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Navigation - Responsive sidebar like Meru Craft Collect */}
      <div className="
        hidden 
        lg:flex 
        w-64
        xl:w-72
        bg-blue-600
        border-r 
        border-blue-800
        flex-col 
        fixed 
        left-0 
        top-0 
        h-screen 
        z-50 
        shadow-lg
        min-w-0
        flex-shrink-0
        isolate
        navigation-container
      ">
        {/* Professional header with logo like Meru Craft Collect */}
        <div className="p-6 border-b border-blue-800 flex-shrink-0 bg-blue-600">
          <div className="flex items-center">
            <div className="w-10 h-10 mr-4">
              <img 
                src="/fish-management/riofish-logo.png" 
                alt="Rio Fish Logo" 
                className="w-full h-full object-contain"
                style={{ imageRendering: 'crisp-edges' }}
                onError={(e) => {
                  console.log('Logo failed to load, trying fallback');
                  const target = e.target as HTMLImageElement;
                  target.src = "https://riofish.co.ke/wp-content/uploads/2024/01/riofish_logo_copy-removed-background-white.png";
                }}
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Rio Fish Farm</h1>
              <p className="text-sm text-blue-100">Kenya Operations</p>
            </div>
          </div>
        </div>
        
        {/* Professional navigation content with blue background */}
        <div className="flex-1 flex flex-col overflow-hidden bg-blue-600">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ErrorBoundary>
              <NavContent />
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Mobile Navigation - Responsive header like Meru Craft Collect */}
      <div className="
        lg:hidden 
        fixed 
        top-0 
        left-0 
        right-0 
        z-50 
        bg-blue-600 
        border-b
        border-blue-800
        h-14
        sm:h-16
        shadow-lg
        backdrop-blur-sm
        min-w-0
        isolate
        navigation-container
      ">
        <div className="flex items-center justify-between px-4 h-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <img 
                src="/fish-management/riofish-logo.png" 
                alt="Rio Fish Logo" 
                className="w-8 h-8 object-contain"
                style={{ imageRendering: 'crisp-edges' }}
                onError={(e) => {
                  console.log('Logo failed to load, trying fallback');
                  const target = e.target as HTMLImageElement;
                  target.src = "https://riofish.co.ke/wp-content/uploads/2024/01/riofish_logo_copy-removed-background-white.png";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-sm sm:text-base text-white truncate" style={{ color: 'white !important' }}>Rio Fish Farm</h2>
              <p className="text-xs text-white/80 truncate" style={{ color: 'rgba(255,255,255,0.8) !important' }}>Kenya Operations</p>
            </div>
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-white/10 transition-colors active:bg-white/20">
                <Menu className="w-6 h-6 text-white" style={{ color: 'white !important' }} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-blue-600 border-blue-800">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-6 border-b border-blue-800 bg-blue-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                    <img 
                      src="/fish-management/riofish-logo.png" 
                      alt="Rio Fish Logo" 
                      className="w-10 h-10 object-contain"
                      style={{ imageRendering: 'crisp-edges' }}
                      onError={(e) => {
                        console.log('Logo failed to load, trying fallback');
                        const target = e.target as HTMLImageElement;
                        target.src = "https://riofish.co.ke/wp-content/uploads/2024/01/riofish_logo_copy-removed-background-white.png";
                      }}
                    />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white" style={{ color: 'white !important' }}>Rio Fish Farm</h1>
                    <p className="text-sm text-white/80" style={{ color: 'rgba(255,255,255,0.8) !important' }}>Kenya Operations</p>
                  </div>
                </div>
              </div>
              <div className="p-4 h-[calc(100vh-140px)] overflow-y-auto bg-blue-600">
                <NavContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
    </>
  );
}