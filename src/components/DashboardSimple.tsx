import { NavigationSection } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { 
  Warehouse, 
  Scissors, 
  Truck, 
  ShoppingCart, 
  TrendingUp, 
  Package, 
  BarChart3,
  Home,
  Plus,
  Eye
} from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";

interface DashboardSimpleProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

export function DashboardSimple({ onNavigate }: DashboardSimpleProps) {
  const { canAccess } = usePermissions();
  
  return (
    <div className="min-h-screen bg-gray-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <div className="text-2xl font-bold text-white">🐟</div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RIO FISH FARM</h1>
              <p className="text-gray-600 mt-1">Size-Based Fish Processing Management • Kenya Operations</p>
            </div>
          </div>
          <div className="flex gap-3">
            {canAccess("warehouse-entry") && (
              <Button 
                variant="outline"
                onClick={() => onNavigate("warehouse-entry")}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Warehouse Entries</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <Warehouse className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Processing Queue</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <Scissors className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Ready for Dispatch</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <Truck className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Outlet Orders</p>
                  <p className="text-3xl font-bold">0</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fish Entry - requires write:inventory */}
              {canAccess("warehouse-entry") && (
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => onNavigate("warehouse-entry")}
                >
                  <Warehouse className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-medium">Fish Entry</span>
                </Button>
              )}
              
              {/* Processing - requires write:processing */}
              {canAccess("processing") && (
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-orange-50 hover:border-orange-300"
                  onClick={() => onNavigate("processing")}
                >
                  <Scissors className="h-6 w-6 text-orange-600" />
                  <span className="text-sm font-medium">Processing</span>
                </Button>
              )}
              
              {/* Dispatch - requires write:logistics */}
              {canAccess("dispatch") && (
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-green-50 hover:border-green-300"
                  onClick={() => onNavigate("dispatch")}
                >
                  <Truck className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium">Dispatch</span>
                </Button>
              )}
              
              {/* Orders - requires read:sales */}
              {canAccess("outlet-orders") && (
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-purple-50 hover:border-purple-300"
                  onClick={() => onNavigate("outlet-orders")}
                >
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                  <span className="text-sm font-medium">Orders</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No recent activity</p>
              <p className="text-sm text-gray-400 mt-1">Activity will appear here as you use the system</p>
              {canAccess("warehouse-entry") && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => onNavigate("warehouse-entry")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start with Fish Entry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
