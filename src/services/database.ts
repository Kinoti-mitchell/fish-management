import { supabase, handleSupabaseError, withRetry } from '../lib/supabaseClient';
import { 
  Fish, WarehouseEntry, ProcessingRecord, OutletOrder, 
  DispatchRecord, OutletReceiving, Farmer, ReportData 
} from '../types';

// Profile Management
export const profileService = {
  async getProfile(userId: string) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching user profile'));
    }
  },

  async createProfile(profileData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .insert([profileData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating user profile'));
    }
  },

  async updateProfile(userId: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating user profile'));
    }
  },

  async updateLastLogin(userId: string) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating last login'));
    }
  },

  async getAllProfiles() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching all profiles'));
    }
  }
};

// User Management
export const userService = {
  async getUsers() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching users'));
    }
  },

  async createUser(userData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating user'));
    }
  },

  async updateUser(id: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('users')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating user'));
    }
  },

  async deleteUser(id: string) {
    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('users')
          .delete()
          .eq('id', id);
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'deleting user'));
    }
  },

  async getAuditLogs(limit = 100) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching audit logs'));
    }
  }
};

// Fish Inventory Management (Updated for Sorting Workflow)
export const fishService = {
  async getFishInventory() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('sorting_results')
          .select(`
            *,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              processing_record:processing_records(
                id,
                processing_date,
                warehouse_entry:warehouse_entries(
                  id,
                  farmer_id,
                  farmers(name, phone, location)
                )
              )
            )
          `)
          .eq('sorting_batch.status', 'completed')
          .order('created_at', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching fish inventory'));
    }
  },

  // New method to get inventory from sorting batches
  async getInventoryFromSorting() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_inventory_summary_with_sorting');
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory from sorting'));
    }
  },

  // New method to add stock from sorting batch
  async addStockFromSorting(sortingBatchId: string) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('add_stock_from_sorting', {
          p_sorting_batch_id: sortingBatchId
        });
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'adding stock from sorting batch'));
    }
  },

  // New method to get sorting batches ready for inventory
  async getSortingBatchesForInventory() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_sorting_batches_for_inventory');
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching sorting batches for inventory'));
    }
  },

  // New method to validate sorting batch for inventory
  async validateSortingBatchForInventory(sortingBatchId: string) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('validate_sorting_batch_for_inventory', {
          p_sorting_batch_id: sortingBatchId
        });
      });
      if (error) throw error;
      return data?.[0] || { is_valid: false, message: 'Validation failed', batch_info: {} };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'validating sorting batch for inventory'));
    }
  },

  async createFish(fishData: any) {
    try {
      // Note: Fish should be added through the sorting system, not directly
      console.warn("Direct fish addition is deprecated. Use sorting workflow instead.");
      throw new Error("Direct fish addition is not supported. Use the sorting workflow to add fish to inventory.");
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating fish record'));
    }
  },

  async updateFish(id: string, updates: any) {
    try {
      // Note: Fish updates should be done through the sorting system
      console.warn("Direct fish updates are deprecated. Use sorting workflow instead.");
      throw new Error("Direct fish updates are not supported. Use the sorting workflow to manage fish inventory.");
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating fish record'));
    }
  },

  async deleteFish(id: string) {
    try {
      // Note: Fish deletion should be done through the sorting system
      console.warn("Direct fish deletion is deprecated. Use sorting workflow instead.");
      throw new Error("Direct fish deletion is not supported. Use the sorting workflow to manage fish inventory.");
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'deleting fish record'));
    }
  }
};

// Warehouse Management
export const warehouseService = {
  async getWarehouseEntries() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('warehouse_entries')
          .select(`
            *,
            farmer:farmers(name, phone, location),
            received_by_user:users!warehouse_entries_received_by_fkey(first_name, last_name)
          `)
          .order('entry_date', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching warehouse entries'));
    }
  },

  async createWarehouseEntry(entryData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('warehouse_entries')
          .insert([entryData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating warehouse entry'));
    }
  },

  async updateWarehouseEntry(id: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('warehouse_entries')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating warehouse entry'));
    }
  }
};

// Processing Management
export const processingService = {
  async getProcessingRecords() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('processing_records')
          .select(`
            *,
            warehouse_entry:warehouse_entries(entry_date, total_weight, farmer:farmers(name)),
            processed_by_user:users!processing_records_processed_by_fkey(first_name, last_name)
          `)
          .order('processing_date', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching processing records'));
    }
  },

  async createProcessingRecord(recordData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('processing_records')
          .insert([recordData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating processing record'));
    }
  }
};

// Outlet Management
export const outletService = {
  async getOutlets() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlets')
          .select('*')
          .order('created_at', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching outlets'));
    }
  },

  async createOutlet(outletData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlets')
          .insert([outletData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating outlet'));
    }
  },

  async updateOutlet(id: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlets')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating outlet'));
    }
  }
};

// Order Management
export const orderService = {
  async getOutletOrders() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select(`
            *,
            outlet:outlets(name, location, phone, manager_name, status)
          `)
          .order('order_date', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching outlet orders'));
    }
  },

  async createOutletOrder(orderData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .insert([orderData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating outlet order'));
    }
  },

  async updateOutletOrder(id: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating outlet order'));
    }
  }
};

// Dispatch Management
export const dispatchService = {
  async getDispatchRecords() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('dispatch_records')
          .select(`
            *,
            outlet_order:outlet_orders(outlet:outlets(name, location)),
            dispatched_by_user:users!dispatch_records_dispatched_by_fkey(first_name, last_name)
          `)
          .order('dispatch_date', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching dispatch records'));
    }
  },

  async createDispatchRecord(dispatchData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('dispatch_records')
          .insert([dispatchData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating dispatch record'));
    }
  }
};

// Farmer Management
export const farmerService = {
  async getFarmers() {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('farmers')
          .select('*')
          .order('created_at', { ascending: false });
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching farmers'));
    }
  },

  async createFarmer(farmerData: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('farmers')
          .insert([farmerData])
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating farmer'));
    }
  },

  async updateFarmer(id: string, updates: any) {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('farmers')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating farmer'));
    }
  }
};

// Dashboard Statistics
export const dashboardService = {
  async getDashboardStats() {
    try {
      // Fetch warehouse entries count
      const { count: warehouseEntries } = await supabase
        .from('warehouse_entries')
        .select('*', { count: 'exact', head: true });

      // Fetch processing records count
      const { count: processingQueue } = await supabase
        .from('processing_records')
        .select('*', { count: 'exact', head: true });

      // Fetch ready for dispatch count
      const { data: readyForDispatchData } = await supabase
        .from('processing_records')
        .select('ready_for_dispatch_count')
        .not('ready_for_dispatch_count', 'is', null);
      
      const readyForDispatch = readyForDispatchData?.reduce((sum, record) => 
        sum + (record.ready_for_dispatch_count || 0), 0) || 0;

      // Fetch total stock from fish_inventory
      const { data: inventoryData } = await supabase
        .from('fish_inventory')
        .select('weight');
      
      const totalStock = inventoryData?.reduce((sum, record) => 
        sum + (record.weight || 0), 0) || 0;

      // Fetch outlet orders count
      const { count: outletOrders } = await supabase
        .from('outlet_orders')
        .select('*', { count: 'exact', head: true });

      // Fetch pending dispatches count
      const { count: pendingDispatches } = await supabase
        .from('dispatch_records')
        .select('*', { count: 'exact', head: true })
        .in('status', ['scheduled', 'pending']);

      // Fetch total weight from warehouse entries
      const { data: weightData } = await supabase
        .from('warehouse_entries')
        .select('total_weight');
      
      const totalWeight = weightData?.reduce((sum, record) => 
        sum + (record.total_weight || 0), 0) || 0;

      // Fetch average temperature from warehouse entries
      const { data: tempData } = await supabase
        .from('warehouse_entries')
        .select('temperature')
        .not('temperature', 'is', null);
      
      console.log('Temperature data found:', tempData?.length || 0, 'records');
      
      const avgTemperature = tempData && tempData.length > 0 
        ? tempData.reduce((sum, record) => sum + (record.temperature || 0), 0) / tempData.length
        : 22.0; // Default temperature for fish storage

      // Calculate average fish size (weight per piece)
      const avgFishSize = totalStock > 0 ? totalWeight / totalStock : 0.5; // Default 0.5kg per fish

      return {
        warehouseEntries: warehouseEntries || 0,
        processingQueue: processingQueue || 0,
        readyForDispatch: readyForDispatch,
        totalStock: totalStock,
        outletOrders: outletOrders || 0,
        pendingDispatches: pendingDispatches || 0,
        totalWeight: totalWeight,
        avgTemperature: Number(avgTemperature.toFixed(2)),
        avgFishSize: Number(avgFishSize.toFixed(2))
      };
    } catch (error) {
      console.error('Dashboard service error:', error);
      // Return default stats even if there's an error
      return {
        warehouseEntries: 0,
        processingQueue: 0,
        readyForDispatch: 0,
        totalStock: 0,
        outletOrders: 0,
        pendingDispatches: 0,
        totalWeight: 0,
        avgTemperature: 22.0, // Default temperature for fish storage
        avgFishSize: 0.5 // Default fish size in kg
      };
    }
  },

  async getEnhancedDashboardStats() {
    try {
      // Fetch comprehensive statistics in parallel
      const [
        warehouseStats,
        processingStats,
        inventoryStats,
        orderStats,
        dispatchStats,
        farmerStats,
        outletStats,
        recentActivity
      ] = await Promise.all([
        this.getWarehouseStats(),
        this.getProcessingStats(),
        this.getInventoryStats(),
        this.getOrderStats(),
        this.getDispatchStats(),
        this.getFarmerStats(),
        this.getOutletStats(),
        this.getRecentActivity()
      ]);

      return {
        ...warehouseStats,
        ...processingStats,
        ...inventoryStats,
        ...orderStats,
        ...dispatchStats,
        ...farmerStats,
        ...outletStats,
        recentActivity
      };
    } catch (error) {
      console.error('Enhanced dashboard service error:', error);
      throw new Error(handleSupabaseError(error, 'fetching enhanced dashboard stats'));
    }
  },

  async getWarehouseStats() {
    try {
      const { data: entries } = await supabase
        .from('warehouse_entries')
        .select('total_weight, temperature, entry_date')
        .order('entry_date', { ascending: false });

      console.log('Warehouse entries fetched:', entries?.length || 0, 'records');
      
      const totalWeight = entries?.reduce((sum, entry) => sum + (entry.total_weight || 0), 0) || 0;
      
      // Only calculate temperature from entries that have temperature data
      const entriesWithTemp = entries?.filter(entry => entry.temperature !== null && entry.temperature !== undefined) || [];
      console.log('Entries with temperature data:', entriesWithTemp.length);
      
      const avgTemperature = entriesWithTemp.length > 0 
        ? entriesWithTemp.reduce((sum, entry) => sum + entry.temperature, 0) / entriesWithTemp.length
        : 22.0; // Default temperature for fish storage

      // Get entries from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentEntries = entries?.filter(entry => 
        new Date(entry.entry_date) >= weekAgo
      ) || [];

      return {
        totalWarehouseEntries: entries?.length || 0,
        totalWeight,
        avgTemperature: Number(avgTemperature.toFixed(2)),
        recentEntriesCount: recentEntries.length,
        recentWeight: recentEntries.reduce((sum, entry) => sum + (entry.total_weight || 0), 0)
      };
    } catch (error) {
      console.error('Warehouse stats error:', error);
      return {
        totalWarehouseEntries: 0,
        totalWeight: 0,
        avgTemperature: 22.0, // Default temperature for fish storage
        recentEntriesCount: 0,
        recentWeight: 0
      };
    }
  },

  async getProcessingStats() {
    try {
      const { data: processing } = await supabase
        .from('processing_records')
        .select('ready_for_dispatch_count, processing_date, post_processing_weight')
        .order('processing_date', { ascending: false });

      // Focus on weight instead of piece count
      const totalReadyForDispatchWeight = processing?.reduce((sum, record) => 
        sum + (record.post_processing_weight || 0), 0) || 0;
      
      const totalProcessedWeight = processing?.reduce((sum, record) => 
        sum + (record.post_processing_weight || 0), 0) || 0;

      // Get processing from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentProcessing = processing?.filter(record => 
        new Date(record.processing_date) >= weekAgo
      ) || [];

      return {
        totalProcessingRecords: processing?.length || 0,
        totalReadyForDispatch: Math.round(totalReadyForDispatchWeight), // Return weight instead of pieces
        totalProcessedWeight,
        recentProcessingCount: recentProcessing.length,
        recentProcessedWeight: recentProcessing.reduce((sum, record) => 
          sum + (record.post_processing_weight || 0), 0)
      };
    } catch (error) {
      console.error('Processing stats error:', error);
      return {
        totalProcessingRecords: 0,
        totalReadyForDispatch: 0,
        totalProcessedWeight: 0,
        recentProcessingCount: 0,
        recentProcessedWeight: 0
      };
    }
  },

  async getInventoryStats() {
    try {
      console.log('Fetching inventory stats from sorting_results table (same as inventory components)...');
      const { data: inventory, error } = await supabase
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
            created_at
          )
        `)
        .eq('sorting_batch.status', 'completed')
        .not('storage_location_id', 'is', null);

      if (error) {
        console.error('Error fetching inventory:', error);
        throw error;
      }

      console.log('Inventory data fetched from sorting_results:', inventory?.length || 0, 'records');
      console.log('Sample inventory record:', inventory?.[0]);

      const totalInventoryPieces = inventory?.reduce((sum, item) => sum + (item.total_pieces || 0), 0) || 0;
      const totalInventoryWeight = inventory?.reduce((sum, item) => sum + (item.total_weight_grams || 0), 0) / 1000 || 0; // Convert grams to kg
      const totalInventoryItems = inventory?.length || 0;
      const avgFishSize = totalInventoryPieces > 0 ? totalInventoryWeight / totalInventoryPieces : 0.5; // Default 0.5kg per fish

      console.log('Inventory stats calculated:', {
        totalInventoryWeight,
        totalInventoryPieces,
        totalInventoryItems,
        avgFishSize
      });

      // Get inventory by size class (grade distribution) - using weights instead of pieces
      const gradeDistribution = inventory?.reduce((acc, item) => {
        const size = `Size ${item.size_class}`;
        const weightKg = (item.total_weight_grams || 0) / 1000;
        acc[size] = (acc[size] || 0) + weightKg;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalInventoryWeight,
        totalInventoryItems: Math.round(totalInventoryWeight), // Return weight as items count
        avgFishSize: Number(avgFishSize.toFixed(2)),
        gradeDistribution
      };
    } catch (error) {
      console.error('Inventory stats error:', error);
      return {
        totalInventoryWeight: 0,
        totalInventoryItems: 0,
        avgFishSize: 0.5, // Default 0.5kg per fish
        gradeDistribution: {}
      };
    }
  },

  async getOrderStats() {
    try {
      // Use the same logic as OrderManagement component
      const { data: orders } = await supabase
        .from('outlet_orders')
        .select('total_value, status, order_date, requested_quantity')
        .order('order_date', { ascending: false });

      const totalOrderValue = orders?.reduce((sum, order) => sum + (order.total_value || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const totalQuantity = orders?.reduce((sum, order) => sum + (order.requested_quantity || 0), 0) || 0;

      // Use exact same logic as OrderManagement component for status counts
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const confirmedOrders = orders?.filter(o => o.status === 'confirmed').length || 0;
      const dispatchedOrders = orders?.filter(o => o.status === 'dispatched').length || 0;

      // Get orders by status (same as OrderManagement component)
      const statusDistribution = {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        dispatched: dispatchedOrders
      };

      // Get orders from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentOrders = orders?.filter(order => 
        new Date(order.order_date) >= weekAgo
      ) || [];

      console.log('Order stats calculated (same as OrderManagement component):', {
        totalOrders,
        pendingOrders,
        confirmedOrders,
        dispatchedOrders,
        totalOrderValue,
        totalQuantity
      });

      return {
        totalOrders,
        totalOrderValue,
        statusDistribution,
        recentOrdersCount: recentOrders.length,
        recentOrderValue: recentOrders.reduce((sum, order) => sum + (order.total_value || 0), 0)
      };
    } catch (error) {
      console.error('Order stats error:', error);
      return {
        totalOrders: 0,
        totalOrderValue: 0,
        statusDistribution: {},
        recentOrdersCount: 0,
        recentOrderValue: 0
      };
    }
  },

  async getDispatchStats() {
    try {
      // Use the same logic as DispatchManagement component - get confirmed orders ready for dispatch
      const { data: confirmedOrders } = await supabase
        .from('outlet_orders')
        .select('id, status, total_value, order_date')
        .eq('status', 'confirmed')
        .order('order_date', { ascending: false });

      // Also get dispatched orders for total count
      const { data: dispatchedOrders } = await supabase
        .from('outlet_orders')
        .select('id, status, total_value, dispatch_date')
        .eq('status', 'dispatched')
        .order('dispatch_date', { ascending: false });

      // Get dispatch records for weight calculation
      const { data: dispatchRecords } = await supabase
        .from('dispatch_records')
        .select('total_weight, status')
        .order('dispatch_date', { ascending: false });

      const totalDispatches = (dispatchedOrders?.length || 0) + (dispatchRecords?.length || 0);
      const totalDispatchedWeight = dispatchRecords?.reduce((sum, dispatch) => 
        sum + (dispatch.total_weight || 0), 0) || 0;

      // Pending dispatches = confirmed orders ready for dispatch (same as DispatchManagement component)
      const pendingDispatchesCount = confirmedOrders?.length || 0;

      console.log('Dispatch stats calculated:', {
        confirmedOrders: confirmedOrders?.length || 0,
        dispatchedOrders: dispatchedOrders?.length || 0,
        dispatchRecords: dispatchRecords?.length || 0,
        pendingDispatchesCount,
        totalDispatchedWeight
      });

      return {
        totalDispatches,
        totalDispatchedWeight,
        pendingDispatchesCount
      };
    } catch (error) {
      console.error('Dispatch stats error:', error);
      return {
        totalDispatches: 0,
        totalDispatchedWeight: 0,
        pendingDispatchesCount: 0
      };
    }
  },

  async getFarmerStats() {
    try {
      const { data: farmers } = await supabase
        .from('farmers')
        .select('id, name, location');

      const { data: farmerEntries } = await supabase
        .from('warehouse_entries')
        .select('farmer_id, total_weight, entry_date')
        .order('entry_date', { ascending: false });

      const totalFarmers = farmers?.length || 0;
      const totalFarmerWeight = farmerEntries?.reduce((sum, entry) => 
        sum + (entry.total_weight || 0), 0) || 0;

      // Get top performing farmers
      const farmerPerformance = farmerEntries?.reduce((acc, entry) => {
        const farmerId = entry.farmer_id;
        if (!acc[farmerId]) {
          acc[farmerId] = { weight: 0, entries: 0 };
        }
        acc[farmerId].weight += entry.total_weight || 0;
        acc[farmerId].entries += 1;
        return acc;
      }, {} as Record<string, { weight: number; entries: number }>) || {};

      return {
        totalFarmers,
        totalFarmerWeight,
        farmerPerformance
      };
    } catch (error) {
      console.error('Farmer stats error:', error);
      return {
        totalFarmers: 0,
        totalFarmerWeight: 0,
        farmerPerformance: {}
      };
    }
  },

  async getOutletStats() {
    try {
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name, location, status');

      const { data: outletOrders } = await supabase
        .from('outlet_orders')
        .select('outlet_id, total_value, order_date')
        .order('order_date', { ascending: false });

      const totalOutlets = outlets?.length || 0;
      const totalOutletValue = outletOrders?.reduce((sum, order) => 
        sum + (order.total_value || 0), 0) || 0;

      // Get active outlets
      const activeOutlets = outlets?.filter(outlet => outlet.status === 'active') || [];

      return {
        totalOutlets,
        totalOutletValue,
        activeOutletsCount: activeOutlets.length
      };
    } catch (error) {
      console.error('Outlet stats error:', error);
      return {
        totalOutlets: 0,
        totalOutletValue: 0,
        activeOutletsCount: 0
      };
    }
  },

  async getRecentActivity() {
    try {
      // Fetch recent warehouse entries
      const { data: recentEntries } = await supabase
        .from('warehouse_entries')
        .select('id, entry_date, total_weight, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent processing records
      const { data: recentProcessing } = await supabase
        .from('processing_records')
        .select('id, processing_date, ready_for_dispatch_count, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent outlet orders
      const { data: recentOrders } = await supabase
        .from('outlet_orders')
        .select('id, order_date, status, total_value, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Combine and format activity data
      const activities = [];
      
      if (recentEntries) {
        recentEntries.forEach(entry => {
          activities.push({
            id: entry.id,
            type: 'entry',
            action: `New warehouse entry: ${entry.total_weight}kg`,
            details: `Entry date: ${entry.entry_date}`,
            created_at: entry.created_at
          });
        });
      }

      if (recentProcessing) {
        recentProcessing.forEach(processing => {
          activities.push({
            id: processing.id,
            type: 'processing',
            action: `Processing completed: ${processing.ready_for_dispatch_count} fish ready`,
            details: `Processing date: ${processing.processing_date}`,
            created_at: processing.created_at
          });
        });
      }

      if (recentOrders) {
        recentOrders.forEach(order => {
          activities.push({
            id: order.id,
            type: 'order',
            action: `New outlet order: KES ${order.total_value}`,
            details: `Status: ${order.status}`,
            created_at: order.created_at
          });
        });
      }

      // Sort by creation date and return top 15
      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);

    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }
};

// Reports Service - Legacy (replaced by dedicated reportsService)
export const reportsService = {
  async generateReport(reportType: string, dateRange: { start: string; end: string }) {
    try {
      // Implementation for generating various reports
      // This would include complex queries and data aggregation
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select('*')
          .gte('order_date', dateRange.start)
          .lte('order_date', dateRange.end);
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'generating report'));
    }
  }
};
