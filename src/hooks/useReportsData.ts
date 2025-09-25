import { useState, useEffect, useCallback } from 'react';
import { 
  reportsService, 
  ReportFilters, 
  OverallStats, 
  DailyProcessingData, 
  SizeDistributionData, 
  GradeDistributionData, 
  FarmerPerformanceData, 
  OutletPerformanceData,
  InventoryData,
  StorageLocationData
} from '../services/reportsService';

export interface UseReportsDataReturn {
  // Data
  overallStats: OverallStats | null;
  dailyProcessingData: DailyProcessingData[];
  sizeDistributionData: SizeDistributionData[];
  gradeDistributionData: GradeDistributionData[];
  farmerPerformanceData: FarmerPerformanceData[];
  outletPerformanceData: OutletPerformanceData[];
  inventoryData: InventoryData[];
  storageLocationData: StorageLocationData[];
  
  // Loading states
  loading: boolean;
  loadingStats: boolean;
  loadingDaily: boolean;
  loadingSize: boolean;
  loadingGrade: boolean;
  loadingFarmers: boolean;
  loadingOutlets: boolean;
  loadingInventory: boolean;
  loadingStorageLocations: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  refreshData: (filters?: ReportFilters) => Promise<void>;
  refreshStats: (filters?: ReportFilters) => Promise<void>;
  refreshDaily: (filters?: ReportFilters) => Promise<void>;
  refreshSize: (filters?: ReportFilters) => Promise<void>;
  refreshGrade: (filters?: ReportFilters) => Promise<void>;
  refreshFarmers: (filters?: ReportFilters) => Promise<void>;
  refreshOutlets: (filters?: ReportFilters) => Promise<void>;
  refreshInventory: (filters?: ReportFilters) => Promise<void>;
  refreshStorageLocations: (filters?: ReportFilters) => Promise<void>;
  exportReport: (reportType: string, data: any[], filename?: string) => Promise<void>;
}

export function useReportsData(initialFilters?: ReportFilters): UseReportsDataReturn {
  // Data state
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [dailyProcessingData, setDailyProcessingData] = useState<DailyProcessingData[]>([]);
  const [sizeDistributionData, setSizeDistributionData] = useState<SizeDistributionData[]>([]);
  const [gradeDistributionData, setGradeDistributionData] = useState<GradeDistributionData[]>([]);
  const [farmerPerformanceData, setFarmerPerformanceData] = useState<FarmerPerformanceData[]>([]);
  const [outletPerformanceData, setOutletPerformanceData] = useState<OutletPerformanceData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [storageLocationData, setStorageLocationData] = useState<StorageLocationData[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingSize, setLoadingSize] = useState(false);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingStorageLocations, setLoadingStorageLocations] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Individual refresh functions
  const refreshStats = useCallback(async (filters?: ReportFilters) => {
    setLoadingStats(true);
    setError(null);
    try {
      const stats = await reportsService.getOverallStats(filters);
      setOverallStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch overall stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const refreshDaily = useCallback(async (filters?: ReportFilters) => {
    setLoadingDaily(true);
    setError(null);
    try {
      const data = await reportsService.getDailyProcessingData(filters);
      setDailyProcessingData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily processing data');
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  const refreshSize = useCallback(async (filters?: ReportFilters) => {
    setLoadingSize(true);
    setError(null);
    try {
      const data = await reportsService.getSizeDistributionData(filters);
      setSizeDistributionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch size distribution data');
    } finally {
      setLoadingSize(false);
    }
  }, []);

  const refreshGrade = useCallback(async (filters?: ReportFilters) => {
    setLoadingGrade(true);
    setError(null);
    try {
      const data = await reportsService.getGradeDistributionData(filters);
      setGradeDistributionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch grade distribution data');
    } finally {
      setLoadingGrade(false);
    }
  }, []);

  const refreshFarmers = useCallback(async (filters?: ReportFilters) => {
    setLoadingFarmers(true);
    setError(null);
    try {
      const data = await reportsService.getFarmerPerformanceData(filters);
      setFarmerPerformanceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch farmer performance data');
    } finally {
      setLoadingFarmers(false);
    }
  }, []);

  const refreshOutlets = useCallback(async (filters?: ReportFilters) => {
    setLoadingOutlets(true);
    setError(null);
    try {
      const data = await reportsService.getOutletPerformanceData(filters);
      setOutletPerformanceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch outlet performance data');
    } finally {
      setLoadingOutlets(false);
    }
  }, []);

  const refreshInventory = useCallback(async (filters?: ReportFilters) => {
    setLoadingInventory(true);
    setError(null);
    try {
      const data = await reportsService.getInventoryData(filters);
      setInventoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory data');
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const refreshStorageLocations = useCallback(async (filters?: ReportFilters) => {
    setLoadingStorageLocations(true);
    setError(null);
    try {
      const data = await reportsService.getStorageLocationPerformanceData(filters);
      setStorageLocationData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch storage location data');
    } finally {
      setLoadingStorageLocations(false);
    }
  }, []);

  // Refresh all data
  const refreshData = useCallback(async (filters?: ReportFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        refreshStats(filters),
        refreshDaily(filters),
        refreshSize(filters),
        refreshGrade(filters),
        refreshFarmers(filters),
        refreshOutlets(filters),
        refreshInventory(filters),
        refreshStorageLocations(filters)
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [refreshStats, refreshDaily, refreshSize, refreshGrade, refreshFarmers, refreshOutlets, refreshInventory, refreshStorageLocations]);

  // Export function
  const exportReport = useCallback(async (reportType: string, data: any[], filename?: string) => {
    try {
      await reportsService.exportToCSV(reportType, data, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
      throw err;
    }
  }, []);

  // Load initial data - fixed dependency issue
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        await Promise.all([
          refreshStats(initialFilters),
          refreshDaily(initialFilters),
          refreshSize(initialFilters),
          refreshGrade(initialFilters),
          refreshFarmers(initialFilters),
          refreshOutlets(initialFilters),
          refreshInventory(initialFilters),
          refreshStorageLocations(initialFilters)
        ]);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load initial data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array to run only once on mount

  return {
    // Data
    overallStats,
    dailyProcessingData,
    sizeDistributionData,
    gradeDistributionData,
    farmerPerformanceData,
    outletPerformanceData,
    inventoryData,
    storageLocationData,
    
    // Loading states
    loading,
    loadingStats,
    loadingDaily,
    loadingSize,
    loadingGrade,
    loadingFarmers,
    loadingOutlets,
    loadingInventory,
    loadingStorageLocations,
    
    // Error state
    error,
    
    // Actions
    refreshData,
    refreshStats,
    refreshDaily,
    refreshSize,
    refreshGrade,
    refreshFarmers,
    refreshOutlets,
    refreshInventory,
    refreshStorageLocations,
    exportReport
  };
}
