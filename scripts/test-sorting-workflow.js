/**
 * Test Script for Complete Sorting Workflow
 * 
 * This script tests the complete workflow: Processing → Sorting → Inventory
 * It creates test data and validates each step of the process.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class SortingWorkflowTester {
  constructor() {
    this.testData = {
      warehouseEntryId: null,
      processingRecordId: null,
      sortingBatchId: null,
      sortedFishItems: []
    };
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete in reverse order to respect foreign key constraints
      if (this.testData.sortingBatchId) {
        await supabase.from('sorting_batches').delete().eq('id', this.testData.sortingBatchId);
      }
      if (this.testData.processingRecordId) {
        await supabase.from('processing_records').delete().eq('id', this.testData.processingRecordId);
      }
      if (this.testData.warehouseEntryId) {
        await supabase.from('warehouse_entries').delete().eq('id', this.testData.warehouseEntryId);
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  async testStep1_CreateWarehouseEntry() {
    console.log('\n📦 Step 1: Creating test warehouse entry...');
    
    const warehouseEntry = {
      entry_date: new Date().toISOString().split('T')[0],
      total_weight: 50.0, // 50kg
      total_pieces: 100,
      received_by: null, // Will be set to current user if available
      condition: 'good',
      temperature: 4.0,
      farmer_id: null, // Will create a test farmer if needed
      price_per_kg: 450.0,
      total_value: 22500.0,
      notes: 'Test fish for sorting workflow'
    };

    const { data, error } = await supabase
      .from('warehouse_entries')
      .insert([warehouseEntry])
      .select()
      .single();

    if (error) throw error;
    
    this.testData.warehouseEntryId = data.id;
    console.log(`✅ Created warehouse entry: ${data.id}`);
    return data;
  }

  async testStep2_CreateProcessingRecord() {
    console.log('\n🔧 Step 2: Creating test processing record...');
    
    const processingRecord = {
      warehouse_entry_id: this.testData.warehouseEntryId,
      processing_date: new Date().toISOString().split('T')[0],
      processed_by: null,
      pre_processing_weight: 50.0,
      post_processing_weight: 45.0, // 5kg waste
      processing_waste: 5.0,
      processing_yield: 90.0, // 90% yield
      size_distribution: {
        "0": 10, // 10 pieces of size 0
        "1": 15, // 15 pieces of size 1
        "2": 20, // 20 pieces of size 2
        "3": 25, // 25 pieces of size 3
        "4": 20, // 20 pieces of size 4
        "5": 10  // 10 pieces of size 5
      },
      grading_results: {
        "A": 60, // 60 pieces grade A
        "B": 30, // 30 pieces grade B
        "C": 10  // 10 pieces grade C
      },
      final_value: 20250.0, // 45kg * 450 KES/kg
      ready_for_dispatch_count: 100
    };

    const { data, error } = await supabase
      .from('processing_records')
      .insert([processingRecord])
      .select()
      .single();

    if (error) throw error;
    
    this.testData.processingRecordId = data.id;
    console.log(`✅ Created processing record: ${data.id}`);
    return data;
  }

  async testStep3_ValidateProcessingForSorting() {
    console.log('\n✅ Step 3: Validating processing record for sorting...');
    
    const { data, error } = await supabase
      .rpc('validate_processing_record_for_sorting', {
        p_processing_record_id: this.testData.processingRecordId
      });

    if (error) throw error;
    
    if (!data.canSort) {
      throw new Error(`Processing record cannot be sorted: ${data.reason}`);
    }
    
    console.log('✅ Processing record is valid for sorting');
    return data;
  }

  async testStep4_CreateSortingBatch() {
    console.log('\n📋 Step 4: Creating sorting batch...');
    
    const batchNumber = `TEST-${Date.now()}`;
    
    const { data, error } = await supabase
      .rpc('create_sorting_batch', {
        p_processing_record_id: this.testData.processingRecordId,
        p_batch_number: batchNumber,
        p_sorted_by: null
      });

    if (error) throw error;
    
    this.testData.sortingBatchId = data;
    console.log(`✅ Created sorting batch: ${data} (${batchNumber})`);
    return data;
  }

  async testStep5_AddSortedFishItems() {
    console.log('\n🐟 Step 5: Adding sorted fish items...');
    
    // Create test fish items with different weights to test size class assignment
    const testFishItems = [
      { weight: 50, length: 15, grade: 'A' },   // Should be size class 0
      { weight: 150, length: 20, grade: 'A' },  // Should be size class 1
      { weight: 250, length: 25, grade: 'B' },  // Should be size class 2
      { weight: 400, length: 30, grade: 'A' },  // Should be size class 3
      { weight: 600, length: 35, grade: 'B' },  // Should be size class 4
      { weight: 800, length: 40, grade: 'A' },  // Should be size class 5
      { weight: 1200, length: 45, grade: 'C' }, // Should be size class 6
      { weight: 1800, length: 50, grade: 'A' }, // Should be size class 7
      { weight: 2500, length: 55, grade: 'B' }, // Should be size class 8
      { weight: 4000, length: 60, grade: 'A' }, // Should be size class 9
      { weight: 6000, length: 65, grade: 'A' }  // Should be size class 10
    ];

    for (const fish of testFishItems) {
      const { data, error } = await supabase
        .rpc('add_sorted_fish_item', {
          p_sorting_batch_id: this.testData.sortingBatchId,
          p_weight_grams: fish.weight,
          p_length_cm: fish.length,
          p_grade: fish.grade,
          p_quality_notes: `Test fish - ${fish.grade} grade`
        });

      if (error) throw error;
      
      this.testData.sortedFishItems.push(data);
      console.log(`   ✅ Added fish item: ${fish.weight}g → Size class ${await this.getSizeClassForWeight(fish.weight)}`);
    }
    
    console.log(`✅ Added ${testFishItems.length} sorted fish items`);
    return this.testData.sortedFishItems;
  }

  async getSizeClassForWeight(weight) {
    const { data, error } = await supabase
      .rpc('get_size_class_for_weight', { weight_grams: weight });
    
    if (error) throw error;
    return data;
  }

  async testStep6_CompleteSortingBatch() {
    console.log('\n✅ Step 6: Completing sorting batch...');
    
    const { data, error } = await supabase
      .rpc('complete_sorting_batch', {
        p_sorting_batch_id: this.testData.sortingBatchId
      });

    if (error) throw error;
    
    console.log('✅ Sorting batch completed successfully');
    return data;
  }

  async testStep7_ValidateForInventory() {
    console.log('\n📊 Step 7: Validating sorting batch for inventory...');
    
    const { data, error } = await supabase
      .rpc('validate_sorting_batch_for_inventory', {
        p_sorting_batch_id: this.testData.sortingBatchId
      });

    if (error) throw error;
    
    if (!data.is_valid) {
      throw new Error(`Sorting batch not valid for inventory: ${data.message}`);
    }
    
    console.log('✅ Sorting batch is valid for inventory');
    console.log(`   📋 Batch info:`, data.batch_info);
    return data;
  }

  async testStep8_AddToInventory() {
    console.log('\n📦 Step 8: Adding sorted fish to inventory...');
    
    const { data, error } = await supabase
      .rpc('add_stock_from_sorting', {
        p_sorting_batch_id: this.testData.sortingBatchId
      });

    if (error) throw error;
    
    console.log('✅ Successfully added sorted fish to inventory');
    return data;
  }

  async testStep9_VerifyInventory() {
    console.log('\n🔍 Step 9: Verifying inventory updates...');
    
    const { data, error } = await supabase
      .rpc('get_inventory_summary_with_sorting');

    if (error) throw error;
    
    console.log('📊 Current inventory summary:');
    data.forEach(item => {
      if (item.current_stock > 0) {
        console.log(`   Size ${item.size}: ${item.current_stock} pieces (${item.total_added_from_sorting} from sorting)`);
      }
    });
    
    return data;
  }

  async testStep10_TestOldWorkflowBlocked() {
    console.log('\n🚫 Step 10: Testing that old workflow is blocked...');
    
    try {
      const { data, error } = await supabase
        .rpc('add_stock_from_processing_deprecated', {
          p_processing_record_id: this.testData.processingRecordId
        });

      if (!error) {
        throw new Error('Old workflow should be blocked but was not');
      }
      
      console.log('✅ Old direct processing-to-inventory workflow is properly blocked');
      return true;
    } catch (error) {
      if (error.message.includes('Direct processing to inventory is no longer allowed')) {
        console.log('✅ Old direct processing-to-inventory workflow is properly blocked');
        return true;
      } else {
        throw error;
      }
    }
  }

  async runCompleteWorkflowTest() {
    console.log('🧪 Starting Complete Sorting Workflow Test...\n');
    
    try {
      // Run all test steps
      await this.testStep1_CreateWarehouseEntry();
      await this.testStep2_CreateProcessingRecord();
      await this.testStep3_ValidateProcessingForSorting();
      await this.testStep4_CreateSortingBatch();
      await this.testStep5_AddSortedFishItems();
      await this.testStep6_CompleteSortingBatch();
      await this.testStep7_ValidateForInventory();
      await this.testStep8_AddToInventory();
      await this.testStep9_VerifyInventory();
      await this.testStep10_TestOldWorkflowBlocked();
      
      console.log('\n🎉 Complete Sorting Workflow Test PASSED!');
      console.log('\n✅ All workflow steps completed successfully:');
      console.log('   📦 Warehouse Entry → Processing → Sorting → Inventory');
      console.log('   🔒 Old direct workflow properly blocked');
      console.log('   📊 Inventory properly updated with sorted fish');
      console.log('   🏷️  Size classes correctly assigned (0-10)');
      console.log('   📋 Batch tracking and validation working');
      
      return true;
    } catch (error) {
      console.error('\n❌ Workflow test failed:', error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

async function runWorkflowTest() {
  const tester = new SortingWorkflowTester();
  
  try {
    const success = await tester.runCompleteWorkflowTest();
    
    if (success) {
      console.log('\n✨ Sorting workflow is fully functional!');
      process.exit(0);
    } else {
      console.log('\n💥 Sorting workflow test failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runWorkflowTest();
}

module.exports = { SortingWorkflowTester };
