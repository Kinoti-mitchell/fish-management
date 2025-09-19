import { supabase, withRetry, handleSupabaseError } from '../lib/supabaseClient';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  farmerId?: string;
  outletId?: string;
  size?: number;
  grade?: string;
}

export interface DailyProcessingData {
  date: string;
  weight: number;
  pieces: number;
  efficiency: number;
}

export interface SizeDistributionData {
  size: number;
  quantity: number;
  weight: number;
  percentage: number;
}

export interface GradeDistributionData {
  grade: string;
  quantity: number;
  percentage: number;
  color: string;
}

export interface FarmerPerformanceData {
  id: string;
  name: string;
  location: string;
  deliveries: number;
  totalWeight: number;
  totalValue: number;
  avgSize: number;
  rating: number;
  reliability: string;
  lastDelivery: string;
}

export interface OutletPerformanceData {
  id: string;
  name: string;
  location: string;
  orders: number;
  totalWeight: number;
  totalValue: number;
  avgOrderSize: number;
  onTimeDelivery: number;
  lastOrder: string;
}

export interface InventoryData {
  size: number;
  quantity: number;
  weight: number;
  grade: string;
  location: string;
  lastUpdated: string;
  status: string;
}

export interface StorageLocationData {
  id: string;
  name: string;
  description?: string;
  locationType: 'cold_storage' | 'freezer' | 'ambient' | 'processing_area';
  capacityKg: number;
  currentUsageKg: number;
  temperatureCelsius?: number;
  humidityPercent?: number;
  status: 'active' | 'maintenance' | 'inactive';
  utilizationPercent: number;
  inventoryItems: InventoryData[];
  totalItems: number;
  totalWeight: number;
  sizeDistribution: { [size: number]: number };
  gradeDistribution: { [grade: string]: number };
  lastUpdated: string;
}

export interface OverallStats {
  totalEntries: number;
  totalWeight: number;
  totalValue: number;
  totalProcessed: number;
  averageSize: number;
  processingEfficiency: number;
  wastePercentage: number;
  totalOrders: number;
  totalDispatches: number;
  onTimeDelivery: number;
}

class ReportsService {
  // Get overall statistics for the dashboard
  async getOverallStats(filters?: ReportFilters): Promise<OverallStats> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get warehouse entries stats with timeout
      const { data: entriesData, error: entriesError } = await withRetry(async () => {
        let query = supabase
          .from('warehouse_entries')
          .select('total_weight, total_pieces, total_value');
        
        if (startDate) query = query.gte('entry_date', startDate);
        if (endDate) query = query.lte('entry_date', endDate);
        
        return await query;
      }, 2, 1000); // 2 retries, 1 second delay

      if (entriesError) throw entriesError;

      // Get processing stats
      const { data: processingData, error: processingError } = await withRetry(async () => {
        let query = supabase
          .from('processing_records')
          .select('pre_processing_weight, post_processing_weight, processing_waste, processing_yield');
        
        if (startDate) query = query.gte('processing_date', startDate);
        if (endDate) query = query.lte('processing_date', endDate);
        
        return await query;
      });

      if (processingError) throw processingError;

      // Get orders stats
      const { data: ordersData, error: ordersError } = await withRetry(async () => {
        let query = supabase
          .from('outlet_orders')
          .select('total_value, status');
        
        if (startDate) query = query.gte('order_date', startDate);
        if (endDate) query = query.lte('order_date', endDate);
        
        return await query;
      });

      if (ordersError) throw ordersError;

      // Get dispatch stats
      const { data: dispatchData, error: dispatchError } = await withRetry(async () => {
        let query = supabase
          .from('dispatch_records')
          .select('status, dispatch_date');
        
        if (startDate) query = query.gte('dispatch_date', startDate);
        if (endDate) query = query.lte('dispatch_date', endDate);
        
        return await query;
      });

      if (dispatchError) throw dispatchError;

      // Calculate stats
      const totalEntries = entriesData?.length || 0;
      const totalWeight = entriesData?.reduce((sum, entry) => sum + (entry.total_weight || 0), 0) || 0;
      const totalValue = entriesData?.reduce((sum, entry) => sum + (entry.total_value || 0), 0) || 0;
      const totalProcessed = processingData?.length || 0;
      
      const avgProcessingYield = processingData?.length > 0 
        ? processingData.reduce((sum, p) => sum + (p.processing_yield || 0), 0) / processingData.length 
        : 0;
      
      const totalWaste = processingData?.reduce((sum, p) => sum + (p.processing_waste || 0), 0) || 0;
      const totalProcessedWeight = processingData?.reduce((sum, p) => sum + (p.pre_processing_weight || 0), 0) || 0;
      const wastePercentage = totalProcessedWeight > 0 ? (totalWaste / totalProcessedWeight) * 100 : 0;
      
      const totalOrders = ordersData?.length || 0;
      const totalDispatches = dispatchData?.length || 0;
      
      const onTimeDeliveries = dispatchData?.filter(d => d.status === 'delivered').length || 0;
      const onTimeDelivery = totalDispatches > 0 ? (onTimeDeliveries / totalDispatches) * 100 : 0;

      // Calculate average fish size from inventory
      const { data: inventoryData, error: inventoryError } = await withRetry(async () => {
        return await supabase
          .from('fish_inventory')
          .select('size, weight');
      });

      let averageSize = 0;
      if (!inventoryError && inventoryData && inventoryData.length > 0) {
        const totalSizeWeight = inventoryData.reduce((sum, item) => sum + (item.size * item.weight), 0);
        const totalWeightForSize = inventoryData.reduce((sum, item) => sum + item.weight, 0);
        averageSize = totalWeightForSize > 0 ? totalSizeWeight / totalWeightForSize : 0;
      }

      return {
        totalEntries,
        totalWeight: Number(totalWeight.toFixed(2)),
        totalValue: Number(totalValue.toFixed(2)),
        totalProcessed,
        averageSize: Number(averageSize.toFixed(2)),
        processingEfficiency: Number(avgProcessingYield.toFixed(2)),
        wastePercentage: Number(wastePercentage.toFixed(2)),
        totalOrders,
        totalDispatches,
        onTimeDelivery: Number(onTimeDelivery.toFixed(2))
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching overall stats'));
    }
  }

  // Get daily processing trend data
  async getDailyProcessingData(filters?: ReportFilters): Promise<DailyProcessingData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('processing_records')
          .select('processing_date, pre_processing_weight, post_processing_weight, processing_yield')
          .order('processing_date', { ascending: true });
        
        if (startDate) query = query.gte('processing_date', startDate);
        if (endDate) query = query.lte('processing_date', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Group by date and aggregate
      const groupedData = (data || []).reduce((acc: any, record: any) => {
        const date = record.processing_date;
        if (!acc[date]) {
          acc[date] = {
            date,
            weight: 0,
            pieces: 0,
            efficiency: 0,
            count: 0
          };
        }
        acc[date].weight += record.pre_processing_weight || 0;
        acc[date].pieces += 1; // Assuming each record represents a batch
        acc[date].efficiency += record.processing_yield || 0;
        acc[date].count += 1;
        return acc;
      }, {});

      return Object.values(groupedData).map((item: any) => ({
        date: item.date,
        weight: Number(item.weight.toFixed(2)),
        pieces: item.pieces,
        efficiency: Number((item.efficiency / item.count).toFixed(2))
      }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching daily processing data'));
    }
  }

  // Get size distribution data
  async getSizeDistributionData(filters?: ReportFilters): Promise<SizeDistributionData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get size distribution from processing records since fish_inventory is empty
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('processing_records')
          .select('size_distribution, post_processing_weight, processing_date')
          .not('size_distribution', 'is', null);
        
        if (startDate) query = query.gte('processing_date', startDate);
        if (endDate) query = query.lte('processing_date', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Process size distribution from JSON data
      const groupedData: Record<number, { size: number; quantity: number; weight: number }> = {};
      
      (data || []).forEach((record: any) => {
        const sizeDistribution = record.size_distribution;
        if (sizeDistribution && typeof sizeDistribution === 'object') {
          Object.entries(sizeDistribution).forEach(([sizeStr, quantity]: [string, any]) => {
            const size = parseInt(sizeStr);
            const weight = record.post_processing_weight || 0;
            
            if (!groupedData[size]) {
              groupedData[size] = {
                size,
                quantity: 0,
                weight: 0
              };
            }
            
            groupedData[size].quantity += quantity || 0;
            // Distribute weight proportionally based on quantity
            const totalQuantity = Object.values(sizeDistribution).reduce((sum: number, q: any) => sum + (q || 0), 0);
            if (totalQuantity > 0) {
              groupedData[size].weight += (weight * (quantity || 0)) / totalQuantity;
            }
          });
        }
      });

      const totalQuantity = Object.values(groupedData).reduce((sum, item) => sum + item.quantity, 0);

      return Object.values(groupedData)
        .sort((a, b) => a.size - b.size)
        .map((item) => ({
          size: item.size,
          quantity: item.quantity,
          weight: Number(item.weight.toFixed(2)),
          percentage: totalQuantity > 0 ? Number(((item.quantity / totalQuantity) * 100).toFixed(2)) : 0
        }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching size distribution data'));
    }
  }

  // Get grade distribution data
  async getGradeDistributionData(filters?: ReportFilters): Promise<GradeDistributionData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get grade distribution from processing records since fish_inventory is empty
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('processing_records')
          .select('grading_results, post_processing_weight, processing_date')
          .not('grading_results', 'is', null);
        
        if (startDate) query = query.gte('processing_date', startDate);
        if (endDate) query = query.lte('processing_date', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Process grade distribution from JSON data
      const groupedData: Record<string, { grade: string; quantity: number }> = {};
      
      (data || []).forEach((record: any) => {
        const gradingResults = record.grading_results;
        if (gradingResults && typeof gradingResults === 'object') {
          Object.entries(gradingResults).forEach(([grade, quantity]: [string, any]) => {
            if (!groupedData[grade]) {
              groupedData[grade] = {
                grade,
                quantity: 0
              };
            }
            groupedData[grade].quantity += quantity || 0;
          });
        }
      });

      const totalQuantity = Object.values(groupedData).reduce((sum, item) => sum + item.quantity, 0);
      const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

      return Object.values(groupedData)
        .sort((a, b) => a.grade.localeCompare(b.grade))
        .map((item, index) => ({
          grade: item.grade,
          quantity: item.quantity,
          percentage: totalQuantity > 0 ? Number(((item.quantity / totalQuantity) * 100).toFixed(2)) : 0,
          color: colors[index % colors.length]
        }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching grade distribution data'));
    }
  }

  // Get farmer performance data
  async getFarmerPerformanceData(filters?: ReportFilters): Promise<FarmerPerformanceData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get farmers with their warehouse entries
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('farmers')
          .select(`
            id,
            name,
            location,
            rating,
            reliability,
            warehouse_entries(
              entry_date,
              total_weight,
              total_value,
              total_pieces
            )
          `);
        
        return await query;
      });

      if (error) throw error;

      // Process and aggregate farmer data
      const farmerMap = new Map();
      
      (data || []).forEach((farmer: any) => {
        const farmerId = farmer.id;
        if (!farmerMap.has(farmerId)) {
          farmerMap.set(farmerId, {
            id: farmer.id,
            name: farmer.name,
            location: farmer.location,
            rating: farmer.rating || 0,
            reliability: farmer.reliability || 'fair',
            deliveries: 0,
            totalWeight: 0,
            totalValue: 0,
            totalPieces: 0,
            lastDelivery: null
          });
        }
        
        const farmerData = farmerMap.get(farmerId);
        
        // Process warehouse entries
        if (farmer.warehouse_entries && Array.isArray(farmer.warehouse_entries)) {
          farmer.warehouse_entries.forEach((entry: any) => {
            // Apply date filters
            if (startDate && entry.entry_date < startDate) return;
            if (endDate && entry.entry_date > endDate) return;
            
            farmerData.deliveries += 1;
            farmerData.totalWeight += entry.total_weight || 0;
            farmerData.totalValue += entry.total_value || 0;
            farmerData.totalPieces += entry.total_pieces || 0;
            
            if (!farmerData.lastDelivery || entry.entry_date > farmerData.lastDelivery) {
              farmerData.lastDelivery = entry.entry_date;
            }
          });
        }
      });

      return Array.from(farmerMap.values())
        .filter((farmer: any) => farmer.deliveries > 0) // Only show farmers with deliveries
        .map((farmer: any) => ({
          id: farmer.id,
          name: farmer.name,
          location: farmer.location,
          deliveries: farmer.deliveries,
          totalWeight: Number(farmer.totalWeight.toFixed(2)),
          totalValue: Number(farmer.totalValue.toFixed(2)),
          avgSize: farmer.totalPieces > 0 ? Number((farmer.totalWeight / farmer.totalPieces).toFixed(2)) : 0,
          rating: Number(farmer.rating.toFixed(1)),
          reliability: farmer.reliability,
          lastDelivery: farmer.lastDelivery
        }))
        .sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching farmer performance data'));
    }
  }

  // Get outlet performance data
  async getOutletPerformanceData(filters?: ReportFilters): Promise<OutletPerformanceData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get outlets with their orders
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('outlets')
          .select(`
            id,
            name,
            location,
            outlet_orders(
              order_date,
              total_value,
              requested_quantity,
              status,
              dispatch_date,
              completed_date
            )
          `);
        
        return await query;
      });

      if (error) throw error;

      // Process and aggregate outlet data
      const outletMap = new Map();
      
      (data || []).forEach((outlet: any) => {
        const outletId = outlet.id;
        if (!outletMap.has(outletId)) {
          outletMap.set(outletId, {
            id: outlet.id,
            name: outlet.name,
            location: outlet.location,
            orders: 0,
            totalWeight: 0,
            totalValue: 0,
            totalQuantity: 0,
            onTimeDeliveries: 0,
            totalDeliveries: 0,
            lastOrder: null
          });
        }
        
        const outletData = outletMap.get(outletId);
        
        // Process outlet orders
        if (outlet.outlet_orders && Array.isArray(outlet.outlet_orders)) {
          outlet.outlet_orders.forEach((order: any) => {
            // Apply date filters
            if (startDate && order.order_date < startDate) return;
            if (endDate && order.order_date > endDate) return;
            
            outletData.orders += 1;
            outletData.totalValue += order.total_value || 0;
            outletData.totalQuantity += order.requested_quantity || 0;
            
            if (!outletData.lastOrder || order.order_date > outletData.lastOrder) {
              outletData.lastOrder = order.order_date;
            }
            
            // Check if delivery was on time (assuming same day dispatch and completion is on time)
            if (order.dispatch_date && order.completed_date) {
              outletData.totalDeliveries += 1;
              const dispatchDate = new Date(order.dispatch_date);
              const completedDate = new Date(order.completed_date);
              const daysDiff = Math.abs(completedDate.getTime() - dispatchDate.getTime()) / (1000 * 60 * 60 * 24);
              
              if (daysDiff <= 1) { // On time if delivered within 1 day
                outletData.onTimeDeliveries += 1;
              }
            }
          });
        }
      });

      return Array.from(outletMap.values())
        .filter((outlet: any) => outlet.orders > 0) // Only show outlets with orders
        .map((outlet: any) => ({
          id: outlet.id,
          name: outlet.name,
          location: outlet.location,
          orders: outlet.orders,
          totalWeight: Number(outlet.totalQuantity.toFixed(2)), // Using quantity as weight proxy
          totalValue: Number(outlet.totalValue.toFixed(2)),
          avgOrderSize: outlet.orders > 0 ? Number((outlet.totalQuantity / outlet.orders).toFixed(2)) : 0,
          onTimeDelivery: outlet.totalDeliveries > 0 ? Number(((outlet.onTimeDeliveries / outlet.totalDeliveries) * 100).toFixed(2)) : 0,
          lastOrder: outlet.lastOrder
        }))
        .sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching outlet performance data'));
    }
  }

  // Get inventory data by storage location (same as inventory component)
  async getInventoryData(filters?: ReportFilters): Promise<InventoryData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get storage locations mapping
      const { data: storageLocations, error: storageError } = await withRetry(async () => {
        return await supabase
          .from('storage_locations')
          .select('id, name');
      });

      if (storageError) throw storageError;

      const storageMap = new Map<string, string>();
      storageLocations?.forEach((location: any) => {
        storageMap.set(location.id, location.name);
      });

      // Get sorting results (same as inventory component)
      const { data: sortingResults, error } = await withRetry(async () => {
        let query = supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            sorting_batch_id,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              created_at,
              processing_record:processing_records(
                id,
                processing_date,
                grading_results
              )
            )
          `)
          .eq('sorting_batch.status', 'completed')
          .not('storage_location_id', 'is', null);
        
        if (startDate) query = query.gte('sorting_batch.created_at', startDate);
        if (endDate) query = query.lte('sorting_batch.created_at', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Process inventory data from sorting results
      const inventoryMap = new Map<string, InventoryData>();
      
      (sortingResults || []).forEach((result: any) => {
        const size = result.size_class;
        const quantity = result.total_pieces || 0;
        const weightGrams = result.total_weight_grams || 0;
        const weightKg = weightGrams / 1000; // Convert grams to kg
        const storageLocationId = result.storage_location_id;
        const storageLocationName = storageMap.get(storageLocationId) || 'Unknown Location';
        const createdAt = result.sorting_batch?.created_at || new Date().toISOString();
        
        // Get grade from processing record
        const gradingResults = result.sorting_batch?.processing_record?.grading_results;
        const grade = gradingResults && typeof gradingResults === 'object' 
          ? Object.keys(gradingResults)[0] || 'B'
          : 'B';
        
        const key = `${storageLocationId}-${size}-${grade}`;
        
        if (!inventoryMap.has(key)) {
          inventoryMap.set(key, {
            size,
            quantity: 0,
            weight: 0,
            grade,
            location: storageLocationName,
            lastUpdated: createdAt,
            status: 'Available'
          });
        }
        
        const inventoryItem = inventoryMap.get(key)!;
        inventoryItem.quantity += quantity;
        inventoryItem.weight += weightKg;
        
        // Update last updated date if this record is newer
        if (createdAt > inventoryItem.lastUpdated) {
          inventoryItem.lastUpdated = createdAt;
        }
      });

      return Array.from(inventoryMap.values())
        .sort((a, b) => a.location.localeCompare(b.location) || a.size - b.size || a.grade.localeCompare(b.grade))
        .map(item => ({
          ...item,
          weight: Number(item.weight.toFixed(2))
        }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory data by storage location'));
    }
  }

  // Get storage location performance data (similar to outlet performance)
  async getStorageLocationPerformanceData(filters?: ReportFilters): Promise<any[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get all storage locations
      const { data: storageLocations, error: storageError } = await withRetry(async () => {
        return await supabase
          .from('storage_locations')
          .select('*')
          .order('name');
      });

      if (storageError) throw storageError;

      // Get inventory data for each storage location
      const { data: sortingResults, error } = await withRetry(async () => {
        let query = supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            sorting_batch_id,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              created_at,
              processing_record:processing_records(
                id,
                processing_date,
                grading_results
              )
            )
          `)
          .eq('sorting_batch.status', 'completed')
          .not('storage_location_id', 'is', null);
        
        if (startDate) query = query.gte('sorting_batch.created_at', startDate);
        if (endDate) query = query.lte('sorting_batch.created_at', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Process storage location data
      const storageLocationMap = new Map<string, any>();
      
      // Initialize all storage locations (including empty ones)
      (storageLocations || []).forEach((location: any) => {
        storageLocationMap.set(location.id, {
          id: location.id,
          name: location.name,
          description: location.description,
          locationType: location.location_type,
          capacityKg: Number(location.capacity_kg || 0),
          temperatureCelsius: location.temperature_celsius,
          humidityPercent: location.humidity_percent,
          status: location.status,
          totalItems: 0,
          totalWeight: 0,
          utilizationPercent: 0
        });
      });

      // Process inventory data and aggregate by storage location
      (sortingResults || []).forEach((result: any) => {
        const quantity = result.total_pieces || 0;
        const weightGrams = result.total_weight_grams || 0;
        const weightKg = weightGrams / 1000;
        const storageLocationId = result.storage_location_id;

        const storageLocation = storageLocationMap.get(storageLocationId);
        if (storageLocation) {
          storageLocation.totalItems += quantity;
          storageLocation.totalWeight += weightKg;
        }
      });

      // Calculate utilization percentages and finalize data
      const result = Array.from(storageLocationMap.values()).map(location => {
        location.utilizationPercent = location.capacityKg > 0 
          ? Number(((location.totalWeight / location.capacityKg) * 100).toFixed(1))
          : 0;
        
        location.totalWeight = Number(location.totalWeight.toFixed(2));
        
        return location;
      });

      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching storage location performance data'));
    }
  }

  // Get comprehensive storage location data with detailed information
  async getStorageLocationData(filters?: ReportFilters): Promise<StorageLocationData[]> {
    try {
      const { startDate, endDate } = filters || {};
      
      // Get all storage locations with full details
      const { data: storageLocations, error: storageError } = await withRetry(async () => {
        return await supabase
          .from('storage_locations')
          .select('*')
          .order('name');
      });

      if (storageError) throw storageError;

      // Get inventory data for each storage location
      const { data: sortingResults, error } = await withRetry(async () => {
        let query = supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              created_at,
              processing_record:processing_records(
                id,
                processing_date,
                grading_results
              )
            )
          `)
          .eq('sorting_batch.status', 'completed')
          .not('storage_location_id', 'is', null);
        
        if (startDate) query = query.gte('sorting_batch.created_at', startDate);
        if (endDate) query = query.lte('sorting_batch.created_at', endDate);
        
        return await query;
      });

      if (error) throw error;

      // Process storage location data
      const storageLocationMap = new Map<string, StorageLocationData>();
      
      // Initialize storage locations
      (storageLocations || []).forEach((location: any) => {
        storageLocationMap.set(location.id, {
          id: location.id,
          name: location.name,
          description: location.description,
          locationType: location.location_type,
          capacityKg: Number(location.capacity_kg || 0),
          currentUsageKg: 0,
          temperatureCelsius: location.temperature_celsius,
          humidityPercent: location.humidity_percent,
          status: location.status,
          utilizationPercent: 0,
          inventoryItems: [],
          totalItems: 0,
          totalWeight: 0,
          sizeDistribution: {},
          gradeDistribution: {},
          lastUpdated: location.updated_at || location.created_at
        });
      });

      // Process inventory data and aggregate by storage location
      (sortingResults || []).forEach((result: any) => {
        const size = result.size_class;
        const quantity = result.total_pieces || 0;
        const weightGrams = result.total_weight_grams || 0;
        const weightKg = weightGrams / 1000;
        const storageLocationId = result.storage_location_id;
        const createdAt = result.sorting_batch?.created_at || new Date().toISOString();
        
        // Get grade from processing record
        const gradingResults = result.sorting_batch?.processing_record?.grading_results;
        const grade = gradingResults && typeof gradingResults === 'object' 
          ? Object.keys(gradingResults)[0] || 'B'
          : 'B';

        const storageLocation = storageLocationMap.get(storageLocationId);
        if (storageLocation) {
          // Add inventory item
          storageLocation.inventoryItems.push({
            size,
            quantity,
            weight: Number(weightKg.toFixed(2)),
            grade,
            location: storageLocation.name,
            lastUpdated: createdAt,
            status: 'Available'
          });

          // Update totals
          storageLocation.totalItems += quantity;
          storageLocation.totalWeight += weightKg;
          storageLocation.currentUsageKg += weightKg;

          // Update distributions
          storageLocation.sizeDistribution[size] = (storageLocation.sizeDistribution[size] || 0) + quantity;
          storageLocation.gradeDistribution[grade] = (storageLocation.gradeDistribution[grade] || 0) + quantity;

          // Update last updated date
          if (createdAt > storageLocation.lastUpdated) {
            storageLocation.lastUpdated = createdAt;
          }
        }
      });

      // Calculate utilization percentages and finalize data
      const result = Array.from(storageLocationMap.values()).map(location => {
        location.utilizationPercent = location.capacityKg > 0 
          ? Number(((location.currentUsageKg / location.capacityKg) * 100).toFixed(1))
          : 0;
        
        location.totalWeight = Number(location.totalWeight.toFixed(2));
        location.currentUsageKg = Number(location.currentUsageKg.toFixed(2));
        
        // Sort inventory items
        location.inventoryItems.sort((a, b) => a.size - b.size || a.grade.localeCompare(b.grade));
        
        return location;
      });

      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching storage location data'));
    }
  }

  // Get estimated weight per fish based on size class
  private getEstimatedWeightPerFish(size: number): number {
    const weightMap: Record<number, number> = {
      0: 0.2,   // Small fish
      1: 0.3,
      2: 0.4,
      3: 0.5,
      4: 0.6,
      5: 0.7,
      6: 0.8,
      7: 0.9,
      8: 1.0,
      9: 1.1,
      10: 1.2   // Large fish
    };
    
    return weightMap[size] || 0.5; // Default to 0.5kg if size not found
  }

  // Export data to CSV
  async exportToCSV(reportType: string, data: any[], filename?: string): Promise<void> {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const reportsService = new ReportsService();
