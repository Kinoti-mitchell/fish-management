// Improved Disposal Service with Better Filtering
// This fixes the disposal filter issues

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

class ImprovedDisposalService {
  /**
   * Get inventory items eligible for disposal with improved filtering
   */
  async getInventoryForDisposal(daysOld = 30, includeStorageIssues = true) {
    try {
      console.log('🔍 [ImprovedDisposalService] Getting inventory for disposal...');
      console.log('📊 [ImprovedDisposalService] Filter criteria:', { daysOld, includeStorageIssues });
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      console.log('📅 [ImprovedDisposalService] Cutoff date:', cutoffDateStr);

      // Get storage locations first
      const { data: storageLocations, error: storageError } = await supabase
        .from('storage_locations')
        .select('id, name, status, capacity_kg, current_usage_kg')
        .order('name');

      if (storageError) {
        console.error('❌ [ImprovedDisposalService] Storage locations error:', storageError);
        throw storageError;
      }

      console.log('📍 [ImprovedDisposalService] Storage locations found:', storageLocations?.length || 0);

      // Create storage map
      const storageMap = new Map();
      storageLocations?.forEach(location => {
        storageMap.set(location.id, location);
      });

      // Build the main query with better filtering
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
        .gt('total_weight_grams', 0);

      // Apply batch status filter
      query = query.eq('sorting_batch.status', 'completed');

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [ImprovedDisposalService] Query error:', error);
        throw error;
      }

      console.log('📊 [ImprovedDisposalService] Raw query results:', data?.length || 0, 'items');

      // Apply filtering logic
      const eligibleItems = (data || []).filter((result: any) => {
        const storageLocation = storageMap.get(result.storage_location_id);
        
        // Get processing date
        const processingDate = result.sorting_batch?.processing_record?.processing_date || 
                              result.sorting_batch?.created_at?.split('T')[0];
        
        if (!processingDate) {
          console.log('❌ [ImprovedDisposalService] Item filtered out - no processing date:', result.id);
          return false;
        }

        const processDate = new Date(processingDate);
        const daysInStorage = Math.floor((new Date().getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check age criteria
        const isOldEnough = daysOld === 0 || daysInStorage >= daysOld;
        
        // Check storage issues
        const hasStorageIssues = includeStorageIssues && (
          !result.storage_location_id || 
          !storageLocation || 
          storageLocation.status !== 'active' ||
          (storageLocation.current_usage_kg > storageLocation.capacity_kg)
        );

        const isEligible = isOldEnough || hasStorageIssues;

        console.log('🔍 [ImprovedDisposalService] Item check:', {
          id: result.id,
          batchNumber: result.sorting_batch?.batch_number,
          processingDate,
          daysInStorage,
          isOldEnough,
          hasStorageIssues,
          storageStatus: storageLocation?.status,
          isEligible
        });

        return isEligible;
      });

      console.log('📊 [ImprovedDisposalService] Eligible items after filtering:', eligibleItems.length);

      // Transform items
      const transformedItems = eligibleItems.map((item: any) => {
        const storageLocation = storageMap.get(item.storage_location_id);
        const processingDate = item.sorting_batch?.processing_record?.processing_date || 
                              item.sorting_batch?.created_at?.split('T')[0];
        
        const daysInStorage = Math.floor((new Date().getTime() - new Date(processingDate).getTime()) / (1000 * 60 * 60 * 24));
        
        let disposalReason = 'Age';
        if (!item.storage_location_id) {
          disposalReason = 'No Storage Location';
        } else if (!storageLocation) {
          disposalReason = 'Storage Not Found';
        } else if (storageLocation.status !== 'active') {
          disposalReason = 'Storage Inactive';
        } else if (storageLocation.current_usage_kg > storageLocation.capacity_kg) {
          disposalReason = 'Storage Over Capacity';
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

      console.log('📊 [ImprovedDisposalService] Transformed items:', transformedItems.length);
      return transformedItems;

    } catch (error) {
      console.error('❌ [ImprovedDisposalService] Error getting inventory for disposal:', error);
      return [];
    }
  }

  /**
   * Get disposal statistics
   */
  async getDisposalStats(): Promise<DisposalStats> {
    try {
      console.log('🔍 [ImprovedDisposalService] Fetching disposal statistics...');

      const { data: disposalRecords, error: disposalError } = await supabase
        .from('disposal_records')
        .select(`
          *,
          disposal_reason:disposal_reasons(name)
        `)
        .order('created_at', { ascending: false });

      if (disposalError) {
        console.error('❌ [ImprovedDisposalService] Error fetching disposal records:', disposalError);
        throw disposalError;
      }

      // Calculate stats
      const totalDisposals = disposalRecords?.length || 0;
      const totalDisposedWeight = disposalRecords?.reduce((sum, record) => 
        sum + (record.total_weight_kg || 0), 0) || 0;
      const totalDisposalCost = disposalRecords?.reduce((sum, record) => 
        sum + (record.disposal_cost || 0), 0) || 0;

      const pendingDisposals = disposalRecords?.filter(record => 
        record.status === 'pending').length || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentDisposals = disposalRecords?.filter(record => 
        new Date(record.created_at) >= sevenDaysAgo).length || 0;

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

      const reasonCounts: { [key: string]: number } = {};
      disposalRecords?.forEach(record => {
        const reason = record.disposal_reason?.name || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      
      const topDisposalReason = Object.keys(reasonCounts).reduce((a, b) => 
        reasonCounts[a] > reasonCounts[b] ? a : b, 'Age');

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

      console.log('📊 [ImprovedDisposalService] Calculated stats:', stats);
      return stats;

    } catch (error) {
      console.error('❌ [ImprovedDisposalService] Error getting disposal stats:', error);
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
   * Get disposal records with pagination
   */
  async getDisposalRecords(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('disposal_records')
        .select(`
          *,
          disposal_reason:disposal_reasons(name)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching disposal records:', error);
      return [];
    }
  }
}

// Export singleton instance
export const improvedDisposalService = new ImprovedDisposalService();
export default improvedDisposalService;
