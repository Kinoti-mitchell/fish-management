const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'server.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInventoryIntegration() {
    console.log('🧪 Testing Inventory System Integration...\n');

    try {
        // Step 1: Test database connection
        console.log('🔍 Step 1: Testing database connection...');
        const { data: connectionTest, error: connectionError } = await supabase
            .from('processing_records')
            .select('id')
            .limit(1);

        if (connectionError) {
            console.error('❌ Database connection failed:', connectionError.message);
            return;
        }
        console.log('✅ Database connection successful\n');

        // Step 2: Check existing processing records
        console.log('📋 Step 2: Checking existing processing records...');
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
            console.log(`✅ Found ${processingRecords.length} processing records:`);
            processingRecords.forEach((record, index) => {
                console.log(`   ${index + 1}. Date: ${record.processing_date}`);
                console.log(`      Ready for dispatch: ${record.ready_for_dispatch_count}`);
                if (record.size_distribution) {
                    console.log(`      Size distribution:`, record.size_distribution);
                }
            });
        } else {
            console.log('⚠️  No processing records found');
        }
        console.log('');

        // Step 3: Check if inventory tables exist
        console.log('📊 Step 3: Checking inventory tables...');
        const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('*')
            .limit(5);

        if (inventoryError) {
            console.log('⚠️  Inventory table does not exist yet:', inventoryError.message);
            console.log('   This is expected if the inventory system schema hasn\'t been applied yet');
        } else {
            console.log(`✅ Inventory table exists with ${inventoryData?.length || 0} records`);
            if (inventoryData && inventoryData.length > 0) {
                inventoryData.forEach(item => {
                    console.log(`   Size ${item.size}: ${item.quantity} pieces`);
                });
            }
        }
        console.log('');

        // Step 4: Check if orders table exists
        console.log('📝 Step 4: Checking orders table...');
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .limit(5);

        if (ordersError) {
            console.log('⚠️  Orders table does not exist yet:', ordersError.message);
        } else {
            console.log(`✅ Orders table exists with ${ordersData?.length || 0} records`);
        }
        console.log('');

        // Step 5: Check if inventory_entries table exists
        console.log('📈 Step 5: Checking inventory_entries table...');
        const { data: entriesData, error: entriesError } = await supabase
            .from('inventory_entries')
            .select('*')
            .limit(5);

        if (entriesError) {
            console.log('⚠️  Inventory_entries table does not exist yet:', entriesError.message);
        } else {
            console.log(`✅ Inventory_entries table exists with ${entriesData?.length || 0} records`);
        }
        console.log('');

        // Step 6: Test processing data structure
        if (processingRecords && processingRecords.length > 0) {
            console.log('🔍 Step 6: Analyzing processing data structure...');
            const sampleRecord = processingRecords[0];
            
            console.log('Sample processing record structure:');
            console.log(`   ID: ${sampleRecord.id}`);
            console.log(`   Date: ${sampleRecord.processing_date}`);
            console.log(`   Ready for dispatch: ${sampleRecord.ready_for_dispatch_count}`);
            
            if (sampleRecord.size_distribution) {
                console.log('   Size distribution (JSONB):');
                Object.entries(sampleRecord.size_distribution).forEach(([size, quantity]) => {
                    console.log(`     Size ${size}: ${quantity} pieces`);
                });
            } else {
                console.log('   ⚠️  No size distribution data found');
            }
        }
        console.log('');

        // Summary
        console.log('📋 Integration Test Summary:');
        console.log('   ✅ Database connection working');
        console.log(`   ${processingRecords && processingRecords.length > 0 ? '✅' : '⚠️ '} Processing records: ${processingRecords?.length || 0} found`);
        console.log(`   ${!inventoryError ? '✅' : '⚠️ '} Inventory system: ${inventoryError ? 'Not installed' : 'Available'}`);
        console.log(`   ${!ordersError ? '✅' : '⚠️ '} Orders system: ${ordersError ? 'Not installed' : 'Available'}`);
        console.log(`   ${!entriesError ? '✅' : '⚠️ '} Inventory entries: ${entriesError ? 'Not installed' : 'Available'}`);

        if (inventoryError || ordersError || entriesError) {
            console.log('\n💡 Next Steps:');
            console.log('   1. Apply the inventory system schema to your database');
            console.log('   2. Run the inventory system setup script');
            console.log('   3. Test the integration with existing processing data');
        } else {
            console.log('\n🎉 Inventory system is ready for integration!');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the tests
testInventoryIntegration().catch(console.error);
