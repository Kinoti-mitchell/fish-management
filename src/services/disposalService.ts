import { supabase } from '../lib/supabaseClient';

export interface DisposalStats {
  totalDisposals: number;
  totalDisposedWeight: number;
  totalDisposalCost: number;
  pendingDisposals: number;
  recentDisposals: number;
  averageDisposalAge: number;
  topDisposalReason: string;
  monthlyDisposalTrend: number;
}

class DisposalService {
  /**
   * Get comprehensive disposal statistics
   */
  async getDisposalStats(): Promise<DisposalStats> {
    try {
      console.log('🔍 [DisposalService] Fetching disposal statistics...');

      // Get all disposal records
      const { data: disposalRecords, error: disposalError } = await supabase
        .from('disposal_records')
        .select(`
          *,
          disposal_reason:disposal_reasons(name)
        `)
        .order('created_at', { ascending: false });

      if (disposalError) {
        console.error('❌ [DisposalService] Error fetching disposal records:', disposalError);
        throw disposalError;
      }

      console.log('📊 [DisposalService] Disposal records:', disposalRecords?.length || 0);

      // Calculate basic stats
      const totalDisposals = disposalRecords?.length || 0;
      const totalDisposedWeight = disposalRecords?.reduce((sum, record) => 
        sum + (record.total_weight_kg || 0), 0) || 0;
      const totalDisposalCost = disposalRecords?.reduce((sum, record) => 
        sum + (record.disposal_cost || 0), 0) || 0;

      // Get pending disposals
      const pendingDisposals = disposalRecords?.filter(record => 
        record.status === 'pending').length || 0;

      // Get recent disposals (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentDisposals = disposalRecords?.filter(record => 
        new Date(record.created_at) >= sevenDaysAgo).length || 0;

      // Calculate average disposal age
      const completedDisposals = disposalRecords?.filter(record => 
        record.status === 'completed') || [];
      
      let averageDisposalAge = 0;
      if (completedDisposals.length > 0) {
        const totalAge = completedDisposals.reduce((sum, record) => {
          const createdDate = new Date(record.created_at);
          const disposalDate = new Date(record.disposal_date);
          const ageInDays = Math.floor((disposalDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + ageInDays;
        }, 0);
        averageDisposalAge = totalAge / completedDisposals.length;
      }

      // Get top disposal reason
      const reasonCounts: { [key: string]: number } = {};
      disposalRecords?.forEach(record => {
        const reason = record.disposal_reason?.name || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      
      const topDisposalReason = Object.keys(reasonCounts).reduce((a, b) => 
        reasonCounts[a] > reasonCounts[b] ? a : b, 'Age');

      // Calculate monthly trend (current month vs previous month)
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const currentMonthDisposals = disposalRecords?.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      }).length || 0;

      const lastMonthDisposals = disposalRecords?.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastMonthYear;
      }).length || 0;

      const monthlyDisposalTrend = lastMonthDisposals > 0 
        ? ((currentMonthDisposals - lastMonthDisposals) / lastMonthDisposals) * 100 
        : 0;

      const stats: DisposalStats = {
        totalDisposals,
        totalDisposedWeight,
        totalDisposalCost,
        pendingDisposals,
        recentDisposals,
        averageDisposalAge,
        topDisposalReason,
        monthlyDisposalTrend
      };

      console.log('📊 [DisposalService] Calculated stats:', stats);
      return stats;

    } catch (error) {
      console.error('❌ [DisposalService] Error getting disposal stats:', error);
      // Return default stats on error
      return {
        totalDisposals: 0,
        totalDisposedWeight: 0,
        totalDisposalCost: 0,
        pendingDisposals: 0,
        recentDisposals: 0,
        averageDisposalAge: 0,
        topDisposalReason: 'Age',
        monthlyDisposalTrend: 0
      };
    }
  }

  /**
   * Get disposal records with pagination
   */
  async getDisposalRecords(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('disposal_records')
        .select(`
          *,
          disposal_reason:disposal_reasons(name),
          disposal_items(
            size_class,
            weight_grams,
            batch_number,
            sorting_result:sorting_results(
              sorting_batch:sorting_batches(batch_number)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      
      // Transform the data to include batch_numbers and size_classes arrays
      const transformedData = (data || []).map(record => ({
        ...record,
        batch_numbers: record.disposal_items?.map((item: any) => 
          item.batch_number || item.sorting_result?.sorting_batch?.batch_number || 'Unknown'
        ).filter((batch: string, index: number, arr: string[]) => arr.indexOf(batch) === index) || [],
        size_classes: record.disposal_items?.map((item: any) => item.size_class).filter((size: number, index: number, arr: number[]) => arr.indexOf(size) === index) || []
      }));
      
      return transformedData;
    } catch (error) {
      console.error('Error fetching disposal records:', error);
      return [];
    }
  }

  /**
   * Get disposal reasons
   */
  async getDisposalReasons() {
    try {
      const { data, error } = await supabase
        .from('disposal_reasons')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching disposal reasons:', error);
      return [];
    }
  }

  /**
   * Get inventory items eligible for disposal with improved filtering
   */
  async getInventoryForDisposal(daysOld = 30, includeStorageIssues = true, maxDaysOld?: number, inactiveStorageOnly = false, fromDate?: string, toDate?: string) {
    try {
      console.log('🔍 [DisposalService] Getting inventory for disposal with improved filtering...');
      console.log('📊 [DisposalService] Filter criteria:', { daysOld, includeStorageIssues });
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      console.log('📅 [DisposalService] Cutoff date:', cutoffDateStr);

      // Get storage locations first
      const { data: storageLocations, error: storageError } = await supabase
        .from('storage_locations')
        .select('id, name, status, capacity_kg, current_usage_kg')
        .order('name');

      if (storageError) {
        console.error('❌ [DisposalService] Storage locations error:', storageError);
        throw storageError;
      }

      console.log('📍 [DisposalService] Storage locations found:', storageLocations?.length || 0);

      // Create storage map
      const storageMap = new Map();
      storageLocations?.forEach(location => {
        storageMap.set(location.id, location);
      });

      // Build the main query with better filtering - simplified to avoid permission issues
      let query = supabase
        .from('sorting_results')
        .select(`
          id,
          size_class,
          total_pieces,
          total_weight_grams,
          storage_location_id,
          created_at,
          sorting_batch:sorting_batches(
            id,
            batch_number,
            status,
            created_at
          )
        `)
        .not('storage_location_id', 'is', null)
        .gt('total_weight_grams', 0);

      // Apply batch status filter
      query = query.eq('sorting_batch.status', 'completed');

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [DisposalService] Query error:', error);
        throw error;
      }

      console.log('📊 [DisposalService] Raw query results:', data?.length || 0, 'items');

      // Apply filtering logic with improved criteria
      const eligibleItems = (data || []).filter((result: any) => {
        const storageLocation = storageMap.get(result.storage_location_id);
        
        // First check: Must have actual weight (not 0kg)
        if (!result.total_weight_grams || result.total_weight_grams <= 0) {
          console.log('❌ [DisposalService] Item filtered out - no weight:', result.id, result.total_weight_grams);
          return false;
        }
        
        // Get processing date - use batch created_at since we simplified the query
        const processingDate = result.sorting_batch?.created_at?.split('T')[0] || 
                              result.created_at?.split('T')[0];
        
        if (!processingDate) {
          console.log('❌ [DisposalService] Item filtered out - no processing date:', result.id);
          return false;
        }

        const processDate = new Date(processingDate);
        
        // Check if processing date is valid and not in the future
        if (isNaN(processDate.getTime()) || processDate > new Date()) {
          console.log('❌ [DisposalService] Item filtered out - invalid or future date:', result.id, processingDate);
          return false;
        }
        
        const daysInStorage = Math.floor((new Date().getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check age criteria - handle both single threshold and age ranges
        let isOldEnough = false;
        if (daysOld === 0) {
          isOldEnough = true; // Show all items regardless of age
        } else if (maxDaysOld && maxDaysOld > daysOld) {
          // Age range: items between daysOld and maxDaysOld
          isOldEnough = daysInStorage >= daysOld && daysInStorage <= maxDaysOld;
        } else {
          // Single threshold: items older than daysOld
          isOldEnough = daysInStorage >= daysOld;
        }
        
        // Check date range criteria if provided
        if (fromDate || toDate) {
          const processDateStr = processingDate;
          let inDateRange = true;
          
          if (fromDate && processDateStr < fromDate) {
            inDateRange = false;
          }
          
          if (toDate && processDateStr > toDate) {
            inDateRange = false;
          }
          
          // If date range is specified, it overrides age criteria
          if (!inDateRange) {
            console.log('❌ [DisposalService] Item filtered out - not in date range:', result.id, processDateStr, 'from:', fromDate, 'to:', toDate);
            return false;
          }
        }
        
        // Check storage issues
        let hasStorageIssues = false;
        if (inactiveStorageOnly) {
          // Only show items in inactive storage
          hasStorageIssues = storageLocation && storageLocation.status !== 'active';
          // For inactive storage only, ignore age criteria
          const isEligible = hasStorageIssues;
          return isEligible;
        } else if (includeStorageIssues) {
          // Show items with any storage issues
          hasStorageIssues = (
            !result.storage_location_id || 
            !storageLocation || 
            storageLocation.status !== 'active' ||
            (storageLocation.current_usage_kg > storageLocation.capacity_kg)
          );
        }

        const isEligible = isOldEnough || hasStorageIssues;

        console.log('🔍 [DisposalService] Item check:', {
          id: result.id,
          batchNumber: result.sorting_batch?.batch_number,
          processingDate,
          daysInStorage,
          weightGrams: result.total_weight_grams,
          isOldEnough,
          hasStorageIssues,
          storageStatus: storageLocation?.status,
          isEligible,
          inactiveStorageOnly
        });

        return isEligible;
      });

      console.log('📊 [DisposalService] Eligible items after filtering:', eligibleItems.length);

      // Transform items with better disposal reason logic
      const transformedItems = eligibleItems.map((item: any) => {
        const storageLocation = storageMap.get(item.storage_location_id);
        const processingDate = item.sorting_batch?.created_at?.split('T')[0] || 
                              item.created_at?.split('T')[0];
        
        const daysInStorage = Math.floor((new Date().getTime() - new Date(processingDate).getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine disposal reason more accurately
        let disposalReason = 'Age';
        if (!item.storage_location_id) {
          disposalReason = 'No Storage Location';
        } else if (!storageLocation) {
          disposalReason = 'Storage Not Found';
        } else if (storageLocation.status !== 'active') {
          disposalReason = 'Storage Inactive';
        } else if (storageLocation.current_usage_kg > storageLocation.capacity_kg) {
          disposalReason = 'Storage Over Capacity';
        } else if (daysInStorage >= daysOld) {
          disposalReason = 'Age';
        }
        
        return {
          sorting_result_id: item.id,
          size_class: item.size_class,
          total_pieces: item.total_pieces,
          total_weight_grams: item.total_weight_grams,
          batch_number: item.sorting_batch?.batch_number || 'BATCH-' + item.sorting_batch?.id?.substring(0, 8),
          storage_location_name: storageLocation?.name || 'No Storage Assigned',
          farmer_name: item.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown Farmer',
          processing_date: processingDate,
          days_in_storage: daysInStorage,
          disposal_reason: disposalReason,
          quality_notes: `Fish from ${item.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown Farmer'}`,
          storage_status: storageLocation?.status || 'unknown'
        };
      });

      console.log('📊 [DisposalService] Transformed items:', transformedItems.length);
      return transformedItems;

    } catch (error) {
      console.error('❌ [DisposalService] Error getting inventory for disposal:', error);
      return [];
    }
  }

  /**
   * Create a new disposal record
   */
  async createDisposal(disposalData: {
    selectedItems: string[];
    disposalReason: string;
    disposalCost: number;
    disposalNotes: string;
    disposalMethod: string;
    totalWeight: number;
  }) {
    try {
      console.log('🔍 [DisposalService] Creating disposal record...');
      console.log('📊 [DisposalService] Disposal data:', disposalData);

      // First, try to get the disposal reason ID
      let { data: disposalReason, error: reasonError } = await supabase
        .from('disposal_reasons')
        .select('id')
        .eq('name', disposalData.disposalReason)
        .single();

      // If disposal reason doesn't exist, create it
      if (reasonError) {
        console.log('🔍 [DisposalService] Disposal reason not found, creating new one:', disposalData.disposalReason);
        console.log('🔍 [DisposalService] Error details:', reasonError);
        
        const { data: newReason, error: createError } = await supabase
          .from('disposal_reasons')
          .insert({
            name: disposalData.disposalReason,
            description: `Auto-created disposal reason: ${disposalData.disposalReason}`,
            is_active: true
          })
          .select('id')
          .single();

        if (createError) {
          console.error('❌ [DisposalService] Error creating disposal reason:', createError);
          throw new Error(`Failed to create disposal reason "${disposalData.disposalReason}": ${createError.message}`);
        }

        disposalReason = newReason;
        console.log('✅ [DisposalService] Created new disposal reason:', disposalReason.id);
      }

      // Prepare disposal record data (disposal_number will be auto-generated by database)
      const disposalRecordData = {
        disposal_reason_id: disposalReason.id,
        total_weight_kg: disposalData.totalWeight,
        disposal_cost: disposalData.disposalCost,
        notes: disposalData.disposalNotes,
        status: 'completed',
        disposal_date: new Date().toISOString().split('T')[0],
        disposal_method: disposalData.disposalMethod, // Use disposal method from UI
        created_by: 'system', // Track who created the disposal record
        approved_by: 'system' // Track who approved the disposal record
      };

      console.log('🔍 [DisposalService] Disposal record data:', disposalRecordData);

      // Create the disposal record (disposal_number will be auto-generated)
      const { data: disposalRecord, error: disposalError } = await supabase
        .from('disposal_records')
        .insert(disposalRecordData)
        .select()
        .single();

      if (disposalError) {
        console.error('❌ [DisposalService] Error creating disposal record:', disposalError);
        throw disposalError;
      }

      console.log('✅ [DisposalService] Disposal record created:', disposalRecord.id);

      // Get the sorting results with all required information
      const { data: sortingResults, error: sortingError } = await supabase
        .from('sorting_results')
        .select(`
          id, 
          size_class, 
          total_weight_grams,
          storage_location_id,
          created_at,
          sorting_batch:sorting_batches(
            batch_number,
            processing_record:processing_records(
              warehouse_entry:warehouse_entries(
                farmers(name)
              )
            )
          ),
          storage_locations(name)
        `)
        .in('id', disposalData.selectedItems);

      if (sortingError) {
        console.error('❌ [DisposalService] Error fetching sorting results:', sortingError);
        throw sortingError;
      }

      // Create disposal items for each selected item with all required fields
      const disposalItems = sortingResults.map(result => {
        const processingDate = result.sorting_batch?.processing_record?.warehouse_entry?.created_at || 
                              result.created_at;
        const farmerName = result.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 
                          'Unknown Farmer';
        const storageLocationName = result.storage_locations?.name || 'Unknown Storage';
        
        return {
          disposal_record_id: disposalRecord.id,
          sorting_result_id: result.id,
          size_class: result.size_class,
          weight_kg: result.total_weight_grams / 1000, // Convert grams to kg
          batch_number: result.sorting_batch?.batch_number || 'Unknown',
          storage_location_name: storageLocationName,
          farmer_name: farmerName,
          processing_date: processingDate ? processingDate.split('T')[0] : new Date().toISOString().split('T')[0],
          quality_notes: `Disposed from ${storageLocationName} - ${disposalData.disposalReason}`,
          disposal_reason: disposalData.disposalReason,
          status: 'pending'
        };
      });

      const { error: itemsError } = await supabase
        .from('disposal_items')
        .insert(disposalItems);

      if (itemsError) {
        console.error('❌ [DisposalService] Error creating disposal items:', itemsError);
        throw itemsError;
      }

      console.log('✅ [DisposalService] Disposal items created:', disposalItems.length);

      // Update sorting results status to 'disposed'
      const { error: updateError } = await supabase
        .from('sorting_results')
        .update({ status: 'disposed' })
        .in('id', disposalData.selectedItems);

      if (updateError) {
        console.error('❌ [DisposalService] Error updating sorting results:', updateError);
        throw updateError;
      }

      console.log('✅ [DisposalService] Sorting results updated to disposed status');

      return {
        success: true,
        disposalRecord,
        message: `Successfully disposed ${disposalData.selectedItems.length} items`
      };

    } catch (error) {
      console.error('❌ [DisposalService] Error creating disposal:', error);
      console.error('❌ [DisposalService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        disposalData
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Fallback method to get inventory for disposal
   */
  private async getInventoryForDisposalFallback(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from('sorting_results')
        .select(`
          id,
          size_class,
          total_weight_grams,
          batch_number,
          storage_location_name,
          farmer_name,
          processing_date,
          quality_notes,
          storage_locations!inner(status)
        `)
        .eq('status', 'available')
        .lte('processing_date', cutoffDate.toISOString().split('T')[0])
        .gte('total_weight_grams', 0);

      if (error) throw error;

      return data?.map(item => ({
        sorting_result_id: item.id,
        size_class: item.size_class,
        total_weight_grams: item.total_weight_grams,
        batch_number: item.batch_number,
        storage_location_name: item.storage_location_name,
        storage_status: item.storage_locations?.status || 'active',
        farmer_name: item.farmer_name,
        processing_date: item.processing_date,
        days_in_storage: Math.floor((new Date().getTime() - new Date(item.processing_date).getTime()) / (1000 * 60 * 60 * 24)),
        disposal_reason: item.storage_locations?.status === 'inactive' ? 'Storage Inactive' : 'Age',
        quality_notes: item.quality_notes
      })) || [];
    } catch (error) {
      console.error('Error in fallback method:', error);
      return [];
    }
  }
}

// Export singleton instance
export const disposalService = new DisposalService();
export default disposalService;
