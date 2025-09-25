/**
 * Sorting Service
 * 
 * This service handles the sorting workflow between Processing and Inventory.
 * Fish must be sorted into size classes 0-10 before being stored in inventory.
 * 
 * Key Features:
 * - Configurable size class thresholds
 * - Batch-based sorting operations
 * - Integration with processing records
 * - Validation before inventory storage
 */

import { supabase, handleSupabaseError, withRetry } from '../lib/supabaseClient';

// Types for sorting operations
export interface SizeClassThreshold {
  id: string;
  class_number: number;
  min_weight_grams: number;
  max_weight_grams: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SortingBatch {
  id: string;
  processing_record_id: string;
  batch_number: string;
  total_weight_grams: number;
  total_pieces: number;
  sorting_date: string;
  sorted_by?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  notes?: string;
  size_distribution?: Record<string, number>;
  storage_location_id?: string;
  created_at: string;
  updated_at: string;
  // Related data
  processing_record?: {
    id: string;
    processing_date: string;
    post_processing_weight: number;
    ready_for_dispatch_count: number;
  };
  sorted_by_user?: {
    id: string;
    email: string;
  };
}

export interface SortedFishItem {
  id: string;
  sorting_batch_id: string;
  size_class: number;
  weight_grams: number;
  length_cm?: number;
  grade?: 'A' | 'B' | 'C';
  quality_notes?: string;
  created_at: string;
}

export interface SortingResult {
  id: string;
  sorting_batch_id: string;
  size_class: number;
  total_pieces: number;
  total_weight_grams: number;
  average_weight_grams: number;
  grade_distribution: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface CreateSortingBatchData {
  processing_record_id: string;
  batch_number: string;
  notes?: string;
  storage_location_id?: string;
  size_distribution?: Record<string, number>;
}

export interface AddSortedFishItemData {
  sorting_batch_id: string;
  weight_grams: number;
  length_cm?: number;
  grade?: 'A' | 'B' | 'C';
  quality_notes?: string;
  storage_location_id?: string;
}

export interface SortingSummary {
  batch_id: string;
  batch_number: string;
  total_items: number;
  total_weight: number;
  size_class_distribution: Record<number, {
    pieces: number;
    weight: number;
    average_weight: number;
  }>;
  grade_distribution: Record<string, number>;
  completion_percentage: number;
}

class SortingService {
  /**
   * Get all size class thresholds
   */
  async getSizeClassThresholds(): Promise<SizeClassThreshold[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('size_class_thresholds')
          .select('*')
          .eq('is_active', true)
          .order('class_number');
      });
      
      if (error) {
        console.warn('Permission denied for size_class_thresholds, returning empty array');
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn('Error fetching size class thresholds:', error);
      return [];
    }
  }

  /**
   * Update size class thresholds (admin only)
   */
  async updateSizeClassThresholds(thresholds: Partial<SizeClassThreshold>[]): Promise<SizeClassThreshold[]> {
    try {
      const updates = thresholds.map(threshold => ({
        ...threshold,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('size_class_thresholds')
          .upsert(updates)
          .select();
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating size class thresholds'));
    }
  }

  /**
   * Get size class for a given weight
   */
  async getSizeClassForWeight(weight_grams: number): Promise<number> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_size_class_for_weight', {
          weight_grams: weight_grams
        });
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'determining size class for weight'));
    }
  }

  /**
   * Create a new sorting batch from a processing record
   */
  async createSortingBatch(batchData: CreateSortingBatchData): Promise<SortingBatch> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('create_sorting_batch', {
          p_processing_record_id: batchData.processing_record_id,
          p_batch_number: batchData.batch_number,
          p_sorted_by: null, // Will be set by the current user
          p_storage_location_id: batchData.storage_location_id || null
        });
      });
      
      if (error) throw error;

      // Get the created batch with related data
      const { data: batch, error: fetchError } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select(`
            *,
            processing_record:processing_records(
              id,
              processing_date,
              post_processing_weight,
              ready_for_dispatch_count,
              processing_code
            )
          `)
          .eq('id', data)
          .single();
      });
      
      if (fetchError) throw fetchError;
      return batch;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'creating sorting batch'));
    }
  }

  /**
   * Get sorting batches with optional filters
   */
  async getSortingBatches(filters?: {
    status?: string;
    processing_record_id?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<SortingBatch[]> {
    try {
      let query = supabase
        .from('sorting_batches')
        .select(`
          *,
          processing_record:processing_records(
            id,
            processing_date,
            post_processing_weight,
            ready_for_dispatch_count,
            processing_code,
            fish_type,
            grading_results,
            final_value,
            processing_yield,
            processing_waste,
            size_distribution,
            total_pieces,
            warehouse_entry:warehouse_entries(
              id,
              farmer_id,
              farmer:farmers(
                id,
                name,
                phone,
                location,
                rating
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.processing_record_id) {
        query = query.eq('processing_record_id', filters.processing_record_id);
      }
      if (filters?.date_from) {
        query = query.gte('sorting_date', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('sorting_date', filters.date_to);
      }
      
      // Add limit to prevent loading too many records at once
      const limit = filters?.limit || 50;
      query = query.limit(limit);

      const { data, error } = await withRetry(async () => query);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching sorting batches'));
    }
  }

  /**
   * Get a specific sorting batch with results
   */
  async getSortingBatch(batchId: string): Promise<SortingBatch & { results: SortingResult[] }> {
    try {
      const { data: batch, error: batchError } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select(`
            *,
            processing_record:processing_records(
              id,
              processing_date,
              post_processing_weight,
              ready_for_dispatch_count,
              processing_code,
              fish_type,
              grading_results,
              final_value,
              processing_yield,
              processing_waste,
              size_distribution,
              total_pieces,
              warehouse_entry:warehouse_entries(
                id,
                farmer_id,
                farmer:farmers(
                  id,
                  name,
                  phone,
                  location,
                  rating
                )
              )
            )
          `)
          .eq('id', batchId)
          .single();
      });
      
      if (batchError) throw batchError;

      const { data: results, error: resultsError } = await withRetry(async () => {
        return await supabase
          .from('sorting_results')
          .select('*')
          .eq('sorting_batch_id', batchId)
          .order('size_class');
      });
      
      if (resultsError) throw resultsError;

      return {
        ...batch,
        results: results || []
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching sorting batch'));
    }
  }

  /**
   * Add a sorted fish item to a batch
   */
  async addSortedFishItem(itemData: AddSortedFishItemData): Promise<SortedFishItem> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('add_sorted_fish_item', {
          p_sorting_batch_id: itemData.sorting_batch_id,
          p_weight_grams: itemData.weight_grams,
          p_length_cm: itemData.length_cm,
          p_grade: itemData.grade,
          p_quality_notes: itemData.quality_notes,
          p_storage_location_id: itemData.storage_location_id || null
        });
      });
      
      if (error) throw error;

      // Get the created item
      const { data: item, error: fetchError } = await withRetry(async () => {
        return await supabase
          .from('sorted_fish_items')
          .select('*')
          .eq('id', data)
          .single();
      });
      
      if (fetchError) throw fetchError;
      return item;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'adding sorted fish item'));
    }
  }

  /**
   * Update a sorting batch
   */
  async updateSortingBatch(batchId: string, updateData: Partial<SortingBatch>): Promise<SortingBatch> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId)
          .select(`
            *,
            processing_record:processing_records(
              id,
              processing_date,
              post_processing_weight,
              ready_for_dispatch_count,
              processing_code
            )
          `)
          .single();
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'updating sorting batch'));
    }
  }

  /**
   * Complete a sorting batch
   */
  async completeSortingBatch(batchId: string): Promise<boolean> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('complete_sorting_batch', {
          p_sorting_batch_id: batchId
        });
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'completing sorting batch'));
    }
  }

  /**
   * Get sorting results formatted for inventory integration
   */
  async getSortingResultsForInventory(batchId: string): Promise<SortingResult[]> {
    try {
      const { data, error } = await withRetry(async () => {
        return await supabase.rpc('get_sorting_results_for_inventory', {
          p_sorting_batch_id: batchId
        });
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching sorting results for inventory'));
    }
  }

  /**
   * Get sorting summary for a batch
   */
  async getSortingSummary(batchId: string): Promise<SortingSummary> {
    try {
      const batch = await this.getSortingBatch(batchId);
      
      const sizeClassDistribution: Record<number, {
        pieces: number;
        weight: number;
        average_weight: number;
      }> = {};
      
      const gradeDistribution: Record<string, number> = {};
      let totalItems = 0;
      let totalWeight = 0;

      batch.results.forEach(result => {
        sizeClassDistribution[result.size_class] = {
          pieces: result.total_pieces,
          weight: result.total_weight_grams,
          average_weight: result.average_weight_grams
        };
        
        totalItems += result.total_pieces;
        totalWeight += result.total_weight_grams;

        // Aggregate grade distribution
        Object.entries(result.grade_distribution).forEach(([grade, count]) => {
          gradeDistribution[grade] = (gradeDistribution[grade] || 0) + count;
        });
      });

      const completionPercentage = batch.total_pieces > 0 
        ? Math.round((totalItems / batch.total_pieces) * 100)
        : 0;

      return {
        batch_id: batch.id,
        batch_number: batch.batch_number,
        total_items: totalItems,
        total_weight: totalWeight,
        size_class_distribution: sizeClassDistribution,
        grade_distribution: gradeDistribution,
        completion_percentage: completionPercentage
      };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'generating sorting summary'));
    }
  }

  /**
   * Validate that a processing record can be sorted
   */
  async validateProcessingRecordForSorting(processingRecordId: string): Promise<{
    canSort: boolean;
    reason?: string;
    processingRecord?: any;
  }> {
    try {
      // Check if processing record exists and is complete
      const { data: processingRecord, error } = await withRetry(async () => {
        return await supabase
          .from('processing_records')
          .select('*')
          .eq('id', processingRecordId)
          .single();
      });
      
      if (error) throw error;
      
      if (!processingRecord) {
        return { canSort: false, reason: 'Processing record not found' };
      }

      // Check if already sorted
      const { data: existingBatches, error: batchError } = await withRetry(async () => {
        return await supabase
          .from('sorting_batches')
          .select('id, status')
          .eq('processing_record_id', processingRecordId)
          .eq('status', 'completed');
      });
      
      if (batchError) {
        throw batchError;
      }
      
      const existingBatch = existingBatches && existingBatches.length > 0 ? existingBatches[0] : null;
      
      if (existingBatch) {
        return { canSort: false, reason: 'Processing record already sorted' };
      }

      // Check if processing record has valid data
      if (!processingRecord.post_processing_weight || processingRecord.post_processing_weight <= 0) {
        return { canSort: false, reason: 'Invalid post-processing weight' };
      }

      if (!processingRecord.ready_for_dispatch_count || processingRecord.ready_for_dispatch_count <= 0) {
        return { canSort: false, reason: 'No fish ready for dispatch' };
      }

      return { canSort: true, processingRecord };
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'validating processing record for sorting'));
    }
  }

  /**
   * Get processing records that are ready for sorting
   */
  async getProcessingRecordsReadyForSorting(): Promise<any[]> {
    try {
      // Use a single optimized query with LEFT JOIN to check for existing sorting batches
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('processing_records')
          .select(`
            *,
            warehouse_entry:warehouse_entries(
              id,
              entry_date,
              total_weight,
              farmer_id,
              entry_code,
              farmer:farmers(
                id,
                name,
                phone,
                location,
                rating
              )
            ),
            sorting_batches!left(
              id,
              status
            )
          `)
          .gt('post_processing_weight', 0)
          .order('processing_date', { ascending: false });
      });
      
      if (error) throw error;
      
      // Filter out records that are already sorted (have completed sorting batches)
      const records = data || [];
      const unsortedRecords = records.filter(record => {
        // Check if any sorting batch is completed
        const hasCompletedBatch = record.sorting_batches?.some((batch: any) => batch.status === 'completed');
        return !hasCompletedBatch;
      });
      
      return unsortedRecords;
    } catch (error) {
      throw new Error(handleSupabaseError(error, 'fetching processing records ready for sorting'));
    }
  }
}

// Export singleton instance
export const sortingService = new SortingService();
export default sortingService;
