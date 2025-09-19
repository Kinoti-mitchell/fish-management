const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testIntegratedInventorySystem() {
    console.log('🧪 Testing Integrated Inventory System...\n');

    try {
        // Step 1: Create the integrated inventory system schema
        console.log('📋 Step 1: Creating integrated inventory system schema...');
        const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'db', 'inventory_system_integrated.sql'), 'utf8');
        
        // Split the SQL into individual statements and execute them
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
                if (error && !error.message.includes('already exists')) {
                    console.error('❌ Schema creation failed:', error.message);
                    console.log('Statement:', statement.substring(0, 100) + '...');
                    return;
                }
            }
        }
        console.log('✅ Schema created successfully\n');

        // Step 2: Check for existing processing records
        console.log('🔍 Step 2: Checking for existing processing records...');
        const { data: processingRecords, error: processingError } = await supabase
            .from('processing_records')
            .select('id, processing_date, size_distribution, ready_for_dispatch_count')
            .order('processing_date', { ascending: false })
            .limit(5);

        if (processingError) {
            console.error('❌ Error fetching processing records:', processingError.message);
            return;
        }

        if (processingRecords && processingRecords.length > 0) {
            console.log(`✅ Found ${processingRecords.length} processing records`);
            processingRecords.forEach((record, index) => {
                console.log(`   ${index + 1}. Date: ${record.processing_date}, Ready: ${record.ready_for_dispatch_count}`);
                if (record.size_distribution) {
                    console.log(`      Size distribution:`, record.size_distribution);
                }
            });
        } else {
            console.log('⚠️  No processing records found. Creating sample processing record...');
            
            // Create a sample processing record
            const { data: sampleProcessing, error: sampleError } = await supabase
                .from('processing_records')
                .insert([{
                    warehouse_entry_id: null, // We'll skip the warehouse entry for testing
                    processing_date: new Date().toISOString().split('T')[0],
                    processed_by: null,
                    pre_processing_weight: 100.0,
                    post_processing_weight: 85.0,
                    processing_waste: 15.0,
                    processing_yield: 85.0,
                    size_distribution: {
                        "1": 10,
                        "2": 15,
                        "3": 20,
                        "4": 12,
                        "5": 8
                    },
                    grading_results: {
                        "A": 25,
                        "B": 30,
                        "C": 10
                    },
                    final_value: 1500.0,
                    ready_for_dispatch_count: 65
                }])
                .select()
                .single();

            if (sampleError) {
                console.error('❌ Error creating sample processing record:', sampleError.message);
                return;
            }
            console.log('✅ Sample processing record created:', sampleProcessing.id);
            processingRecords.push(sampleProcessing);
        }
        console.log('');

        // Step 3: Test adding stock from processing records
        console.log('📦 Step 3: Testing stock addition from processing records...');
        const processingRecord = processingRecords[0];
        
        const { data: addStockResult, error: addStockError } = await supabase
            .rpc('add_stock_from_processing', {
                p_processing_record_id: processingRecord.id
            });

        if (addStockError) {
            console.error('❌ Add stock from processing failed:', addStockError.message);
            return;
        }
        console.log('✅ Stock added from processing successfully:', addStockResult[0]);
        console.log(`   Size: ${addStockResult[0].size}, Quantity: ${addStockResult[0].quantity}\n`);

        // Step 4: Test getting processing records ready for inventory
        console.log('📋 Step 4: Testing processing records for inventory...');
        const { data: processingForInventory, error: processingForInventoryError } = await supabase
            .rpc('get_processing_records_for_inventory');

        if (processingForInventoryError) {
            console.error('❌ Get processing records for inventory failed:', processingForInventoryError.message);
            return;
        }
        console.log('✅ Processing records ready for inventory:');
        processingForInventory.forEach((record, index) => {
            console.log(`   ${index + 1}. Date: ${record.processing_date}, Ready: ${record.ready_for_dispatch_count}, Added: ${record.already_added}`);
        });
        console.log('');

        // Step 5: Test getting inventory totals
        console.log('📊 Step 5: Testing inventory totals...');
        const { data: inventoryTotals, error: inventoryError } = await supabase
            .rpc('get_inventory_totals');

        if (inventoryError) {
            console.error('❌ Get inventory totals failed:', inventoryError.message);
            return;
        }
        console.log('✅ Current inventory totals:');
        inventoryTotals.forEach(item => {
            console.log(`   Size ${item.size}: ${item.quantity} pieces`);
        });
        console.log('');

        // Step 6: Test creating an order
        console.log('📝 Step 6: Testing order creation...');
        const { data: createOrderResult, error: createOrderError } = await supabase
            .rpc('create_order', {
                p_outlet_name: 'Test Fish Market',
                p_items: JSON.stringify([
                    { size: 3, quantity: 10, unit_price: 15.50 },
                    { size: 4, quantity: 5, unit_price: 18.00 }
                ]),
                p_notes: 'Test order for integrated inventory system'
            });

        if (createOrderError) {
            console.error('❌ Create order failed:', createOrderError.message);
            return;
        }
        console.log('✅ Order created successfully:', createOrderResult[0]);
        console.log(`   Order ID: ${createOrderResult[0].order_id}`);
        console.log(`   Outlet: ${createOrderResult[0].outlet_name}`);
        console.log(`   Total Value: $${createOrderResult[0].total_value}\n`);

        // Step 7: Test order dispatch
        console.log('🚚 Step 7: Testing order dispatch...');
        const orderId = createOrderResult[0].order_id;
        const { data: dispatchResult, error: dispatchError } = await supabase
            .rpc('dispatch_order', { p_order_id: orderId });

        if (dispatchError) {
            console.error('❌ Dispatch order failed:', dispatchError.message);
            return;
        }
        console.log('✅ Order dispatch result:', dispatchResult[0]);
        console.log(`   Success: ${dispatchResult[0].success}`);
        console.log(`   Message: ${dispatchResult[0].message}`);
        console.log(`   Order Status: ${dispatchResult[0].order_status}\n`);

        // Step 8: Test inventory summary
        console.log('📈 Step 8: Testing inventory summary...');
        const { data: inventorySummary, error: summaryError } = await supabase
            .rpc('get_inventory_summary');

        if (summaryError) {
            console.error('❌ Get inventory summary failed:', summaryError.message);
            return;
        }
        console.log('✅ Inventory summary:');
        inventorySummary.forEach(item => {
            console.log(`   Size ${item.size}: Stock=${item.current_stock}, Processed=${item.total_processed}, Dispatched=${item.total_dispatched}, Pending=${item.pending_orders}`);
        });
        console.log('');

        // Step 9: Test inventory history
        console.log('📈 Step 9: Testing inventory history...');
        const { data: historyResult, error: historyError } = await supabase
            .rpc('get_inventory_history', { p_limit: 10 });

        if (historyError) {
            console.error('❌ Get inventory history failed:', historyError.message);
            return;
        }
        console.log('✅ Recent inventory movements:');
        historyResult.forEach(entry => {
            const change = entry.quantity_change > 0 ? `+${entry.quantity_change}` : entry.quantity_change.toString();
            console.log(`   Size ${entry.size}: ${change} (${entry.entry_type}) - ${entry.notes || 'No notes'}`);
        });

        console.log('\n🎉 All integrated inventory system tests completed successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✅ Schema creation');
        console.log('   ✅ Processing records integration');
        console.log('   ✅ Stock addition from processing');
        console.log('   ✅ Inventory totals retrieval');
        console.log('   ✅ Order creation and dispatch');
        console.log('   ✅ Inventory summary with processing data');
        console.log('   ✅ Inventory history tracking');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Helper function to execute raw SQL (if needed)
async function execSQL(sql) {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
        console.error('SQL execution error:', error);
        throw error;
    }
    return data;
}

// Run the tests
testIntegratedInventorySystem().catch(console.error);
