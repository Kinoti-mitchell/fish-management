import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Calendar, DateRange } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { 
  BarChart3, Download, Calendar as CalendarIcon, TrendingUp, 
  TrendingDown, Fish, Scale, Package, Users, MapPin,
  PieChart, LineChart, DollarSign, Clock, CheckCircle, RefreshCw, AlertCircle,
  Thermometer, Droplets, Building2, Activity, Star
} from "lucide-react";
import { NavigationSection } from "../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie,
  Cell, 
  LineChart as RechartsLineChart, 
  Line, 
  Area, 
  AreaChart 
} from 'recharts';
import { useReportsData, ReportFilters } from "../hooks/useReportsData";
import { format } from "date-fns";
import { RioFishLogo } from "./RioFishLogo";

interface ReportsProps {
  onNavigate: (section: NavigationSection, itemId?: string) => void;
}

// Report data will be loaded from database

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export default function Reports({ onNavigate }: ReportsProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Convert date range to filters
  const filters: ReportFilters = {
    startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  };

  // Use the reports data hook
  const {
    overallStats,
    dailyProcessingData,
    sizeDistributionData,
    gradeDistributionData,
    farmerPerformanceData,
    outletPerformanceData,
    inventoryData,
    storageLocationData,
    loading,
    loadingStats,
    loadingDaily,
    loadingSize,
    loadingGrade,
    loadingFarmers,
    loadingOutlets,
    loadingInventory,
    loadingStorageLocations,
    error,
    refreshData,
    exportReport
  } = useReportsData(filters);

  const formatKES = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  // Handle date range changes
  useEffect(() => {
    if (dateRange?.from || dateRange?.to) {
      setLoadingTimeout(false);
      refreshData(filters);
    }
  }, [dateRange?.from, dateRange?.to]); // Only depend on the actual date values, not the entire refreshData function

  // Set loading timeout
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  // Handle export
  const handleExport = async (reportType: string) => {
    try {
      let data: any[] = [];
      let filename = '';
      
      switch (reportType) {
        case 'overall':
          if (overallStats) {
            data = [overallStats];
            filename = 'overall_stats';
          }
          break;
        case 'daily':
          data = dailyProcessingData;
          filename = 'daily_processing';
          break;
        case 'size':
          data = sizeDistributionData;
          filename = 'size_distribution';
          break;
        case 'grade':
          data = gradeDistributionData;
          filename = 'grade_distribution';
          break;
        case 'farmers':
          data = farmerPerformanceData;
          filename = 'farmer_performance';
          break;
        case 'outlets':
          data = outletPerformanceData;
          filename = 'outlet_performance';
          break;
        case 'inventory':
          data = storageLocationData;
          filename = 'storage_location_report';
          break;
        default:
          throw new Error('Invalid report type');
      }
      
      if (data.length > 0) {
        await exportReport(reportType, data, filename);
      } else {
        throw new Error('No data to export');
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 content-container responsive-padding">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <RioFishLogo size="lg" showText={false} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-cyan-600 rounded-2xl shadow-lg">
                <BarChart3 className="h-10 w-10 text-white" />
              </div>
              Reports & Analytics
            </h1>
            <p className="text-xl text-gray-600 ml-16">Comprehensive fish warehouse management insights • Performance metrics • Trends analysis</p>
          </div>
          <div className="flex gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="px-6 py-3 rounded-2xl font-semibold">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  {dateRange?.from && dateRange?.to 
                    ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                    : 'Date Range'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button 
              onClick={() => refreshData(filters)}
              disabled={loading}
              variant="outline" 
              className="px-6 py-3 rounded-2xl font-semibold"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={() => handleExport(selectedTab)}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Reports
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {(error || loadingTimeout) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  {error && <p className="text-red-800 font-medium">Error loading reports: {error}</p>}
                  {loadingTimeout && (
                    <p className="text-red-800 font-medium">
                      Reports are taking longer than expected to load. This might be due to network issues or database connectivity problems.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Entries</p>
                  <p className="text-4xl font-bold text-blue-900 mt-2">
                    {loadingStats ? '...' : (overallStats?.totalEntries || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(12.5)}
                    <span className="text-sm text-green-600 font-medium">+12.5%</span>
                  </div>
                </div>
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                  <Fish className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 to-emerald-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Total Weight</p>
                  <p className="text-4xl font-bold text-emerald-900 mt-2">
                    {loadingStats ? '...' : (overallStats?.totalWeight?.toFixed(1) || '0.0')}
                  </p>
                  <p className="text-sm text-emerald-600">kg</p>
                </div>
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg">
                  <Scale className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Total Value</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    {loadingStats ? '...' : formatKES(overallStats?.totalValue || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(8.3)}
                    <span className="text-sm text-green-600 font-medium">+8.3%</span>
                  </div>
                </div>
                <div className="p-4 bg-purple-600 rounded-2xl shadow-lg">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide">Processing Efficiency</p>
                  <p className="text-4xl font-bold text-orange-900 mt-2">
                    {loadingStats ? '...' : (overallStats?.processingEfficiency || 0)}
                  </p>
                  <p className="text-sm text-orange-600">%</p>
                </div>
                <div className="p-4 bg-orange-600 rounded-2xl shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-gradient-to-br from-cyan-50 to-cyan-100 hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Avg Fish Size</p>
                  <p className="text-4xl font-bold text-cyan-900 mt-2">
                    {loadingStats ? '...' : (overallStats?.averageSize || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {getTrendIcon(0.3)}
                    <span className="text-sm text-green-600 font-medium">+0.3</span>
                  </div>
                </div>
                <div className="p-4 bg-cyan-600 rounded-2xl shadow-lg">
                  <Package className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Reports Tabs */}
        <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl">
            <CardTitle className="text-2xl font-bold text-gray-900">Detailed Analytics</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-8">
              <TabsList className="flex w-full bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                <TabsTrigger value="overview" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Overview</TabsTrigger>
                <TabsTrigger value="size-analysis" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Size Analysis</TabsTrigger>
                <TabsTrigger value="processing" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Processing</TabsTrigger>
                <TabsTrigger value="orders" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Orders</TabsTrigger>
                <TabsTrigger value="inventory" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Storage Location</TabsTrigger>
                <TabsTrigger value="farmers" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Farmers</TabsTrigger>
                <TabsTrigger value="outlets" className="flex-1 rounded-md font-medium text-sm px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600 hover:text-gray-900 transition-colors">Outlets</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Daily Processing Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingDaily ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
                            <p className="text-gray-600">Loading processing data...</p>
                          </div>
                        </div>
                      ) : dailyProcessingData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={dailyProcessingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: 'none', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                              }} 
                            />
                            <Area type="monotone" dataKey="weight" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No processing data available</p>
                            <p className="text-sm">Data will appear here once processing records are available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Grade Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingGrade ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-green-600" />
                            <p className="text-gray-600">Loading grade data...</p>
                          </div>
                        </div>
                      ) : gradeDistributionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={gradeDistributionData}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              dataKey="quantity"
                              label={({ grade, percentage }) => `${grade}: ${percentage}%`}
                            >
                              {gradeDistributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: 'none', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                              }} 
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No grade data available</p>
                            <p className="text-sm">Data will appear here once inventory records are available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="size-analysis" className="space-y-8">
                <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-gray-900">Fish Size Distribution (0-10 Scale)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingSize ? (
                      <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-purple-600" />
                          <p className="text-gray-600">Loading size distribution data...</p>
                        </div>
                      </div>
                    ) : sizeDistributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={sizeDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="size" stroke="#6b7280" />
                          <YAxis stroke="#6b7280" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: 'none', 
                              borderRadius: '12px', 
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                            }} 
                          />
                          <Legend />
                          <Bar dataKey="quantity" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-96 text-gray-500">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p className="text-lg font-medium">No size distribution data available</p>
                          <p className="text-sm">Data will appear here once inventory records are available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-orange-800 mb-2">Small Fish (0-3)</h3>
                      <p className="text-3xl font-bold text-orange-900">
                        {loadingSize ? '...' : (sizeDistributionData.length > 0 ? sizeDistributionData.slice(0, 4).reduce((sum, item) => sum + (item.quantity || 0), 0) : 0)}
                      </p>
                      <p className="text-sm text-orange-600">pieces</p>
                    </CardContent>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-green-800 mb-2">Medium Fish (4-6)</h3>
                      <p className="text-3xl font-bold text-green-900">
                        {loadingSize ? '...' : (sizeDistributionData.length > 0 ? sizeDistributionData.slice(4, 7).reduce((sum, item) => sum + (item.quantity || 0), 0) : 0)}
                      </p>
                      <p className="text-sm text-green-600">pieces</p>
                    </CardContent>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">Large Fish (7-10)</h3>
                      <p className="text-3xl font-bold text-blue-900">
                        {loadingSize ? '...' : (sizeDistributionData.length > 0 ? sizeDistributionData.slice(7).reduce((sum, item) => sum + (item.quantity || 0), 0) : 0)}
                      </p>
                      <p className="text-sm text-blue-600">pieces</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="processing" className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Processing Efficiency Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingDaily ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-purple-600" />
                            <p className="text-gray-600">Loading processing efficiency data...</p>
                          </div>
                        </div>
                      ) : dailyProcessingData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsLineChart data={dailyProcessingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: 'none', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                              }} 
                            />
                            <Line type="monotone" dataKey="efficiency" stroke="#8b5cf6" strokeWidth={3} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No processing efficiency data available</p>
                            <p className="text-sm">Data will appear here once processing records are available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Processing Volume</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingDaily ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-orange-600" />
                            <p className="text-gray-600">Loading processing volume data...</p>
                          </div>
                        </div>
                      ) : dailyProcessingData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={dailyProcessingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: 'none', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                              }} 
                            />
                            <Bar dataKey="weight" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No processing volume data available</p>
                            <p className="text-sm">Data will appear here once processing records are available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">Total Processed</h3>
                      <p className="text-3xl font-bold text-blue-900">
                        {loadingStats ? '...' : (overallStats?.totalProcessed || 0)}
                      </p>
                      <p className="text-sm text-blue-600">batches</p>
                    </CardContent>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-green-800 mb-2">Avg Efficiency</h3>
                      <p className="text-3xl font-bold text-green-900">
                        {loadingStats ? '...' : (overallStats?.processingEfficiency || 0)}%
                      </p>
                      <p className="text-sm text-green-600">yield rate</p>
                    </CardContent>
                  </Card>
                  <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-lg">
                    <CardContent className="text-center">
                      <h3 className="text-lg font-semibold text-red-800 mb-2">Waste Rate</h3>
                      <p className="text-3xl font-bold text-red-900">
                        {loadingStats ? '...' : (overallStats?.wastePercentage || 0)}%
                      </p>
                      <p className="text-sm text-red-600">waste percentage</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Order Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingOutlets ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-indigo-600" />
                            <p className="text-gray-600">Loading order data...</p>
                          </div>
                        </div>
                      ) : outletPerformanceData.length > 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-green-800">Total Orders</h4>
                              <p className="text-2xl font-bold text-green-900">
                                {outletPerformanceData.reduce((sum, outlet) => sum + outlet.orders, 0)}
                              </p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-blue-800">Total Value</h4>
                              <p className="text-xl font-bold text-blue-900">
                                {formatKES(outletPerformanceData.reduce((sum, outlet) => sum + outlet.totalValue, 0))}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {outletPerformanceData.map((outlet, index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-medium text-gray-900">{outlet.name}</p>
                                  <p className="text-sm text-gray-500">{outlet.location}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">{outlet.orders} orders</p>
                                  <p className="text-sm text-gray-600">{formatKES(outlet.totalValue)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No order data available</p>
                            <p className="text-sm">Data will appear here once orders are created</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-semibold text-gray-900">Order Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingOutlets ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-emerald-600" />
                            <p className="text-gray-600">Loading performance data...</p>
                          </div>
                        </div>
                      ) : outletPerformanceData.length > 0 ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-blue-800">Avg Order Size</h4>
                              <p className="text-2xl font-bold text-blue-900">
                                {outletPerformanceData.length > 0 
                                  ? (outletPerformanceData.reduce((sum, outlet) => sum + outlet.avgOrderSize, 0) / outletPerformanceData.length).toFixed(1)
                                  : 0} kg
                              </p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-green-800">On-Time Delivery</h4>
                              <p className="text-2xl font-bold text-green-900">
                                {outletPerformanceData.length > 0 
                                  ? (outletPerformanceData.reduce((sum, outlet) => sum + outlet.onTimeDelivery, 0) / outletPerformanceData.length).toFixed(1)
                                  : 0}%
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-800">Top Performing Outlets</h4>
                            {outletPerformanceData.slice(0, 3).map((outlet, index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{outlet.name}</p>
                                    <p className="text-sm text-gray-500">{outlet.location}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">{outlet.orders} orders</p>
                                  <p className="text-sm text-green-600">{outlet.onTimeDelivery}% on-time</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-gray-500">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No performance data available</p>
                            <p className="text-sm">Data will appear here once orders are processed</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-8">
                {loadingStorageLocations ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
                      <p className="text-gray-600">Loading storage location data...</p>
                    </div>
                  </div>
                ) : storageLocationData.length > 0 ? (
                  <div className="space-y-6">
                    {(() => {
                      // Separate used and empty storage locations
                      const usedStorage = storageLocationData.filter(storage => storage.totalItems > 0);
                      const emptyStorage = storageLocationData.filter(storage => storage.totalItems === 0);
                      
                      return (
                        <>
                          {/* Used Storage Locations */}
                          {usedStorage.length > 0 && (
                            <>
                              <div className="mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Used Storage Locations</h3>
                                <p className="text-gray-600">Storage areas currently holding inventory</p>
                              </div>
                              {usedStorage.map((storage, index) => {
                                const remainingCapacity = storage.capacityKg - storage.totalWeight;
                                return (
                                  <Card key={`used-${index}`} className="border-2 border-gray-100 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50">
                                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                                      <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                          <div className="p-3 bg-green-100 rounded-2xl">
                                            <Building2 className="h-6 w-6 text-green-600" />
                                          </div>
                                          <div>
                                            <h3 className="text-xl font-bold text-gray-900">{storage.name}</h3>
                                            <p className="text-gray-500">{storage.description || `${storage.locationType?.replace('_', ' ')} storage`}</p>
                                          </div>
                                          <Badge className={`px-3 py-1 rounded-xl ${
                                            storage.status === 'active' ? 'bg-green-500 text-white' : 
                                            storage.status === 'maintenance' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                                          }`}>
                                            {storage.status?.toUpperCase()}
                                          </Badge>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                          <div className="bg-blue-50 p-4 rounded-2xl">
                                            <p className="text-sm font-semibold text-blue-600">Total Items</p>
                                            <p className="text-2xl font-bold text-blue-900">{storage.totalItems}</p>
                                          </div>
                                          <div className="bg-green-50 p-4 rounded-2xl">
                                            <p className="text-sm font-semibold text-green-600">Used Weight</p>
                                            <p className="text-xl font-bold text-green-900">{storage.totalWeight}kg</p>
                                          </div>
                                          <div className="bg-purple-50 p-4 rounded-2xl">
                                            <p className="text-sm font-semibold text-purple-600">Remaining</p>
                                            <p className="text-lg font-bold text-purple-900">{remainingCapacity.toFixed(1)}kg</p>
                                          </div>
                                          <div className="bg-orange-50 p-4 rounded-2xl">
                                            <p className="text-sm font-semibold text-orange-600">Utilization</p>
                                            <p className="text-xl font-bold text-orange-900">{storage.utilizationPercent}%</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </>
                          )}

                          {/* Empty Storage Locations */}
                          {emptyStorage.length > 0 && (
                            <>
                              <div className="mb-6 mt-8">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Available Storage Locations</h3>
                                <p className="text-gray-600">Storage areas ready for new inventory</p>
                              </div>
                              {emptyStorage.map((storage, index) => (
                                <Card key={`empty-${index}`} className="border-2 border-gray-100 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50">
                                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                                    <div className="flex-1 space-y-4">
                                      <div className="flex items-center gap-4">
                                        <div className="p-3 bg-gray-100 rounded-2xl">
                                          <Building2 className="h-6 w-6 text-gray-600" />
                                        </div>
                                        <div>
                                          <h3 className="text-xl font-bold text-gray-900">{storage.name}</h3>
                                          <p className="text-gray-500">{storage.description || `${storage.locationType?.replace('_', ' ')} storage`}</p>
                                        </div>
                                        <Badge className={`px-3 py-1 rounded-xl ${
                                          storage.status === 'active' ? 'bg-green-500 text-white' : 
                                          storage.status === 'maintenance' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                                        }`}>
                                          {storage.status?.toUpperCase()}
                                        </Badge>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 p-4 rounded-2xl">
                                          <p className="text-sm font-semibold text-gray-600">Available Capacity</p>
                                          <p className="text-2xl font-bold text-gray-900">{storage.capacityKg}kg</p>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-2xl">
                                          <p className="text-sm font-semibold text-blue-600">Status</p>
                                          <p className="text-xl font-bold text-blue-900">Ready for Use</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No storage location data available</p>
                      <p className="text-sm">Data will appear here once storage locations are configured and inventory is processed</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="farmers" className="space-y-8">
                {loadingFarmers ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-green-600" />
                      <p className="text-gray-600">Loading farmer performance data...</p>
                    </div>
                  </div>
                ) : farmerPerformanceData.length > 0 ? (
                  <div className="space-y-6">
                    {farmerPerformanceData.map((farmer, index) => (
                      <Card key={index} className="border-2 border-gray-100 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-green-100 rounded-2xl">
                                <Users className="h-6 w-6 text-green-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">{farmer.name}</h3>
                                <p className="text-gray-500 flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  {farmer.location}
                                </p>
                              </div>
                              <Badge className={`px-3 py-1 rounded-xl ${
                                farmer.reliability === 'excellent' ? 'bg-green-500 text-white' : 
                                farmer.reliability === 'good' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                              }`}>
                                {farmer.reliability.toUpperCase()}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              <div className="bg-blue-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-blue-600">Deliveries</p>
                                <p className="text-2xl font-bold text-blue-900">{farmer.deliveries}</p>
                              </div>
                              <div className="bg-green-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-green-600">Total Weight</p>
                                <p className="text-2xl font-bold text-green-900">{farmer.totalWeight}kg</p>
                              </div>
                              <div className="bg-purple-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-purple-600">Total Value</p>
                                <p className="text-xl font-bold text-purple-900">{formatKES(farmer.totalValue)}</p>
                              </div>
                              <div className="bg-orange-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-orange-600">Avg Size</p>
                                <p className="text-2xl font-bold text-orange-900">{farmer.avgSize}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-3xl font-bold text-gray-900">★ {farmer.rating}</div>
                            <div className="text-sm text-gray-500">Rating</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No farmer data available</p>
                      <p className="text-sm">Data will appear here once farmers and warehouse entries are available</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="outlets" className="space-y-8">
                {loadingOutlets ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
                      <p className="text-gray-600">Loading outlet performance data...</p>
                    </div>
                  </div>
                ) : outletPerformanceData.length > 0 ? (
                  <div className="space-y-6">
                    {outletPerformanceData.map((outlet, index) => (
                      <Card key={index} className="border-2 border-gray-100 rounded-3xl p-8 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-100 rounded-2xl">
                                <MapPin className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">{outlet.name}</h3>
                                <p className="text-gray-500">{outlet.location}</p>
                              </div>
                              <Badge className={`px-3 py-1 rounded-xl ${
                                outlet.onTimeDelivery >= 95 ? 'bg-green-500 text-white' : 
                                outlet.onTimeDelivery >= 90 ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                              }`}>
                                {outlet.onTimeDelivery}% ON TIME
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              <div className="bg-blue-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-blue-600">Orders</p>
                                <p className="text-2xl font-bold text-blue-900">{outlet.orders}</p>
                              </div>
                              <div className="bg-green-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-green-600">Total Weight</p>
                                <p className="text-xl font-bold text-green-900">{outlet.totalWeight}kg</p>
                              </div>
                              <div className="bg-purple-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-purple-600">Total Value</p>
                                <p className="text-lg font-bold text-purple-900">{formatKES(outlet.totalValue)}</p>
                              </div>
                              <div className="bg-orange-50 p-4 rounded-2xl">
                                <p className="text-sm font-semibold text-orange-600">Avg Order Size</p>
                                <p className="text-xl font-bold text-orange-900">{outlet.avgOrderSize}kg</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No outlet data available</p>
                      <p className="text-sm">Data will appear here once outlets and orders are available</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}