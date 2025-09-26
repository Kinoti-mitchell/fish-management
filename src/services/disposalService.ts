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
   * Get inventory items eligible for disposal
   */
  async getInventoryForDisposal(daysOld = 30, includeStorageIssues = true) {
    try {
      console.log('🔍 [DisposalService] Getting inventory for disposal with direct query...');
      
      // Use direct query like inventory service instead of RPC function
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      console.log('📅 [DisposalService] Cutoff date for disposal:', cutoffDate.toISOString().split('T')[0]);
      console.log('📅 [DisposalService] Days old threshold:', daysOld);
      
      const { data, error } = await supabase
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
          ),
          storage_locations(
            id,
            name,
            status,
            capacity_kg,
            current_usage_kg
          )
        `)
        .not('storage_location_id', 'is', null)
        .gt('total_weight_grams', 0)
        .gt('total_pieces', 0)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [DisposalService] Direct query error:', error);
        throw error;
      }

      console.log('📊 [DisposalService] Raw data from direct query:', data?.length || 0, 'items');

      // Filter for completed batches and apply disposal criteria
      console.log('🔍 [DisposalService] Filtering items with criteria:', { daysOld, includeStorageIssues });
      
      const eligibleItems = (data || []).filter((result: any) => {
        console.log('🔍 [DisposalService] Checking item:', {
          id: result.id,
          batchStatus: result.sorting_batch?.status,
          hasProcessingRecord: !!result.sorting_batch?.processing_record,
          processingDate: result.sorting_batch?.processing_record?.processing_date,
          batchCreatedAt: result.sorting_batch?.created_at,
          storageStatus: result.storage_locations?.status,
          totalPieces: result.total_pieces,
          totalWeight: result.total_weight_grams
        });

        // Must be from completed batches
        if (!result.sorting_batch || result.sorting_batch.status !== 'completed') {
          console.log('❌ [DisposalService] Item filtered out - batch not completed:', result.sorting_batch?.status);
          return false;
        }

        // Get processing date
        const processingDate = result.sorting_batch?.processing_record?.processing_date || 
                              result.sorting_batch?.created_at?.split('T')[0];
        
        if (!processingDate) {
          console.log('❌ [DisposalService] Item filtered out - no processing date');
          return false;
        }

        const processDate = new Date(processingDate);
        const daysInStorage = Math.floor((new Date().getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if item meets disposal criteria
        const isOldEnough = daysInStorage >= daysOld;
        const hasStorageIssues = includeStorageIssues && (
          !result.storage_locations || 
          result.storage_locations.status !== 'active' ||
          (result.storage_locations.current_usage_kg > result.storage_locations.capacity_kg)
        );

        console.log('📊 [DisposalService] Item criteria check:', {
          daysInStorage,
          isOldEnough,
          hasStorageIssues,
          storageStatus: result.storage_locations?.status,
          eligible: isOldEnough || hasStorageIssues
        });

        return isOldEnough || hasStorageIssues;
      });

      console.log('📊 [DisposalService] Eligible items after filtering:', eligibleItems.length);

      // If no items found with current criteria, show all items for debugging
      let itemsToTransform = eligibleItems;
      if (eligibleItems.length === 0 && data && data.length > 0) {
        console.log('⚠️ [DisposalService] No items found with current criteria, showing all items for debugging');
        itemsToTransform = data.filter((result: any) => 
          result.sorting_batch && result.sorting_batch.status === 'completed'
        );
        console.log('📊 [DisposalService] Showing all completed items:', itemsToTransform.length);
      }

      // Transform to match expected format
      const transformedItems = itemsToTransform.map((item: any) => ({
        sorting_result_id: item.id,
        size_class: item.size_class,
        total_pieces: item.total_pieces,
        total_weight_grams: item.total_weight_grams,
        batch_number: item.sorting_batch?.batch_number || 'BATCH-' + item.sorting_batch?.id?.substring(0, 8),
        storage_location_name: item.storage_locations?.name || 'Unknown Storage',
        farmer_name: item.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown Farmer',
        processing_date: item.sorting_batch?.processing_record?.processing_date || 
                        item.sorting_batch?.created_at?.split('T')[0],
        days_in_storage: Math.floor((new Date().getTime() - new Date(
          item.sorting_batch?.processing_record?.processing_date || 
          item.sorting_batch?.created_at?.split('T')[0]
        ).getTime()) / (1000 * 60 * 60 * 24)),
        disposal_reason: item.storage_locations?.status !== 'active' ? 'Storage Inactive' : 'Age',
        quality_notes: `Fish from ${item.sorting_batch?.processing_record?.warehouse_entry?.farmers?.name || 'Unknown Farmer'}`
      }));

      console.log('📊 [DisposalService] Transformed items:', transformedItems.length);
      return transformedItems;

    } catch (error) {
      console.error('❌ [DisposalService] Error getting inventory for disposal:', error);
      return [];
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
