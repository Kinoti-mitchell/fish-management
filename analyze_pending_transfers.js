// Analyze Pending Transfers - JavaScript Script
// This script will help identify the disconnect between app display and database

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePendingTransfers() {
    console.log('🔍 Starting Pending Transfers Analysis...\n');

    try {
        // 1. Get all transfers
        console.log('📊 1. Fetching all transfers...');
        const { data: allTransfers, error: allError } = await supabase
            .from('transfers')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (allError) {
            console.error('❌ Error fetching all transfers:', allError);
            return;
        }

        console.log(`✅ Found ${allTransfers.length} total transfers`);
        console.log('📋 Recent transfers:', allTransfers.slice(0, 5).map(t => ({
            id: t.id.slice(0, 8) + '...',
            status: t.status,
            from: t.from_storage_name,
            to: t.to_storage_name,
            size: t.size_class,
            created: t.created_at
        })));

        // 2. Get pending transfers
        console.log('\n📊 2. Fetching pending transfers...');
        const { data: pendingTransfers, error: pendingError } = await supabase
            .from('transfers')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (pendingError) {
            console.error('❌ Error fetching pending transfers:', pendingError);
            return;
        }

        console.log(`✅ Found ${pendingTransfers.length} pending transfers`);
        if (pendingTransfers.length > 0) {
            console.log('📋 Pending transfers:', pendingTransfers.map(t => ({
                id: t.id.slice(0, 8) + '...',
                from: t.from_storage_name,
                to: t.to_storage_name,
                size: t.size_class,
                quantity: t.quantity,
                weight: t.weight_kg,
                created: t.created_at
            })));
        }

        // 3. Get transfers involving Cold Storage A
        console.log('\n📊 3. Fetching Cold Storage A transfers...');
        const { data: coldStorageTransfers, error: coldError } = await supabase
            .from('transfers')
            .select('*')
            .or('from_storage_name.ilike.%cold storage a%,to_storage_name.ilike.%cold storage a%')
            .order('created_at', { ascending: false });

        if (coldError) {
            console.error('❌ Error fetching cold storage transfers:', coldError);
            return;
        }

        console.log(`✅ Found ${coldStorageTransfers.length} Cold Storage A transfers`);
        if (coldStorageTransfers.length > 0) {
            console.log('📋 Cold Storage A transfers:', coldStorageTransfers.map(t => ({
                id: t.id.slice(0, 8) + '...',
                status: t.status,
                from: t.from_storage_name,
                to: t.to_storage_name,
                size: t.size_class,
                created: t.created_at
            })));
        }

        // 4. Get storage locations
        console.log('\n📊 4. Fetching storage locations...');
        const { data: storageLocations, error: storageError } = await supabase
            .from('storage_locations')
            .select('*')
            .order('name');

        if (storageError) {
            console.error('❌ Error fetching storage locations:', storageError);
            return;
        }

        console.log(`✅ Found ${storageLocations.length} storage locations`);
        const coldStorageLocations = storageLocations.filter(sl => 
            sl.name.toLowerCase().includes('cold')
        );
        console.log('📋 Cold storage locations:', coldStorageLocations.map(sl => ({
            id: sl.id.slice(0, 8) + '...',
            name: sl.name,
            status: sl.status
        })));

        // 5. Test the getTransferHistory function
        console.log('\n📊 5. Testing getTransferHistory function...');
        try {
            const { data: transferHistory, error: historyError } = await supabase
                .rpc('get_transfer_history', { limit: 100 });

            if (historyError) {
                console.log('⚠️ getTransferHistory function not found, using direct query');
            } else {
                console.log(`✅ getTransferHistory returned ${transferHistory.length} transfers`);
                const pendingFromHistory = transferHistory.filter(t => t.status === 'pending');
                console.log(`📋 Pending transfers from function: ${pendingFromHistory.length}`);
            }
        } catch (error) {
            console.log('⚠️ getTransferHistory function not available');
        }

        // 6. Analyze the disconnect
        console.log('\n🔍 6. Analysis Results:');
        console.log('='.repeat(50));
        
        const statusCounts = allTransfers.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {});

        console.log('📊 Transfer Status Breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });

        console.log(`\n🎯 Key Findings:`);
        console.log(`   • Total transfers in database: ${allTransfers.length}`);
        console.log(`   • Pending transfers in database: ${pendingTransfers.length}`);
        console.log(`   • Cold Storage A transfers: ${coldStorageTransfers.length}`);
        console.log(`   • Cold storage locations found: ${coldStorageLocations.length}`);

        if (pendingTransfers.length === 0 && coldStorageTransfers.length > 0) {
            console.log(`\n⚠️  DISCONNECT FOUND:`);
            console.log(`   • No pending transfers in database`);
            console.log(`   • But ${coldStorageTransfers.length} transfers involve Cold Storage A`);
            console.log(`   • Check if transfers were auto-approved or have different status`);
        }

        if (coldStorageLocations.length === 0) {
            console.log(`\n⚠️  ISSUE FOUND:`);
            console.log(`   • No storage locations with "cold" in the name`);
            console.log(`   • Check exact storage location names in database`);
        }

        // 7. Check for recent activity
        console.log('\n📊 7. Recent Activity Check:');
        const recentTransfers = allTransfers.filter(t => {
            const created = new Date(t.created_at);
            const now = new Date();
            const hoursDiff = (now - created) / (1000 * 60 * 60);
            return hoursDiff <= 24; // Last 24 hours
        });

        console.log(`   • Transfers in last 24 hours: ${recentTransfers.length}`);
        if (recentTransfers.length > 0) {
            const recentPending = recentTransfers.filter(t => t.status === 'pending');
            console.log(`   • Pending in last 24 hours: ${recentPending.length}`);
        }

    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

// Run the analysis
analyzePendingTransfers().then(() => {
    console.log('\n✅ Analysis completed!');
}).catch(error => {
    console.error('❌ Analysis failed:', error);
});
