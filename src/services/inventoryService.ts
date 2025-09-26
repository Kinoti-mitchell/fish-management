/**
 * Inventory Service
 * 
 * Simple inventory management system focused on size-based tracking.
 * Tracks fish inventory by size (0-10) with weight information.
 */

import { supabase, handleSupabaseError, withRetry } from '../lib/supabaseClient';

// Types for inventory operations
export interface InventoryItem {
  id: string;
  size: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryEntry {
  id: string;
  size: number;
  quantity_change: number;
  entry_type: 'inbound' | 'order_dispatch' | 'adjustment' | 'transfer';
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface InventorySummary {
  size: number;
  quantity: number;
  total_weight_kg: number;
}

class InventoryService {
  /**
   * Get inventory organized by storage location first, then sizes within each storage
   */
  async getInventoryByStorage(): Promise<any[]> {
    try {
      console.log('🔍 Getting inventory by storage with capacity method (working approach)...');
      return await this.getInventoryByStorageWithCapacity();
    } catch (error) {
      console.warn('⚠️ Error in capacity method, falling back to legacy method:', error);
      try {
        return await this.getInventoryByStorageFallback();
      } catch (fallbackError) {
        console.warn('❌ Error in fallback method:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get inventory by storage with FIFO ordering - DISABLED (database function not available)
   */
  private async getInventoryByStorageWithFIFO(): Promise<any[]> {
    console.warn('⚠️ FIFO database function is not available, this method is disabled');
    throw new Error('FIFO_FUNCTION_NOT_AVAILABLE');
  }

  /**
   * Get inventory by storage with accurate capacity tracking
   */
  private async getInventoryByStorageWithCapacity(): Promise<any[]> {
    try {
      console.log('🔍 Getting all storage locations with capacity data...');
      
      // First, get all storage locations with their capacity information (including inactive)
      const { data: storageLocations, error: storageError } = await withRetry(async () => {
        return await supabase
          .from('storage_locations')
          .select('id, name, location_type, capacity_kg, current_usage_kg, status')
          .order('name');
      });

      if (storageError) throw storageError;

      console.log('📊 Storage locations from database:', storageLocations);

      // Get actual inventory data from sorting results
      const { data: sortingResults, error: resultsError } = await withRetry(async () => {
        return await supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            sorting_batch_id,
            transfer_source_storage_id,
            transfer_source_storage_name,
            transfer_id,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              created_at,
              processing_record:processing_records(
                id,
                processing_date,
                warehouse_entry:warehouse_entries(
                  id,
                  entry_date,
                  farmer_id,
                  farmers(name, phone, location)
                )
              )
            )
          `)
          .not('storage_location_id', 'is', null)
          .gt('total_weight_grams', 0) // Only items with weight > 0
          .order('created_at', { ascending: false });
      });

      if (resultsError) throw resultsError;

      // Filter for completed batches only
      const completedSortingResults = (sortingResults || []).filter((result: any) => 
        result.sorting_batch && result.sorting_batch.status === 'completed'
      );

      console.log('📦 Filtered sorting results (completed only):', completedSortingResults.length, 'out of', sortingResults?.length || 0);

      // Create storage map for quick lookup
      const storageMap = new Map();
      console.log('🗺️ Creating storage map from locations:', storageLocations);
      storageLocations?.forEach(loc => {
        console.log('📍 Adding storage location to map:', loc.id, loc.name);
        storageMap.set(loc.id, loc);
      });
      console.log('🗺️ Storage map created with', storageMap.size, 'locations');

      // Aggregate inventory by storage location and size
      const storageAggregation: Record<string, {
        storage_location_id: string;
        storage_location_name: string;
        storage_location_type: string;
        status: string; // Add status field
        capacity_kg: number;
        current_usage_kg: number;
        available_capacity_kg: number;
        utilization_percent: number;
        sizes: Record<number, {
          total_quantity: number;
          total_weight_kg: number;
          batch_count: number;
          contributing_batches: any[];
        }>;
      }> = {};

      // Initialize all storage locations (including empty ones)
      storageLocations?.forEach(location => {
        storageAggregation[location.id] = {
          storage_location_id: location.id,
          storage_location_name: location.name,
          storage_location_type: location.location_type,
          status: location.status || 'active', // Add status field
          capacity_kg: location.capacity_kg || 0,
          current_usage_kg: 0, // Will be calculated from actual inventory
          available_capacity_kg: location.capacity_kg || 0,
          utilization_percent: 0,
          sizes: {}
        };
      });

      // Process actual inventory data
      console.log('🔄 Processing sorting results:', completedSortingResults.length, 'results');
      completedSortingResults.forEach((result: any) => {
        const storageId = result.storage_location_id;
        const storage = storageMap.get(storageId);
        console.log('🔍 Processing result for storage:', storageId, 'found storage:', !!storage);
        
        if (!storage) {
          console.warn('⚠️ No storage found for ID:', storageId, 'available storage IDs:', Array.from(storageMap.keys()));
          return;
        }
        
        if (!storageAggregation[storageId]) {
          console.warn('⚠️ No storage aggregation found for ID:', storageId);
          return;
        }

        const size = result.size_class;
        const qty = result.total_pieces || 0;
        const weightKg = (result.total_weight_grams || 0) / 1000; // Convert grams to kg
        
        if (qty > 0) {
          if (!storageAggregation[storageId].sizes[size]) {
            storageAggregation[storageId].sizes[size] = {
              total_quantity: 0,
              total_weight_kg: 0,
              batch_count: 0,
              contributing_batches: []
            };
          }

          storageAggregation[storageId].sizes[size].total_quantity += qty;
          storageAggregation[storageId].sizes[size].total_weight_kg += weightKg;
          storageAggregation[storageId].sizes[size].batch_count += 1;

          // Add batch info with complete details including transfer information
          storageAggregation[storageId].sizes[size].contributing_batches.push({
            batch_id: result.sorting_batch_id,
            batch_number: result.sorting_batch?.batch_number || `BATCH-${result.sorting_batch_id?.slice(-8).toUpperCase()}`,
            quantity: qty,
            weight_kg: weightKg,
            storage_location_name: storage.name,
            farmer_name: result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown',
            processing_date: result.sorting_batch?.processing_record?.processing_date || 'Unknown',
            added_date: result.sorting_batch?.created_at || new Date().toISOString(),
            created_at: result.sorting_batch?.created_at || new Date().toISOString(),
            // Transfer tracking information
            is_transfer: !!result.transfer_id,
            transfer_id: result.transfer_id,
            transfer_source_storage_id: result.transfer_source_storage_id,
            transfer_source_storage_name: result.transfer_source_storage_name
          });
        }
      });

      // Calculate actual usage and capacity for each storage location
      Object.values(storageAggregation).forEach(storage => {
        let totalWeight = 0;
        Object.values(storage.sizes).forEach(sizeData => {
          totalWeight += sizeData.total_weight_kg;
        });
        
        storage.current_usage_kg = totalWeight;
        storage.available_capacity_kg = Math.max(0, storage.capacity_kg - totalWeight);
        storage.utilization_percent = storage.capacity_kg > 0 ? 
          Math.round((totalWeight / storage.capacity_kg) * 100 * 100) / 100 : 0;
      });

      // Convert to flat array format for storage-location-size combinations
      const result: any[] = [];
      Object.values(storageAggregation).forEach(storage => {
        if (Object.keys(storage.sizes).length === 0) {
          // Add empty storage location
            result.push({
              storage_location_id: storage.storage_location_id,
              storage_location_name: storage.storage_location_name,
              storage_location_type: storage.storage_location_type,
              storage_status: storage.status || 'active', // Add storage status
              capacity_kg: storage.capacity_kg,
              current_usage_kg: storage.current_usage_kg,
              available_capacity_kg: storage.available_capacity_kg,
              utilization_percent: storage.utilization_percent,
              size: null,
              total_quantity: 0,
              total_weight_kg: 0,
              batch_count: 0,
              contributing_batches: []
            });
        } else {
          // Add each size within the storage location
          Object.entries(storage.sizes).forEach(([sizeStr, sizeData]) => {
            result.push({
              storage_location_id: storage.storage_location_id,
              storage_location_name: storage.storage_location_name,
              storage_location_type: storage.storage_location_type,
              storage_status: storage.status || 'active', // Add storage status
              capacity_kg: storage.capacity_kg,
              current_usage_kg: storage.current_usage_kg,
              available_capacity_kg: storage.available_capacity_kg,
              utilization_percent: storage.utilization_percent,
              size: parseInt(sizeStr),
              total_quantity: sizeData.total_quantity,
              total_weight_kg: sizeData.total_weight_kg,
              batch_count: sizeData.batch_count,
              contributing_batches: sizeData.contributing_batches
            });
          });
        }
      });

      console.log('📦 Final inventory result with capacity:', result);
      console.log('📊 Storage aggregation with capacity:', storageAggregation);
      
      // Debug Size 9 specifically
      const size9Results = result.filter(item => item.size === 9);
      console.log('🔍 Size 9 in final inventory result:', size9Results);
      console.log('🔍 Size 9 by storage:', size9Results.map(item => ({
        storage: item.storage_location_name,
        weight: item.total_weight_kg,
        hasBatches: item.contributing_batches && item.contributing_batches.length > 0
      })));

      return result.sort((a, b) => {
        // Sort by storage location name, then by size (null sizes first for empty storages)
        if (a.storage_location_name !== b.storage_location_name) {
          return a.storage_location_name.localeCompare(b.storage_location_name);
        }
        if (a.size === null && b.size !== null) return -1;
        if (a.size !== null && b.size === null) return 1;
        if (a.size === null && b.size === null) return 0;
        return a.size - b.size;
      });

    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory with capacity tracking'));
    }
  }

  /**
   * Fallback method to get inventory organized by storage location
   */
  private async getInventoryByStorageFallback(): Promise<any[]> {
    try {
      console.log('🔍 Getting storage locations directly from storage_locations table...');
      
      // Get storage locations directly from the database (including inactive)
      const { data: storageLocations, error: storageError } = await withRetry(async () => {
        return await supabase
          .from('storage_locations')
          .select('id, name, status')
          .order('name');
      });

      console.log('📊 Storage locations from table:', storageLocations);
      console.log('❌ Storage error:', storageError);

      if (storageError) {
        console.warn('Could not fetch storage locations table:', storageError);
        // Use known storage locations from the database
        console.log('🔄 Using known storage locations...');
        const knownStorageMap = new Map();
        knownStorageMap.set('5cc7c667-8959-4dde-abe8-bd41d2b26d4e', 'Cold Storage A');
        knownStorageMap.set('f0f53658-830a-45c2-8dd3-4d0639e408d0', 'Cold Storage B');
        knownStorageMap.set('cfb34d85-6120-42fa-9af9-945d7d235ebc', 'Test Storage');
        knownStorageMap.set('0714e394-2396-438b-bcbe-9701633ff5ac', 'Freezer Unit 1');
        knownStorageMap.set('2bc2ab3f-a2fb-4822-aae5-05c92cc4e913', 'Processing Area 1');
        knownStorageMap.set('92ef2abd-d1c5-4941-80ef-d4478cfb00a7', 'Processing Area 2');
        return this.getInventoryWithStorageMap(knownStorageMap);
      }

      const storageMap = new Map();
      storageLocations?.forEach(loc => {
        storageMap.set(loc.id, loc.name);
      });
      
      console.log('✅ Using storage locations from table:', storageMap);
      return this.getInventoryWithStorageMap(storageMap);
    } catch (error) {
      console.error('Error in getInventoryByStorageFallback:', error);
      // Fallback to known storage locations
      const knownStorageMap = new Map();
      knownStorageMap.set('5cc7c667-8959-4dde-abe8-bd41d2b26d4e', 'Cold Storage A');
      knownStorageMap.set('f0f53658-830a-45c2-8dd3-4d0639e408d0', 'Cold Storage B');
      knownStorageMap.set('cfb34d85-6120-42fa-9af9-945d7d235ebc', 'Test Storage');
      knownStorageMap.set('0714e394-2396-438b-bcbe-9701633ff5ac', 'Freezer Unit 1');
      knownStorageMap.set('2bc2ab3f-a2fb-4822-aae5-05c92cc4e913', 'Processing Area 1');
      knownStorageMap.set('92ef2abd-d1c5-4941-80ef-d4478cfb00a7', 'Processing Area 2');
      return this.getInventoryWithStorageMap(knownStorageMap);
    }
  }

  /**
   * Get current inventory summary by size
   */
  async getInventorySummary(): Promise<InventorySummary[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory')
          .select('*')
          .order('size', { ascending: true });
      });

      if (error) throw error;

      // Convert to summary format with estimated weights
      return (data || []).map(item => ({
        size: item.size,
        quantity: item.quantity,
        total_weight_kg: this.getEstimatedWeightPerFish(item.size) * item.quantity
      }));
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory summary'));
    }
  }

  /**
   * Get estimated weight per fish based on size class
   */
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
    return weightMap[size] || 0.5;
  }

  /**
   * Get oldest batch that is yet to be removed (FIFO) - using same data as inventory component
   */
  async getOldestBatchForRemoval(): Promise<any[]> {
    try {
      console.log('🔍 Getting oldest batch for removal using inventory data...');
      
      // Use the same data source as the inventory component
      const inventoryData = await this.getInventoryByStorage();
      console.log('📦 Inventory data for FIFO:', inventoryData?.length || 0);

      if (!inventoryData || inventoryData.length === 0) {
        console.log('📦 No inventory data found');
        return [];
      }

      // Process inventory data to get oldest batches (focus on weights only)
      const batchMap = new Map();
      
      inventoryData.forEach((item: any) => {
        if (item.size !== null && item.total_weight_kg > 0 && item.contributing_batches) {
          // Process each contributing batch
          item.contributing_batches.forEach((batch: any) => {
            const batchId = batch.batch_id;
            const batchNumber = batch.batch_number || `BATCH-${batchId?.substring(0, 8)}`;
            
            if (!batchMap.has(batchId)) {
              // Calculate days in storage from batch created date
              const createdDate = batch.created_at;
              const daysInStorage = createdDate 
                ? Math.floor((new Date().getTime() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              batchMap.set(batchId, {
                batch_id: batchId,
                batch_number: batchNumber,
                size_class: item.size,
                total_weight_kg: 0, // Will sum up weights for this batch
                storage_location_name: item.storage_location_name,
                created_at: createdDate,
                processing_date: batch.processing_date,
                farmer_name: batch.farmer_name || 'Unknown Farmer',
                days_in_storage: daysInStorage,
                batch_status: batch.status || 'unknown'
              });
            }
            
            // Add weight for this size in this batch
            const existingBatch = batchMap.get(batchId);
            existingBatch.total_weight_kg += item.total_weight_kg;
          });
        }
      });

      // Convert to array and sort by oldest first (FIFO)
      const oldestBatches = Array.from(batchMap.values())
        .filter(batch => batch.total_weight_kg > 0)
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (a.batch_id || '').localeCompare(b.batch_id || '');
        })
        .slice(0, 10);

      console.log('📦 FIFO batches from inventory data:', oldestBatches.length);
      if (oldestBatches.length > 0) {
        console.log('📦 First FIFO batch:', oldestBatches[0]);
      }
      
      // Debug Size 9 specifically in FIFO
      const size9Batches = oldestBatches.filter(batch => batch.size_class === 9);
      console.log('🔍 Size 9 batches in FIFO:', size9Batches);
      
      return oldestBatches;
    } catch (error) {
      console.error('❌ Error in getOldestBatchForRemoval:', error);
      return [];
    }
  }

  /**
   * Fallback method to get oldest batches using a simpler approach
   */
  async getOldestBatchFallback(): Promise<any[]> {
    try {
      console.log('🔍 Using fallback method for oldest batches...');
      
      // Simple query to get sorting results with basic batch info
      const { data: sortingResults, error } = await supabase
        .from('sorting_results')
        .select(`
          id,
          size_class,
          total_pieces,
          total_weight_grams,
          storage_location_id,
          sorting_batch_id,
          created_at,
          storage_location:storage_locations(name)
        `)
        .not('storage_location_id', 'is', null)
        .gt('total_weight_grams', 0)
        .gt('total_pieces', 0)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        console.warn('⚠️ Error in fallback query:', error);
        return [];
      }

      if (!sortingResults || sortingResults.length === 0) {
        console.log('📦 No results from fallback query either');
        return [];
      }

      // Process the fallback data
      const fallbackBatches = sortingResults.map((result: any) => {
        const createdDate = result.created_at;
        const daysInStorage = createdDate 
          ? Math.floor((new Date().getTime() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          batch_id: result.sorting_batch_id || result.id,
          batch_number: `BATCH-${(result.sorting_batch_id || result.id)?.substring(0, 8)}`,
          size_class: result.size_class,
          total_pieces: result.total_pieces,
          total_weight_kg: result.total_weight_grams / 1000,
          storage_location_name: result.storage_location?.name || 'Unknown Storage',
          created_at: createdDate,
          processing_date: null,
          farmer_name: 'Unknown Farmer',
          days_in_storage: daysInStorage,
          batch_status: 'unknown'
        };
      });

      // Group by batch_id to avoid duplicates
      const uniqueBatches = new Map();
      fallbackBatches.forEach(batch => {
        if (batch.batch_id && !uniqueBatches.has(batch.batch_id)) {
          uniqueBatches.set(batch.batch_id, batch);
        }
      });

      const result = Array.from(uniqueBatches.values()).slice(0, 10);
      console.log('📦 Fallback method found:', result.length, 'batches');
      return result;
    } catch (error) {
      console.error('❌ Error in fallback method:', error);
      return [];
    }
  }

  /**
   * Get detailed batch information with all sizes for a specific batch
   */
  async getBatchDetails(batchId: string): Promise<any> {
    try {
      console.log('🔍 Getting batch details for:', batchId);
      
      const { data: batchData, error } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select(`
            id,
            batch_number,
            status,
            created_at,
            processing_record:processing_records(
              id,
              processing_date,
              warehouse_entry:warehouse_entries(
                id,
                entry_date,
                farmer_id,
                farmers(name, phone, location)
              )
            )
          `)
          .eq('id', batchId)
          .single();
      });

      if (error) {
        console.warn('⚠️ Error fetching batch details:', error);
        return null;
      }

      // Get all sizes for this batch
      const { data: sizesData, error: sizesError } = await withRetry(async () => {
        return await supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            storage_location:storage_locations(
              id,
              name
            )
          `)
          .eq('sorting_batch_id', batchId)
          .gt('total_pieces', 0)
          .order('size_class');
      });

      if (sizesError) {
        console.warn('⚠️ Error fetching batch sizes:', sizesError);
        return null;
      }

      const result = {
        batch: batchData,
        sizes: (sizesData || []).map((size: any) => ({
          size_class: size.size_class,
          total_pieces: size.total_pieces,
          total_weight_kg: size.total_weight_grams / 1000,
          storage_location_name: size.storage_location?.name
        }))
      };

      console.log('📦 Batch details processed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in getBatchDetails:', error);
      return null;
    }
  }

  /**
   * Get size demand statistics (most required sizes) from outlet orders
   */
  async getSizeDemandStatistics(): Promise<any[]> {
    try {
      console.log('🔍 Getting size demand statistics from outlet orders...');
      
      // Get all outlet orders to analyze size demand - using proper syntax
      const { data: outletOrders, error } = await withRetry(async () => {
        return await supabase
          .from('outlet_orders')
          .select(`
            id,
            requested_sizes,
            requested_quantity,
            requested_grade,
            order_date,
            status,
            outlet:outlets(
              id,
              name,
              location
            )
          `)
          .not('requested_sizes', 'is', null)
          .order('order_date', { ascending: false });
      });

      if (error) {
        console.warn('⚠️ Error fetching outlet orders data:', error);
        return [];
      }

      console.log('📦 Raw outlet orders data:', outletOrders);

      // Filter for confirmed/processing/dispatched/delivered orders with weight > 0
      const validOrders = (outletOrders || []).filter((order: any) => 
        ['confirmed', 'processing', 'dispatched', 'delivered'].includes(order.status) &&
        order.requested_quantity > 0 // Only orders with actual weight/quantity
      );

      console.log('📦 Valid outlet orders:', validOrders);

      // Aggregate by size class from requested_sizes arrays
      const sizeDemand = new Map();
      validOrders.forEach((order: any) => {
        if (order.requested_sizes && Array.isArray(order.requested_sizes)) {
          order.requested_sizes.forEach((size: number) => {
            if (!sizeDemand.has(size)) {
              sizeDemand.set(size, {
                size_class: size,
                total_orders: 0,
                total_weight_kg_requested: 0,
                outlet_count: new Set(),
                first_order_date: null,
                last_order_date: null,
                grade_preferences: new Map()
              });
            }
            
            const sizeData = sizeDemand.get(size);
            sizeData.total_orders += 1;
            sizeData.total_weight_kg_requested += order.requested_quantity || 0; // Assuming requested_quantity is in kg
            sizeData.outlet_count.add(order.outlet?.id);
            
            // Track grade preferences
            if (order.requested_grade) {
              const currentCount = sizeData.grade_preferences.get(order.requested_grade) || 0;
              sizeData.grade_preferences.set(order.requested_grade, currentCount + 1);
            }
            
            const orderDate = new Date(order.order_date);
            if (!sizeData.first_order_date || orderDate < new Date(sizeData.first_order_date)) {
              sizeData.first_order_date = order.order_date;
            }
            if (!sizeData.last_order_date || orderDate > new Date(sizeData.last_order_date)) {
              sizeData.last_order_date = order.order_date;
            }
          });
        }
      });

      // Convert to array and sort by total orders (most demanded first)
      const result = Array.from(sizeDemand.values())
        .map(sizeData => ({
          size_class: sizeData.size_class,
          total_orders: sizeData.total_orders,
          total_weight_kg_requested: sizeData.total_weight_kg_requested,
          unique_outlets: sizeData.outlet_count.size,
          first_order_date: sizeData.first_order_date,
          last_order_date: sizeData.last_order_date,
          days_span: sizeData.first_order_date && sizeData.last_order_date ? 
            Math.ceil((new Date(sizeData.last_order_date).getTime() - new Date(sizeData.first_order_date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          most_requested_grade: (Array.from(sizeData.grade_preferences.entries()) as [string, number][])
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'any'
        }))
        .filter(sizeData => sizeData.total_weight_kg_requested > 0) // Only show sizes with weight > 0
        .sort((a, b) => b.total_weight_kg_requested - a.total_weight_kg_requested); // Sort by weight instead of orders

      console.log('📊 Size demand statistics from outlet orders:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in getSizeDemandStatistics:', error);
      return [];
    }
  }

  private async getInventoryWithStorageMap(storageMap: Map<string, string>): Promise<any[]> {
    try {

      // Get sorting results (aggregated data from sorted fish) with complete batch details
      const { data: sortingResults, error } = await withRetry(async () => {
        return await supabase
          .from('sorting_results')
          .select(`
            id,
            size_class,
            total_pieces,
            total_weight_grams,
            storage_location_id,
            sorting_batch_id,
            transfer_source_storage_id,
            transfer_source_storage_name,
            transfer_id,
            sorting_batch:sorting_batches(
              id,
              batch_number,
              status,
              created_at,
              processing_record:processing_records(
                id,
                processing_date,
                warehouse_entry:warehouse_entries(
                  id,
                  entry_date,
                  farmer_id,
                  farmers(name, phone, location)
                )
              )
            )
          `)
          .not('storage_location_id', 'is', null)
          .order('created_at', { ascending: false });
      });

      if (error) throw error;

      // Filter for completed batches only
      const completedSortingResults = (sortingResults || []).filter((result: any) => 
        result.sorting_batch && result.sorting_batch.status === 'completed'
      );

      console.log('📦 Filtered sorting results (completed only):', completedSortingResults.length, 'out of', sortingResults?.length || 0);

      // Aggregate the data by storage location and size
      const storageAggregation: Record<string, {
        storage_location_id: string;
        storage_location_name: string;
        sizes: Record<number, {
          total_quantity: number;
          total_weight_kg: number;
          batch_count: number;
          contributing_batches: any[];
        }>;
      }> = {};

      completedSortingResults.forEach((result: any) => {
        const storageId = result.storage_location_id || 'unknown';
        const storageName = storageMap.get(storageId) || 'Unknown Storage';
        const size = result.size_class;
        const qty = result.total_pieces || 0;
        const weightKg = (result.total_weight_grams || 0) / 1000; // Convert grams to kg
        
        if (qty > 0) {
          if (!storageAggregation[storageId]) {
            storageAggregation[storageId] = {
              storage_location_id: storageId,
              storage_location_name: storageName,
              sizes: {}
            };
          }

          if (!storageAggregation[storageId].sizes[size]) {
            storageAggregation[storageId].sizes[size] = {
              total_quantity: 0,
              total_weight_kg: 0,
              batch_count: 0,
              contributing_batches: []
            };
          }

          storageAggregation[storageId].sizes[size].total_quantity += qty;
          storageAggregation[storageId].sizes[size].total_weight_kg += weightKg;
          storageAggregation[storageId].sizes[size].batch_count += 1;

          // Add batch info with complete details including transfer information
          const isTransferred = !!result.transfer_id && result.transfer_source_storage_name;
          
          storageAggregation[storageId].sizes[size].contributing_batches.push({
            batch_id: result.sorting_batch_id,
            batch_number: result.sorting_batch?.batch_number || `BATCH-${result.sorting_batch_id?.slice(-8).toUpperCase()}`,
            quantity: qty,
            weight_kg: weightKg,
            storage_location_name: storageName,
            farmer_name: isTransferred 
              ? `${result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown'} (Transferred from ${result.transfer_source_storage_name})` 
              : (result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown'),
            processing_date: result.sorting_batch?.processing_record?.processing_date || 'Unknown',
            added_date: result.sorting_batch?.created_at || new Date().toISOString(),
            created_at: result.sorting_batch?.created_at || new Date().toISOString(),
            // Transfer tracking information - only include if transfer data exists
            ...(isTransferred && {
              is_transfer: true,
              transfer_id: result.transfer_id,
              transfer_source_storage_id: result.transfer_source_storage_id,
              transfer_source_storage_name: result.transfer_source_storage_name
            })
          });
        }
      });

      // Convert to flat array format for storage-location-size combinations
      const result: any[] = [];
      Object.values(storageAggregation).forEach(storage => {
        Object.entries(storage.sizes).forEach(([sizeStr, sizeData]) => {
          result.push({
            storage_location_id: storage.storage_location_id,
            storage_location_name: storage.storage_location_name,
            size: parseInt(sizeStr),
            total_quantity: sizeData.total_quantity,
            total_weight_kg: sizeData.total_weight_kg,
            batch_count: sizeData.batch_count,
            contributing_batches: sizeData.contributing_batches
          });
        });
      });

      console.log('📦 Final inventory result:', result);
      console.log('📊 Storage aggregation:', storageAggregation);

      return result.sort((a, b) => {
        // Sort by storage location name, then by size
        if (a.storage_location_name !== b.storage_location_name) {
          return a.storage_location_name.localeCompare(b.storage_location_name);
        }
        return a.size - b.size;
      });

    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory with storage map'));
    }
  }

  /**
   * Fallback method to get inventory from sorting batches directly (legacy)
   */
  private async getInventoryFromSortingBatchesFallback(storageMap: Map<string, string>): Promise<InventorySummary[]> {
    try {
      const { data: batches, error } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select(`
            id,
            batch_number,
            size_distribution,
            created_at,
            storage_location_id,
            processing_record:processing_records(
              id,
              processing_date,
              warehouse_entry:warehouse_entries(
                id,
                farmer_id,
                farmers(name, phone, location)
              )
            )
          `)
          .eq('status', 'completed')
          .not('size_distribution', 'is', null)
          .order('created_at', { ascending: false });
      });

      if (error) throw error;

      // Aggregate the data by size
      const sizeAggregation: Record<number, {
        total_quantity: number;
        total_weight_kg: number;
        batch_count: number;
        contributing_batches: any[];
        storage_locations: Record<string, any>;
      }> = {};

      batches?.forEach((batch: any) => {
        if (batch.size_distribution && typeof batch.size_distribution === 'object') {
          Object.entries(batch.size_distribution).forEach(([sizeStr, quantity]: [string, any]) => {
            const size = parseInt(sizeStr);
            const qty = parseInt(quantity) || 0;
            
            if (!isNaN(size) && qty > 0) {
              // Estimate weight based on size
              const weightPerFish = this.getEstimatedWeightPerFish(size);
              const weightKg = qty * weightPerFish;

              if (!sizeAggregation[size]) {
                sizeAggregation[size] = {
                  total_quantity: 0,
                  total_weight_kg: 0,
                  batch_count: 0,
                  contributing_batches: [],
                  storage_locations: {}
                };
              }

              sizeAggregation[size].total_quantity += qty;
              sizeAggregation[size].total_weight_kg += weightKg;
              sizeAggregation[size].batch_count += 1;

              // Add batch info with complete details
              sizeAggregation[size].contributing_batches.push({
                batch_id: batch.id,
                batch_number: batch.batch_number || `BATCH-${batch.id?.slice(-8).toUpperCase()}`,
                quantity: qty,
                weight_kg: weightKg,
                storage_location_id: batch.storage_location_id,
                storage_location_name: storageMap.get(batch.storage_location_id) || 'Unknown Storage',
                farmer_name: batch.processing_record?.warehouse_entry?.farmers?.name || 'Unknown',
                processing_date: batch.processing_record?.processing_date || 'Unknown',
                added_date: batch.created_at,
                created_at: batch.created_at
              });

              // Track storage locations
              if (batch.storage_location_id) {
                sizeAggregation[size].storage_locations[batch.storage_location_id] = {
                  storage_location_name: storageMap.get(batch.storage_location_id) || 'Unknown Storage',
                  quantity: (sizeAggregation[size].storage_locations[batch.storage_location_id]?.quantity || 0) + qty,
                  weight_kg: (sizeAggregation[size].storage_locations[batch.storage_location_id]?.weight_kg || 0) + weightKg
                };
              }
            }
          });
        }
      });

      // Convert to array format
      return Object.entries(sizeAggregation).map(([sizeStr, data]) => ({
        size: parseInt(sizeStr),
        quantity: data.total_quantity,
        total_weight_kg: data.total_weight_kg,
        batch_count: data.batch_count,
        storage_locations: data.storage_locations,
        contributing_batches: data.contributing_batches
      })).sort((a, b) => a.size - b.size);

    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory from sorting batches fallback'));
    }
  }

  /**
   * Get detailed batch information for a specific size
   */
  async getBatchesForSize(size: number): Promise<any[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_batches_for_size', { p_size: size });
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching batches for size'));
    }
  }

  /**
   * Get storage capacity status for all locations
   */
  async getStorageCapacityStatus(): Promise<any[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_storage_capacity_status');
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching storage capacity status'));
    }
  }

  /**
   * Get available storage locations for sorting
   */
  async getAvailableStorageLocationsForSorting(requiredWeightKg: number = 0): Promise<any[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_available_storage_locations_for_sorting', {
          p_required_weight_kg: requiredWeightKg
        });
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching available storage locations'));
    }
  }

  /**
   * Validate storage location for sorting
   */
  async validateStorageLocationForSorting(
    storageLocationId: string, 
    estimatedWeightKg: number = 0
  ): Promise<{
    is_valid: boolean;
    message: string;
    storage_location_name: string;
    available_capacity_kg: number;
    utilization_percent: number;
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('validate_storage_location_for_sorting', {
          p_storage_location_id: storageLocationId,
          p_estimated_weight_kg: estimatedWeightKg
        });
      });
      
      if (error) throw error;
      return data?.[0] || { is_valid: false, message: 'Validation failed', storage_location_name: '', available_capacity_kg: 0, utilization_percent: 0 };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'validating storage location'));
    }
  }

  /**
   * Get detailed inventory items
   */
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory')
          .select('*')
          .order('size', { ascending: true });
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory items'));
    }
  }

  /**
   * Get inventory entries (movement history)
   */
  async getInventoryEntries(limit = 100): Promise<InventoryEntry[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory_entries')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory entries'));
    }
  }

  /**
   * Add stock from completed sorting batch
   */
  async addStockFromSorting(sortingBatchId: string): Promise<InventoryItem[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('add_stock_from_sorting', {
          p_sorting_batch_id: sortingBatchId
        });
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'adding stock from sorting batch'));
    }
  }

  /**
   * Get sorting batches ready for inventory
   */
  async getSortingBatchesForInventory(): Promise<any[]> {
    try {
      // Get sorting batches with their results (same as sorting management)
      const { data: batches, error: batchesError } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select(`
            *,
            processing_record:processing_records(
              id,
              post_processing_weight,
              processing_date,
              warehouse_entry:warehouse_entries(
                id,
                entry_date,
                farmer_id,
                farmers(name, phone, location)
              )
            )
          `)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });
      });

      if (batchesError) throw batchesError;

      // Get sorting results for each batch
      const batchesWithResults = await Promise.all(
        (batches || []).map(async (batch) => {
          const { data: results, error: resultsError } = await withRetry(async () => {
            return await supabase
              .from('sorting_results')
              .select('*')
              .eq('sorting_batch_id', batch.id)
              .order('size_class');
          });

          if (resultsError) {
            console.warn(`Error fetching results for batch ${batch.id}:`, resultsError);
            return { ...batch, results: [] };
          }

          return { ...batch, results: results || [] };
        })
      );

      return batchesWithResults;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching sorting batches for inventory'));
    }
  }

  /**
   * Validate sorting batch for inventory
   */
  async validateSortingBatchForInventory(batchId: string): Promise<{
    canAdd: boolean;
    reason?: string;
    batch?: any;
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('validate_sorting_batch_for_inventory', {
          p_sorting_batch_id: batchId
        });
      });
      
      if (error) throw error;
      return data || { canAdd: false, reason: 'Unknown error' };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'validating sorting batch for inventory'));
    }
  }

  /**
   * Get inventory by size class
   */
  async getInventoryBySize(size: number): Promise<InventoryItem | null> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory')
          .select('*')
          .eq('size', size)
          .single();
      });
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data || null;
    } catch (error) {
      throw new Error(handleSupabaseError(error, `fetching inventory for size ${size}`));
    }
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<{
    total_quantity: number;
    total_weight: number;
    size_distribution: Record<number, number>;
    last_updated: string;
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_inventory_statistics');
      });
      
      if (error) throw error;
      return data || {
        total_quantity: 0,
        total_weight: 0,
        size_distribution: {},
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching inventory statistics'));
    }
  }

  /**
   * Create inventory adjustment
   */
  async createInventoryAdjustment(
    size: number,
    quantityChange: number,
    notes?: string
  ): Promise<InventoryEntry> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory_entries')
          .insert({
            size,
            quantity_change: quantityChange,
            entry_type: 'adjustment',
            notes
          })
          .select()
          .single();
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating inventory adjustment'));
    }
  }

  /**
   * Update inventory quantity for a specific item
   */
  async updateInventory(itemId: string, newQuantity: number): Promise<InventoryItem> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('inventory')
          .update({ 
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', itemId)
          .select()
          .single();
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating inventory item'));
    }
  }

  /**
   * Process FIFO order fulfillment (check if order can be fulfilled)
   */
  async processFIFOOrderFulfillment(
    orderId: string,
    size: number,
    requiredQuantity: number,
    requiredWeightKg: number
  ): Promise<{
    success: boolean;
    message: string;
    allocatedBatches: any[];
    remainingQuantity: number;
    remainingWeightKg: number;
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('process_fifo_order_fulfillment', {
          p_order_id: orderId,
          p_size: size,
          p_required_quantity: requiredQuantity,
          p_required_weight_kg: requiredWeightKg
        });
      });
      
      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
          console.warn('⚠️ FIFO order fulfillment function not found. Please run the database script: db/ensure_inventory_storage_accuracy.sql');
          return { 
            success: false, 
            message: 'FIFO functions not available. Please run the database setup script.', 
            allocatedBatches: [], 
            remainingQuantity: requiredQuantity, 
            remainingWeightKg: requiredWeightKg 
          };
        }
        throw error;
      }
      return data?.[0] || { success: false, message: 'Unknown error', allocatedBatches: [], remainingQuantity: 0, remainingWeightKg: 0 };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'processing FIFO order fulfillment'));
    }
  }

  /**
   * Reduce inventory when order is approved (FIFO)
   */
  async reduceInventoryOnOrderApproval(
    orderId: string,
    size: number,
    quantity: number,
    weightKg: number
  ): Promise<{
    success: boolean;
    message: string;
    reducedBatches: any[];
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('reduce_inventory_on_order_approval', {
          p_order_id: orderId,
          p_size: size,
          p_quantity: quantity,
          p_weight_kg: weightKg
        });
      });
      
      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
          console.warn('⚠️ FIFO inventory reduction function not found. Please run the database script: db/ensure_inventory_storage_accuracy.sql');
          return { 
            success: false, 
            message: 'FIFO functions not available. Please run the database setup script.', 
            reducedBatches: [] 
          };
        }
        throw error;
      }
      return data?.[0] || { success: false, message: 'Unknown error', reducedBatches: [] };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'reducing inventory on order approval'));
    }
  }

  /**
   * Transfer inventory between storage locations
   */
  async transferInventoryBetweenStorage(
    fromStorageLocationId: string,
    toStorageLocationId: string,
    size: number,
    quantity: number,
    notes?: string
  ): Promise<{
    success: boolean;
    message: string;
    from_remaining: number;
    to_new_total: number;
  }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('transfer_inventory_between_storage', {
          p_from_storage_location_id: fromStorageLocationId,
          p_to_storage_location_id: toStorageLocationId,
          p_size: size,
          p_quantity: quantity,
          p_notes: notes || null
        });
      });
      
      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
          console.warn('⚠️ Transfer function not found. Please run the database script: db/fix_inventory_storage_integration.sql');
          return { 
            success: false, 
            message: 'Transfer function not available. Please run the database setup script.', 
            from_remaining: 0, 
            to_new_total: 0 
          };
        }
        throw error;
      }
      return data?.[0] || { success: false, message: 'Unknown error', from_remaining: 0, to_new_total: 0 };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'transferring inventory between storage locations'));
    }
  }

  /**
   * Create a transfer
   */
  async createTransfer(
    fromStorageLocationId: string,
    toStorageLocationId: string,
    size: number,
    quantity: number,
    weightKg: number,
    notes?: string
  ): Promise<{ success: boolean; transferId: string; message: string }> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('create_transfer', {
          p_from_storage_location_id: fromStorageLocationId,
          p_to_storage_location_id: toStorageLocationId,
          p_size: size,
          p_quantity: quantity,
          p_weight_kg: weightKg,
          p_notes: notes || null
        });
      });
      
      if (error) {
        throw error;
      }
      
      return { 
        success: true, 
        transferId: data, 
        message: 'Transfer created successfully' 
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating transfer'));
    }
  }

  // Keep the old method name for backward compatibility
  async createTransferRequest(
    fromStorageLocationId: string,
    toStorageLocationId: string,
    size: number,
    quantity: number,
    weightKg: number,
    notes?: string
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    const result = await this.createTransfer(fromStorageLocationId, toStorageLocationId, size, quantity, weightKg, notes);
    return {
      success: result.success,
      requestId: result.transferId,
      message: result.message
    };
  }

  /**
   * Create a batch transfer for multiple sizes
   */
  async createBatchTransfer(
    fromStorageLocationId: string,
    toStorageLocationId: string,
    sizeData: Array<{size: number; quantity: number; weightKg: number}>,
    notes?: string,
    requestedBy?: string
  ): Promise<{ success: boolean; transferId: string; message: string }> {
    try {
      // First, check for existing pending transfers to prevent duplicates
      const { data: existingTransfers, error: checkError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('id, size_class, quantity, weight_kg, notes')
          .eq('from_storage_location_id', fromStorageLocationId)
          .eq('to_storage_location_id', toStorageLocationId)
          .eq('status', 'pending');
      });

      if (checkError) {
        console.warn('Could not check for existing transfers:', checkError);
      } else if (existingTransfers && existingTransfers.length > 0) {
        // Check if any of the existing transfers match our size data
        const hasDuplicate = sizeData.some(sizeItem => 
          existingTransfers.some(existing => 
            existing.size_class === sizeItem.size &&
            existing.quantity === sizeItem.quantity &&
            Math.abs(existing.weight_kg - sizeItem.weightKg) < 0.01 // Allow small weight differences
          )
        );

        if (hasDuplicate) {
          throw new Error('A transfer request for these items already exists. Please check the transfer approvals section.');
        }
      }

      console.log('🔍 [InventoryService] Creating batch transfer with data:', {
        fromStorageLocationId,
        toStorageLocationId,
        sizeData,
        notes
      });
      
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('create_batch_transfer', {
          p_from_storage_location_id: fromStorageLocationId,
          p_to_storage_location_id: toStorageLocationId,
          p_size_data: sizeData,
          p_notes: notes || null,
          p_requested_by: requestedBy || null
        });
      });
      
      console.log('📊 [InventoryService] Batch transfer creation result:', { data, error });
      
      if (error) {
        // Handle specific error cases
        if (error.code === '23505') {
          throw new Error('A transfer request for these items already exists. Please check the transfer approvals section.');
        } else if (error.message && error.message.includes('function create_batch_transfer')) {
          throw new Error('Transfer system not properly set up. Please run the database migration script: QUICK_TRANSFER_FIX.sql');
        }
        throw error;
      }
      
      return { 
        success: true, 
        transferId: data, 
        message: `Batch transfer created successfully for ${sizeData.length} sizes` 
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating batch transfer'));
    }
  }

  /**
   * Approve a transfer (handles both single and batch transfers)
   */
  async approveTransfer(
    transferId: string,
    approvedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if this transfer is part of a batch (same from/to storage, same timestamp, same notes)
      const { data: batchData, error: checkError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('from_storage_location_id, to_storage_location_id, created_at, notes')
          .eq('id', transferId)
          .single();
      });
      
      if (checkError) {
        throw checkError;
      }
      
      // Check if there are other transfers in the same batch
      const { data: batchCount, error: countError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('id', { count: 'exact' })
          .eq('from_storage_location_id', batchData.from_storage_location_id)
          .eq('to_storage_location_id', batchData.to_storage_location_id)
          .eq('created_at', batchData.created_at)
          .eq('notes', batchData.notes)
          .eq('status', 'pending');
      });
      
      if (countError) {
        throw countError;
      }
      
      // If there are multiple transfers in the batch, use batch approval
      const isBatchTransfer = (batchCount?.length || 0) > 1;
      const functionName = isBatchTransfer ? 'approve_batch_transfer' : 'approve_transfer';
      
      console.log(`🔍 [InventoryService] ${isBatchTransfer ? 'Batch' : 'Single'} transfer approval for ID: ${transferId}`);
      
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc(functionName, {
          p_transfer_id: transferId,
          p_approved_by: approvedBy
        });
      });
      
      if (error) {
        throw error;
      }
      
      return data?.[0] || { success: false, message: 'Unknown error' };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'approving transfer'));
    }
  }

  // Keep the old method name for backward compatibility
  async approveTransferRequest(
    requestId: string,
    approvedBy: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.approveTransfer(requestId, approvedBy);
  }

  /**
   * Decline a transfer
   */
  async declineTransfer(
    transferId: string,
    approvedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if this transfer is part of a batch
      const { data: batchData, error: checkError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('from_storage_location_id, to_storage_location_id, created_at, notes')
          .eq('id', transferId)
          .single();
      });
      
      if (checkError) {
        throw checkError;
      }
      
      // Check if there are other transfers in the same batch
      const { data: batchCount, error: countError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('id', { count: 'exact' })
          .eq('from_storage_location_id', batchData.from_storage_location_id)
          .eq('to_storage_location_id', batchData.to_storage_location_id)
          .eq('created_at', batchData.created_at)
          .eq('notes', batchData.notes)
          .eq('status', 'pending');
      });
      
      if (countError) {
        throw countError;
      }
      
      // If there are multiple transfers in the batch, use batch decline
      const isBatchTransfer = (batchCount?.length || 0) > 1;
      const functionName = isBatchTransfer ? 'decline_batch_transfer' : 'decline_transfer';
      
      console.log(`🔍 [InventoryService] ${isBatchTransfer ? 'Batch' : 'Single'} transfer decline for ID: ${transferId}`);
      
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc(functionName, {
          p_transfer_id: transferId,
          p_approved_by: approvedBy
        });
      });
      
      if (error) {
        throw error;
      }
      
      return data?.[0] || { success: false, message: 'Unknown error' };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'declining transfer'));
    }
  }

  /**
   * Mark a transfer as completed
   */
  async completeTransfer(
    transferId: string,
    completedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔍 [InventoryService] Marking transfer as completed for ID: ${transferId}`);
      
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('complete_transfer', {
          p_transfer_id: transferId,
          p_completed_by: completedBy
        });
      });
      
      if (error) {
        throw error;
      }
      
      return data?.[0] || { success: false, message: 'Unknown error' };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'completing transfer'));
    }
  }

  // Keep the old method name for backward compatibility
  async declineTransferRequest(
    requestId: string,
    approvedBy: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.declineTransfer(requestId, approvedBy);
  }

  /**
   * Get pending transfers
   */
  async getPendingTransfers(): Promise<any[]> {
    try {
      console.log('🔍 [InventoryService] Fetching pending transfers...');
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
      });
      
      console.log('📊 [InventoryService] Pending transfers result:', { data, error, count: data?.length || 0 });
      
      if (error) {
        console.warn('⚠️ [InventoryService] Error fetching pending transfers:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ [InventoryService] Error in getPendingTransfers:', error);
      return [];
    }
  }

  // Keep the old method name for backward compatibility
  async getPendingTransferRequests(): Promise<any[]> {
    return await this.getPendingTransfers();
  }

  /**
   * Get available storage locations for transfer (excluding the source)
   */
  async getAvailableStorageLocationsForTransfer(excludeStorageId?: string): Promise<any[]> {
    try {
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('storage_locations')
          .select('id, name, location_type, capacity_kg, current_usage_kg, status')
          .eq('status', 'active')
          .order('name');
        
        if (excludeStorageId) {
          query = query.neq('id', excludeStorageId);
        }
        
        return await query;
      });
      
      if (error) throw error;
      
      // Calculate actual usage from sorting_results for each storage location
      const storagesWithActualUsage = await Promise.all(
        (data || []).map(async (storage) => {
          const { data: usageData, error: usageError } = await withRetry(async () => {
            return await supabase
              .from('sorting_results')
              .select('total_weight_grams')
              .eq('storage_location_id', storage.id);
          });
          
          if (usageError) {
            console.warn(`Error calculating usage for ${storage.name}:`, usageError);
            return {
              ...storage,
              current_usage_kg: storage.current_usage_kg || 0,
              available_capacity_kg: (storage.capacity_kg || 0) - (storage.current_usage_kg || 0),
              utilization_percent: storage.capacity_kg > 0 ? 
                ((storage.current_usage_kg || 0) / storage.capacity_kg) * 100 : 0
            };
          }
          
          const actualUsageKg = (usageData || []).reduce((sum, item) => 
            sum + ((item.total_weight_grams || 0) / 1000), 0
          );
          
          const availableCapacity = Math.max(0, (storage.capacity_kg || 0) - actualUsageKg);
          const utilizationPercent = storage.capacity_kg > 0 ? 
            (actualUsageKg / storage.capacity_kg) * 100 : 0;
          
          console.log(`Storage ${storage.name}: Capacity=${storage.capacity_kg}kg, Usage=${actualUsageKg.toFixed(2)}kg, Available=${availableCapacity.toFixed(2)}kg`);
          
          return {
            ...storage,
            current_usage_kg: actualUsageKg,
            available_capacity_kg: availableCapacity,
            utilization_percent: utilizationPercent
          };
        })
      );
      
      return storagesWithActualUsage;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching available storage locations for transfer'));
    }
  }

  /**
   * Get transfer history from unified transfers table
   */
  async getTransferHistory(limit = 100): Promise<any[]> {
    try {
      console.log('🔍 [InventoryService] Fetching transfer history from transfers table...');
      
      // Use the existing transfers table
      const { data: transfersData, error: transfersError } = await withRetry(async () => {
        return await supabase
          .from('transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
      });
      
      console.log('📊 [InventoryService] Transfers table result:', { 
        data: transfersData, 
        error: transfersError,
        count: transfersData?.length || 0 
      });
      
      if (transfersError) {
        console.error('❌ [InventoryService] Error accessing transfers table:', transfersError);
        return [];
      }
      
      if (!transfersData || transfersData.length === 0) {
        console.log('⚠️ [InventoryService] No transfer data found in transfers table');
        return [];
      }
      
      // Get user profiles for display names
      const userIds = [...new Set([
        ...transfersData.map(t => t.requested_by).filter(Boolean),
        ...transfersData.map(t => t.approved_by).filter(Boolean)
      ])];
      
      const { data: userProfiles, error: profilesError } = await withRetry(async () => {
        if (userIds.length === 0) return { data: [], error: null };
        return await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
      });
      
      const userMap = new Map();
      if (userProfiles && !profilesError) {
        userProfiles.forEach(profile => {
          userMap.set(profile.id, `${profile.first_name} ${profile.last_name}`);
        });
      }

      // Process the data - show each transfer individually without grouping
      const finalData = transfersData.map(entry => ({
        id: entry.id,
        from_storage: entry.from_storage_name || 'Unknown',
        to_storage: entry.to_storage_name || 'Unknown',
        size: entry.size_class,
        quantity: entry.quantity,
        weight_kg: entry.weight_kg || 0,
        notes: entry.notes || '',
        status: entry.status,
        created_at: entry.created_at,
        created_by: entry.requested_by ? (userMap.get(entry.requested_by) || `User ${entry.requested_by.slice(0, 8)}`) : 'System',
        approved_by: entry.approved_by ? (userMap.get(entry.approved_by) || `User ${entry.approved_by.slice(0, 8)}`) : null,
        is_bulk: false,
        batch_size: 1
      }));
      
      // Sort by creation date (newest first)
      finalData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('📊 [InventoryService] Processed transfer data with bulk grouping:', finalData);
      return finalData;
    } catch (error) {
      console.error('Error fetching transfer history:', error);
      return []; // Return empty array instead of throwing error
    }
  }

  /**
   * Get transfer history - alias for getTransfersWithItems
   */
  async getTransferHistory(limit: number = 100): Promise<any[]> {
    try {
      console.log('🔍 Getting transfer history...');
      return await this.getTransfersWithItems(limit);
    } catch (error) {
      console.error('Error getting transfer history:', error);
      return [];
    }
  }

  /**
   * Approve a transfer
   */
  async approveTransfer(transferId: string, approvedBy: string): Promise<boolean> {
    try {
      console.log('✅ Approving transfer:', transferId);
      const { data, error } = await supabase.rpc('approve_transfer', {
        p_transfer_id: transferId,
        p_approved_by: approvedBy
      });

      if (error) {
        console.error('Error approving transfer:', error);
        throw error;
      }

      console.log('✅ Transfer approved successfully:', data);
      return true;
    } catch (error) {
      console.error('Error approving transfer:', error);
      throw error;
    }
  }

  /**
   * Decline a transfer
   */
  async declineTransfer(transferId: string, approvedBy: string): Promise<boolean> {
    try {
      console.log('❌ Declining transfer:', transferId);
      const { data, error } = await supabase.rpc('decline_transfer', {
        p_transfer_id: transferId,
        p_approved_by: approvedBy
      });

      if (error) {
        console.error('Error declining transfer:', error);
        throw error;
      }

      console.log('❌ Transfer declined successfully:', data);
      return true;
    } catch (error) {
      console.error('Error declining transfer:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
export default inventoryService;
