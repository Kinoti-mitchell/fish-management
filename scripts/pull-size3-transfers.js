#!/usr/bin/env node

/**
 * Pull Size 3 Transfer Details - Get comprehensive transfer information for Size 3 inventory
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/server.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery(queryName, query) {
  console.log(`\n=== ${queryName} ===`);
  try {
    // Use direct SQL query instead of RPC
    const { data, error } = await supabase.from('sorting_results').select(query);
    if (error) {
      console.error(`❌ Error in ${queryName}:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`❌ Exception in ${queryName}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('🐟 Pulling Size 3 Transfer Details...\n');
  
  try {
    // 1. Current Size 3 inventory in storage 1
    const currentInventoryQuery = `
      SELECT 
        sr.id,
        sr.size_class,
        sr.total_pieces as quantity,
        (sr.total_weight_grams / 1000.0) as weight_kg,
        ROUND((sr.total_weight_grams / 1000.0) / sr.total_pieces, 2) as avg_weight_per_fish,
        sr.storage_location_id,
        sl.name as storage_location,
        sr.sorting_batch_id,
        sr.transfer_source_storage_id,
        sr.transfer_source_storage_name,
        sr.transfer_id,
        sr.created_at as added_date,
        sr.updated_at
      FROM sorting_results sr
      JOIN storage_locations sl ON sr.storage_location_id = sl.id
      WHERE sl.name = 'storage 1'
      AND sr.size_class = 3;
    `;
    
    const currentInventory = await runQuery('CURRENT SIZE 3 INVENTORY', currentInventoryQuery);
    if (currentInventory && currentInventory.length > 0) {
      console.table(currentInventory);
    } else {
      console.log('No Size 3 inventory found in storage 1');
    }

    // 2. Batch information for Size 3
    const batchInfoQuery = `
      SELECT 
        sb.id as batch_id,
        sb.batch_number,
        sb.created_at as batch_created_at,
        sb.status as batch_status,
        pr.processing_date,
        we.farmer_id,
        f.name as farmer_name,
        sr.size_class,
        sr.total_pieces,
        (sr.total_weight_grams / 1000.0) as weight_kg
      FROM sorting_results sr
      JOIN storage_locations sl ON sr.storage_location_id = sl.id
      LEFT JOIN sorting_batches sb ON sr.sorting_batch_id = sb.id
      LEFT JOIN processing_records pr ON sb.processing_record_id = pr.id
      LEFT JOIN warehouse_entries we ON pr.warehouse_entry_id = we.id
      LEFT JOIN farmers f ON we.farmer_id = f.id
      WHERE sl.name = 'storage 1'
      AND sr.size_class = 3;
    `;
    
    const batchInfo = await runQuery('SIZE 3 BATCH INFORMATION', batchInfoQuery);
    if (batchInfo && batchInfo.length > 0) {
      console.table(batchInfo);
    }

    // 3. All transfers involving Size 3
    const transferHistoryQuery = `
      SELECT 
        t.id as transfer_id,
        t.from_storage_name,
        t.to_storage_name,
        t.size_class,
        t.quantity,
        t.weight_kg,
        t.status,
        t.notes,
        t.approved_at,
        t.completed_at,
        t.created_at as transfer_created_at,
        CASE 
          WHEN t.to_storage_name = 'storage 1' THEN 'INCOMING to storage 1'
          WHEN t.from_storage_name = 'storage 1' THEN 'OUTGOING from storage 1'
          ELSE 'OTHER'
        END as transfer_direction
      FROM transfers t
      WHERE t.size_class = 3
      AND (t.from_storage_name = 'storage 1' OR t.to_storage_name = 'storage 1')
      ORDER BY t.created_at DESC;
    `;
    
    const transferHistory = await runQuery('SIZE 3 TRANSFER HISTORY', transferHistoryQuery);
    if (transferHistory && transferHistory.length > 0) {
      console.table(transferHistory);
    } else {
      console.log('No transfer history found for Size 3');
    }

    // 4. Completed transfers to storage 1
    const completedTransfersQuery = `
      SELECT 
        t.id as transfer_id,
        t.from_storage_name as source_storage,
        t.to_storage_name as destination_storage,
        t.size_class,
        t.quantity as transferred_quantity,
        t.weight_kg as transferred_weight,
        t.status,
        t.notes,
        t.approved_at,
        t.completed_at,
        t.created_at as transfer_date,
        EXTRACT(DAYS FROM (NOW() - t.completed_at)) as days_since_transfer
      FROM transfers t
      WHERE t.to_storage_name = 'storage 1'
      AND t.size_class = 3
      AND t.status = 'completed'
      ORDER BY t.completed_at DESC;
    `;
    
    const completedTransfers = await runQuery('COMPLETED TRANSFERS TO STORAGE 1', completedTransfersQuery);
    if (completedTransfers && completedTransfers.length > 0) {
      console.table(completedTransfers);
    } else {
      console.log('No completed transfers found for Size 3 to storage 1');
    }

    // 5. Pending transfers
    const pendingTransfersQuery = `
      SELECT 
        t.id as transfer_id,
        t.from_storage_name,
        t.to_storage_name,
        t.size_class,
        t.quantity,
        t.weight_kg,
        t.status,
        t.notes,
        t.created_at as request_date,
        EXTRACT(DAYS FROM (NOW() - t.created_at)) as days_pending
      FROM transfers t
      WHERE t.size_class = 3
      AND t.status = 'pending'
      ORDER BY t.created_at DESC;
    `;
    
    const pendingTransfers = await runQuery('PENDING TRANSFERS', pendingTransfersQuery);
    if (pendingTransfers && pendingTransfers.length > 0) {
      console.table(pendingTransfers);
    } else {
      console.log('No pending transfers found for Size 3');
    }

    // 6. Transfer summary
    const summaryQuery = `
      SELECT 
        'Total Transfers' as metric,
        COUNT(*) as count,
        SUM(t.weight_kg) as total_weight_kg,
        SUM(t.quantity) as total_quantity
      FROM transfers t
      WHERE t.size_class = 3
      AND (t.from_storage_name = 'storage 1' OR t.to_storage_name = 'storage 1')
      
      UNION ALL
      
      SELECT 
        'Completed Transfers to Storage 1' as metric,
        COUNT(*) as count,
        SUM(t.weight_kg) as total_weight_kg,
        SUM(t.quantity) as total_quantity
      FROM transfers t
      WHERE t.size_class = 3
      AND t.to_storage_name = 'storage 1'
      AND t.status = 'completed'
      
      UNION ALL
      
      SELECT 
        'Pending Transfers' as metric,
        COUNT(*) as count,
        SUM(t.weight_kg) as total_weight_kg,
        SUM(t.quantity) as total_quantity
      FROM transfers t
      WHERE t.size_class = 3
      AND t.status = 'pending';
    `;
    
    const summary = await runQuery('TRANSFER SUMMARY', summaryQuery);
    if (summary && summary.length > 0) {
      console.table(summary);
    }

    // 7. Inventory source analysis
    const sourceAnalysisQuery = `
      SELECT 
        CASE 
          WHEN sr.transfer_source_storage_name IS NOT NULL THEN 
            'Transferred from: ' || sr.transfer_source_storage_name
          ELSE 'Direct from processing (no transfer)'
        END as inventory_source,
        COUNT(*) as record_count,
        SUM(sr.total_pieces) as total_pieces,
        SUM(sr.total_weight_grams) / 1000.0 as total_weight_kg,
        MIN(sr.created_at) as earliest_date,
        MAX(sr.created_at) as latest_date
      FROM sorting_results sr
      JOIN storage_locations sl ON sr.storage_location_id = sl.id
      WHERE sl.name = 'storage 1'
      AND sr.size_class = 3
      GROUP BY 
        CASE 
          WHEN sr.transfer_source_storage_name IS NOT NULL THEN 
            'Transferred from: ' || sr.transfer_source_storage_name
          ELSE 'Direct from processing (no transfer)'
        END
      ORDER BY total_weight_kg DESC;
    `;
    
    const sourceAnalysis = await runQuery('INVENTORY SOURCE ANALYSIS', sourceAnalysisQuery);
    if (sourceAnalysis && sourceAnalysis.length > 0) {
      console.table(sourceAnalysis);
    }

    console.log('\n🎉 Size 3 Transfer Analysis Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
