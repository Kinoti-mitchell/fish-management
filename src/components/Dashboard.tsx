import { useEffect, useState } from "react";
import { NavigationSection } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { StatCard } from "./ui/stat-card";
import { Badge } from "./ui/badge";
import { dashboardService } from "../services/database";
import { 
  Package, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Scale,
  Plus,
  ShoppingCart,
  Warehouse,
  Scissors,
  Truck,
  BarChart3,
  RefreshCw,
  Users,
  MapPin,
  DollarSign,
  Fish,
  Thermometer,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  Star,
  Eye,
  Ruler
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie,
  Cell, 
  LineChart, 
  Line, 
  Area, 
  AreaChart 
} from 'recharts';
import { FishFarmMarquee } from './FishFarmMarquee';
import { RioFishLogo } from './RioFishLogo';
import { usePermissions } from '../hooks/usePermissions';

interface DashboardProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

interface EnhancedStats {
  // Warehouse stats
  totalWarehouseEntries: number;
  totalWeight: number;
  avgTemperature: number;
  recentEntriesCount: number;
  recentWeight: number;
  
  // Processing stats
  totalProcessingRecords: number;
  totalReadyForDispatch: number;
  totalProcessedWeight: number;
  recentProcessingCount: number;
  recentProcessedWeight: number;
  
  // Inventory stats
  totalInventoryWeight: number;
  totalInventoryItems: number;
  avgFishSize: number;
  gradeDistribution: Record<string, number>;
  
  // Order stats
  totalOrders: number;
  totalOrderValue: number;
  statusDistribution: Record<string, number>;
  recentOrdersCount: number;
  recentOrderValue: number;
  
  // Dispatch stats
  totalDispatches: number;
  totalDispatchedWeight: number;
  pendingDispatchesCount: number;
  
  // Farmer stats
  totalFarmers: number;
  totalFarmerWeight: number;
  farmerPerformance: Record<string, { weight: number; entries: number }>;
  
  // Outlet stats
  totalOutlets: number;
  totalOutletValue: number;
  activeOutletsCount: number;
  
  // Activity
  recentActivity: any[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export function Dashboard({ onNavigate }: DashboardProps) {
  const { canAccess, isAdmin } = usePermissions();
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchEnhancedStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Dashboard: Fetching enhanced stats from database...');
      
      // Use the comprehensive enhanced stats method that fetches all data from DB
      const enhancedStats = await dashboardService.getEnhancedDashboardStats();
      
      console.log('Dashboard: Enhanced stats fetched from database:', enhancedStats);
      
      // Debug: Check if we're getting data
      if (!enhancedStats) {
        console.warn('Dashboard: No stats data received from database');
      } else {
        console.log('Dashboard: Stats breakdown:', {
          totalWarehouseEntries: enhancedStats.totalWarehouseEntries,
          totalWeight: enhancedStats.totalWeight,
          totalOrders: enhancedStats.totalOrders,
          totalFarmers: enhancedStats.totalFarmers,
          recentActivity: enhancedStats.recentActivity?.length || 0
        });
      }
      
      setStats(enhancedStats);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Dashboard: Error fetching enhanced stats:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnhancedStats();
  }, []);

  const formatKES = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const getTrendIcon = (value: number, isPositive: boolean = true) => {
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingCart className="h-4 w-4 text-blue-600" />;
      case "entry": return <Warehouse className="h-4 w-4 text-green-600" />;
      case "processing": return <Scissors className="h-4 w-4 text-purple-600" />;
      case "dispatch": return <Truck className="h-4 w-4 text-orange-600" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 content-container">
        {/* Marquee */}
        <FishFarmMarquee />
        
        <div className="responsive-padding">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl">
              <Fish className="h-12 w-12 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-900 to-indigo-800 bg-clip-text text-transparent">
                RIO FISH FARM
              </h1>
              <p className="text-lg text-slate-600 mt-2">Size-Based Fish Processing Management • Kenya Operations</p>
            </div>
          </div>
          
          {/* Loading Content */}
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="relative">
                <RefreshCw className="h-16 w-16 mx-auto mb-6 animate-spin text-blue-600" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              </div>
              <p className="text-2xl font-semibold text-slate-700 mb-2">Loading Dashboard...</p>
              <p className="text-slate-500 mb-4">Fetching real-time data from your database</p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 content-container overflow-x-hidden">
      {/* Marquee */}
      <FishFarmMarquee stats={stats} />
      
      <div className="responsive-padding">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-32 h-20 sm:w-48 sm:h-30 lg:w-64 lg:h-40 flex-shrink-0">
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
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2 bg-white/60 px-3 py-2 rounded-full">
                <Clock className="h-4 w-4" />
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-full">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={fetchEnhancedStats}
              disabled={loading}
              variant="outline" 
              className="px-6 py-3 rounded-xl font-semibold border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canAccess("warehouse-entry") && (
              <Button 
                variant="outline" 
                onClick={() => onNavigate("warehouse-entry")}
                className="px-6 py-3 rounded-xl font-semibold border-blue-300 hover:bg-blue-50"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Entry
              </Button>
            )}
            {canAccess("reports") && (
              <Button 
                onClick={() => onNavigate("reports")}
                className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                Reports
              </Button>
            )}
          </div>
          </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 font-semibold text-lg">Error loading dashboard</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                  <p className="text-red-500 text-xs mt-2">Please try refreshing or check your connection</p>
                </div>
                <Button 
                  onClick={fetchEnhancedStats}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-2xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Weight</p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">
                    {loading ? '...' : (stats?.totalWeight?.toFixed(1) || '0.0')}
                  </p>
                  <p className="text-sm text-blue-600">kg</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(stats?.recentWeight || 0)}
                    <span className="text-sm text-green-600 font-medium">
                      +{stats?.recentWeight?.toFixed(1) || 0}kg this week
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Scale className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-2xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Ready for Dispatch</p>
                  <p className="text-4xl font-bold text-emerald-900 mt-2">
                    {loading ? '...' : (stats?.totalReadyForDispatch || 0)}
                  </p>
                  <p className="text-sm text-emerald-600">fish ready</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(stats?.recentProcessingCount || 0)}
                    <span className="text-sm text-green-600 font-medium">
                      +{stats?.recentProcessingCount || 0} processed this week
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Truck className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-2xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Total Orders</p>
                  <p className="text-4xl font-bold text-purple-900 mt-2">
                    {loading ? '...' : (stats?.totalOrders || 0)}
                  </p>
                  <p className="text-sm text-purple-600">orders</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(stats?.recentOrdersCount || 0)}
                    <span className="text-sm text-green-600 font-medium">
                      +{stats?.recentOrdersCount || 0} this week
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <ShoppingCart className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-2xl transition-all duration-300 group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide">Total Value</p>
                  <p className="text-3xl font-bold text-orange-900 mt-2">
                    {loading ? '...' : formatKES(stats?.totalOrderValue || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(stats?.recentOrderValue || 0)}
                    <span className="text-sm text-green-600 font-medium">
                      +{formatKES(stats?.recentOrderValue || 0)} this week
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-600 to-orange-800 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
      </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Warehouse className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-cyan-600">Warehouse Entries</p>
                <p className="text-2xl font-bold text-cyan-900">{stats?.totalWarehouseEntries || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-gradient-to-br from-pink-600 to-pink-800 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Scissors className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-pink-600">Processing Records</p>
                <p className="text-2xl font-bold text-pink-900">{stats?.totalProcessingRecords || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-indigo-600 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-indigo-600">Inventory Items</p>
                <p className="text-2xl font-bold text-indigo-900">{stats?.totalInventoryItems || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-teal-600 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-teal-600">Active Outlets</p>
                <p className="text-2xl font-bold text-teal-900">{stats?.activeOutletsCount || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-amber-600 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-amber-600">Total Farmers</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.totalFarmers || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="text-center">
                <div className="p-2 bg-red-600 rounded-xl w-fit mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-red-600">Pending Dispatches</p>
                <p className="text-2xl font-bold text-red-900">{stats?.pendingDispatchesCount || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Temperature Trend */}
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-red-600 rounded-xl">
                  <Thermometer className="h-5 w-5 text-white" />
                </div>
                Average Temperature
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">
                  {loading ? '...' : `${stats?.avgTemperature || 0}°C`}
                </div>
                <p className="text-sm text-slate-500">Current average temperature</p>
                <div className="mt-4 p-3 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-700">
                    {stats?.avgTemperature && stats.avgTemperature > 25 
                      ? "⚠️ Temperature is high - monitor fish health" 
                      : "✅ Temperature is within normal range"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fish Size Analysis */}
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <Ruler className="h-5 w-5 text-white" />
                </div>
                Fish Size Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {loading ? '...' : `${stats?.avgFishSize || 0}kg`}
                </div>
                <p className="text-sm text-slate-500">Average fish size</p>
                <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                  <p className="text-sm text-blue-700">
                    {stats?.avgFishSize && stats.avgFishSize > 2 
                      ? "🐟 Large fish - good for premium markets" 
                      : "📏 Standard size - suitable for regular processing"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
            <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Activity className="h-6 w-6 text-white" />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Fish Entry - requires write:inventory */}
              {canAccess("warehouse-entry") && (
                <Button 
                  variant="outline" 
                  className="h-28 flex flex-col items-center justify-center gap-3 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 group"
                  onClick={() => onNavigate("warehouse-entry")}
                >
                  <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Warehouse className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-medium">Fish Entry</span>
                </Button>
              )}
              
              {/* Processing - requires write:processing */}
              {canAccess("processing") && (
                <Button 
                  variant="outline" 
                  className="h-28 flex flex-col items-center justify-center gap-3 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 group"
                  onClick={() => onNavigate("processing")}
                >
                  <div className="p-3 bg-gradient-to-br from-orange-600 to-orange-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Scissors className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-medium">Processing</span>
                </Button>
              )}
              
              {/* Dispatch - requires write:logistics */}
              {canAccess("dispatch") && (
                <Button 
                  variant="outline" 
                  className="h-28 flex flex-col items-center justify-center gap-3 hover:bg-green-50 hover:border-green-300 transition-all duration-300 group"
                  onClick={() => onNavigate("dispatch")}
                >
                  <div className="p-3 bg-gradient-to-br from-green-600 to-green-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Truck className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-medium">Dispatch</span>
                </Button>
              )}
              
              {/* Orders - requires read:sales */}
              {canAccess("outlet-orders") && (
                <Button 
                  variant="outline" 
                  className="h-28 flex flex-col items-center justify-center gap-3 hover:bg-purple-50 hover:border-purple-300 transition-all duration-300 group"
                  onClick={() => onNavigate("outlet-orders")}
                >
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <ShoppingCart className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-medium">Orders</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
            <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Processing Efficiency */}
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl">
                <div className="p-3 bg-gradient-to-br from-green-600 to-green-800 rounded-xl w-fit mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Processing Efficiency</h3>
                <p className="text-3xl font-bold text-green-900 mb-2">
                  {stats?.totalProcessingRecords || 0}
                </p>
                <p className="text-sm text-green-600">Total processing records</p>
                <div className="mt-3 p-2 bg-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    {stats?.totalReadyForDispatch && stats.totalReadyForDispatch > 0 
                      ? `✅ ${stats.totalReadyForDispatch} fish ready for dispatch` 
                      : "📋 No fish ready for dispatch"}
                  </p>
                </div>
              </div>

              {/* Inventory Health */}
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl w-fit mx-auto mb-4">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Inventory Health</h3>
                <p className="text-3xl font-bold text-blue-900 mb-2">
                  {stats?.totalInventoryWeight?.toFixed(1) || '0.0'}kg
                </p>
                <p className="text-sm text-blue-600">Total inventory weight</p>
                <div className="mt-3 p-2 bg-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    {stats?.totalInventoryWeight && stats.totalInventoryWeight > 100 
                      ? "📦 Good inventory levels" 
                      : "⚠️ Low inventory - consider restocking"}
                  </p>
                </div>
              </div>

              {/* Business Performance */}
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl">
                <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl w-fit mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Business Performance</h3>
                <p className="text-3xl font-bold text-purple-900 mb-2">
                  {stats?.totalOrders || 0}
                </p>
                <p className="text-sm text-purple-600">Total orders</p>
                <div className="mt-3 p-2 bg-purple-200 rounded-lg">
                  <p className="text-xs text-purple-800">
                    {stats?.totalOrders && stats.totalOrders > 0 
                      ? `💰 KES ${stats.totalOrderValue?.toLocaleString() || 0} total value` 
                      : "📊 No orders yet"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-green-600 to-green-800 rounded-xl">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                Recent Activity
              </CardTitle>
              {stats?.recentActivity && stats.recentActivity.length > 0 && (
                <Button 
                  variant="outline" 
                  className="px-4 py-2 rounded-xl text-sm"
                  onClick={() => onNavigate("reports")}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={activity?.id || index} className="flex items-center justify-between p-4 border border-slate-200 rounded-2xl hover:shadow-md hover:border-slate-300 transition-all duration-300 bg-white/50">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 rounded-xl">
                        {getActivityIcon(activity?.type || 'default')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{activity?.action || 'Unknown Action'}</p>
                        <p className="text-sm text-slate-500">{activity?.details || 'No details available'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600">
                        {activity?.created_at ? new Date(activity.created_at).toLocaleDateString() : 'Unknown date'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {activity?.created_at ? new Date(activity.created_at).toLocaleTimeString() : 'Unknown time'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-500">
                  <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-6">
                    <Package className="h-16 w-16 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-700">No recent activity</p>
                  <p className="text-sm mt-2 text-slate-500">Activity will appear here as you use the system</p>
                  {canAccess("warehouse-entry") && (
                    <Button 
                      variant="outline" 
                      className="mt-6 px-6 py-3 rounded-xl"
                      onClick={() => onNavigate("warehouse-entry")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Start with Fish Entry
                    </Button>
                  )}
                </div>
              )}
            </div>
            {stats?.recentActivity && stats.recentActivity.length > 5 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">
                  Showing 5 of {stats.recentActivity.length} recent activities
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
