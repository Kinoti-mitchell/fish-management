import { supabase } from '../lib/supabaseClient';

/**
 * Generates a unique batch number for sorting batches
 * Format: Batch0001, Batch0002, Batch0003, etc.
 * Optimized to use only one database query for better performance
 */
export async function generateUniqueBatchNumber(): Promise<string> {
  try {
    // Get the highest existing batch number in one query
    const { data: maxBatch, error } = await supabase
      .from('sorting_batches')
      .select('batch_number')
      .not('batch_number', 'is', null)
      .order('batch_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching existing batch numbers:', error.message);
      
      // Check if it's a table not found error
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.warn('sorting_batches table does not exist, using timestamp-based batch number');
        return `Batch${Date.now().toString().slice(-6)}`;
      }
      
      // Fallback: generate based on timestamp if database query fails
      return `Batch${Date.now().toString().slice(-6)}`;
    }

    // Extract numeric part from the highest batch number
    let nextNumber = 1;
    if (maxBatch?.batch_number) {
      const match = maxBatch.batch_number.match(/^Batch(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format with leading zeros (4 digits)
    const batchNumber = `Batch${nextNumber.toString().padStart(4, '0')}`;
    
    return batchNumber;
  } catch (error) {
    console.error('Error generating batch number:', error);
    // Fallback: generate based on timestamp
    return `Batch${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Generates a unique entry code for warehouse entries
 * Format: WE001, WE002, WE003, etc.
 * Optimized to use only one database query for better performance
 */
export async function generateUniqueEntryCode(): Promise<string> {
  try {
    // Get the highest existing entry code in one query
    const { data: maxEntry, error } = await supabase
      .from('warehouse_entries')
      .select('entry_code')
      .not('entry_code', 'is', null)
      .order('entry_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching existing entry codes:', error.message);
      // Fallback: generate based on timestamp if database query fails
      return `WE${Date.now().toString().slice(-6)}`;
    }

    // Extract numeric part from the highest entry code
    let nextNumber = 1;
    if (maxEntry?.entry_code) {
      const match = maxEntry.entry_code.match(/^WE(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Generate the entry code
    const entryCode = `WE${nextNumber.toString().padStart(3, '0')}`;

    return entryCode;
  } catch (error) {
    console.error('Error generating unique entry code:', error);
    // Fallback: use timestamp-based code
    return `WE${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Gets the entry code for a warehouse entry, generating one if it doesn't exist
 */
export async function getOrGenerateEntryCode(entryId: string): Promise<string> {
  try {
    // First, try to get existing entry code
    const { data: entry, error } = await supabase
      .from('warehouse_entries')
      .select('entry_code')
      .eq('id', entryId)
      .single();

    if (error) {
      console.warn('Error fetching entry code:', error.message);
      return await generateUniqueEntryCode();
    }

    // If entry code exists, return it
    if (entry?.entry_code) {
      return entry.entry_code;
    }

    // If no entry code exists, generate a new one and update the database
    const newEntryCode = await generateUniqueEntryCode();
    
    const { error: updateError } = await supabase
      .from('warehouse_entries')
      .update({ entry_code: newEntryCode })
      .eq('id', entryId);

    if (updateError) {
      console.warn('Error updating entry code:', updateError.message);
    }

    return newEntryCode;
  } catch (error) {
    console.error('Error getting/generating entry code:', error);
    return await generateUniqueEntryCode();
  }
}

/**
 * Generates a unique processing code for processing records
 * Format: PR001, PR002, PR003, etc.
 * Optimized to use only one database query for better performance
 */
export async function generateUniqueProcessingCode(): Promise<string> {
  try {
    // Get the highest existing processing code in one query
    const { data: maxRecord, error } = await supabase
      .from('processing_records')
      .select('processing_code')
      .not('processing_code', 'is', null)
      .order('processing_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching existing processing codes:', error.message);
      // Fallback: generate based on timestamp if database query fails
      return `PR${Date.now().toString().slice(-6)}`;
    }

    // Extract numeric part from the highest processing code
    let nextNumber = 1;
    if (maxRecord?.processing_code) {
      const match = maxRecord.processing_code.match(/^PR(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Generate the processing code
    const processingCode = `PR${nextNumber.toString().padStart(3, '0')}`;

    return processingCode;
  } catch (error) {
    console.error('Error generating unique processing code:', error);
    // Fallback: use timestamp-based code
    return `PR${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Gets the processing code for a processing record, generating one if it doesn't exist
 */
export async function getOrGenerateProcessingCode(recordId: string): Promise<string> {
  try {
    // First, try to get existing processing code
    const { data: record, error } = await supabase
      .from('processing_records')
      .select('processing_code')
      .eq('id', recordId)
      .single();

    if (error) {
      console.warn('Error fetching processing code:', error.message);
      return await generateUniqueProcessingCode();
    }

    // If processing code exists, return it
    if (record?.processing_code) {
      return record.processing_code;
    }

    // If no processing code exists, generate a new one and update the database
    const newProcessingCode = await generateUniqueProcessingCode();
    
    const { error: updateError } = await supabase
      .from('processing_records')
      .update({ processing_code: newProcessingCode })
      .eq('id', recordId);

    if (updateError) {
      console.warn('Error updating processing code:', updateError.message);
    }

    return newProcessingCode;
  } catch (error) {
    console.error('Error getting/generating processing code:', error);
    return await generateUniqueProcessingCode();
  }
}

/**
 * Validates that an entry code is unique in the database
 */
export async function validateEntryCodeUniqueness(entryCode: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('warehouse_entries')
      .select('id')
      .eq('entry_code', entryCode);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.warn('Error validating entry code uniqueness:', error.message);
      return false; // Assume not unique if we can't check
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error validating entry code uniqueness:', error);
    return false;
  }
}

/**
 * Validates that a processing code is unique in the database
 */
export async function validateProcessingCodeUniqueness(processingCode: string, excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from('processing_records')
      .select('id')
      .eq('processing_code', processingCode);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.warn('Error validating processing code uniqueness:', error.message);
      return false; // Assume not unique if we can't check
    }

    return !data || data.length === 0;
  } catch (error) {
    console.error('Error validating processing code uniqueness:', error);
    return false;
  }
}
