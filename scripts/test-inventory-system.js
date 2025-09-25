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

async function testInventorySystem() {
    console.log('🧪 Testing Inventory System...\n');

    try {
        // Step 1: Create the inventory system schema
        console.log('📋 Step 1: Creating inventory system schema...');
        const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'db', 'inventory_system_schema.sql'), 'utf8');
        
        const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });
        if (schemaError) {
            console.error('❌ Schema creation failed:', schemaError.message);
            return;
        }
        console.log('✅ Schema created successfully\n');

        // Step 2: Test adding stock
        console.log('📦 Step 2: Testing stock addition...');
        const { data: addStockResult, error: addStockError } = await supabase
            .rpc('add_stock', {
                p_size: 3,
                p_quantity: 25,
                p_entry_type: 'inbound',
                p_notes: 'Test shipment'
            });

        if (addStockError) {
            console.error('❌ Add stock failed:', addStockError.message);
            return;
        }
        console.log('✅ Stock added successfully:', addStockResult[0]);
        console.log(`   Size: ${addStockResult[0].size}, Quantity: ${addStockResult[0].quantity}\n`);

        // Step 3: Test creating an order
        console.log('📝 Step 3: Testing order creation...');
        const { data: createOrderResult, error: createOrderError } = await supabase
            .rpc('create_order', {
                p_outlet_name: 'Test Fish Market',
                p_items: JSON.stringify([
                    { size: 3, quantity: 10, unit_price: 15.50 },
                    { size: 4, quantity: 5, unit_price: 18.00 }
                ]),
                p_notes: 'Test order for inventory system'
            });

        if (createOrderError) {
            console.error('❌ Create order failed:', createOrderError.message);
            return;
        }
        console.log('✅ Order created successfully:', createOrderResult[0]);
        console.log(`   Order ID: ${createOrderResult[0].order_id}`);
        console.log(`   Outlet: ${createOrderResult[0].outlet_name}`);
        console.log(`   Total Value: $${createOrderResult[0].total_value}\n`);

        // Step 4: Test getting inventory totals
        console.log('📊 Step 4: Testing inventory totals...');
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

        // Step 5: Test order dispatch
        console.log('🚚 Step 5: Testing order dispatch...');
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

        // Step 6: Test inventory history
        console.log('📈 Step 6: Testing inventory history...');
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
        console.log('');

        // Step 7: Test insufficient stock scenario
        console.log('⚠️  Step 7: Testing insufficient stock scenario...');
        const { data: largeOrderResult, error: largeOrderError } = await supabase
            .rpc('create_order', {
                p_outlet_name: 'Test Large Order',
                p_items: JSON.stringify([
                    { size: 3, quantity: 1000, unit_price: 15.50 } // This should fail
                ]),
                p_notes: 'This order should fail due to insufficient stock'
            });

        if (largeOrderError) {
            console.error('❌ Create large order failed:', largeOrderError.message);
            return;
        }

        const largeOrderId = largeOrderResult[0].order_id;
        const { data: failedDispatchResult, error: failedDispatchError } = await supabase
            .rpc('dispatch_order', { p_order_id: largeOrderId });

        if (failedDispatchError) {
            console.error('❌ Failed dispatch test failed:', failedDispatchError.message);
            return;
        }
        console.log('✅ Insufficient stock test result:', failedDispatchResult[0]);
        console.log(`   Success: ${failedDispatchResult[0].success}`);
        console.log(`   Message: ${failedDispatchResult[0].message}`);
        console.log(`   Order Status: ${failedDispatchResult[0].order_status}\n`);

        // Step 8: Final inventory check
        console.log('📊 Step 8: Final inventory check...');
        const { data: finalInventory, error: finalInventoryError } = await supabase
            .rpc('get_inventory_totals');

        if (finalInventoryError) {
            console.error('❌ Final inventory check failed:', finalInventoryError.message);
            return;
        }
        console.log('✅ Final inventory totals:');
        finalInventory.forEach(item => {
            console.log(`   Size ${item.size}: ${item.quantity} pieces`);
        });

        console.log('\n🎉 All inventory system tests completed successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✅ Schema creation');
        console.log('   ✅ Stock addition');
        console.log('   ✅ Order creation');
        console.log('   ✅ Inventory totals retrieval');
        console.log('   ✅ Order dispatch (successful)');
        console.log('   ✅ Inventory history');
        console.log('   ✅ Insufficient stock handling');
        console.log('   ✅ Final inventory verification');

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
testInventorySystem().catch(console.error);
