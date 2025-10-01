// Analyze Pending Transfers - Simple JavaScript Script
// Run with: node analyze_pending_transfers_simple.js

const https = require('https');

// Supabase configuration
const SUPABASE_URL = 'https://pgpazwlejhysxabtkifz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';

function makeSupabaseRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
        
        // Add query parameters
        Object.keys(options).forEach(key => {
            if (options[key] !== undefined) {
                url.searchParams.append(key, options[key]);
            }
        });

        const req = https.request(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function analyzePendingTransfers() {
    console.log('🔍 Starting Pending Transfers Analysis...\n');

    try {
        // 1. Get all transfers
        console.log('📊 1. Fetching all transfers...');
        const allTransfers = await makeSupabaseRequest('transfers', {
            select: '*',
            order: 'created_at.desc',
            limit: '20'
        });

        console.log(`✅ Found ${allTransfers.length} total transfers`);
        if (allTransfers.length > 0) {
            console.log('📋 Recent transfers:');
            allTransfers.slice(0, 5).forEach(t => {
                console.log(`   • ${t.id.slice(0, 8)}... | ${t.status} | ${t.from_storage_name} → ${t.to_storage_name} | Size ${t.size_class} | ${t.created_at}`);
            });
        }

        // 2. Get pending transfers
        console.log('\n📊 2. Fetching pending transfers...');
        const pendingTransfers = await makeSupabaseRequest('transfers', {
            select: '*',
            status: 'eq.pending',
            order: 'created_at.desc'
        });

        console.log(`✅ Found ${pendingTransfers.length} pending transfers`);
        if (pendingTransfers.length > 0) {
            console.log('📋 Pending transfers:');
            pendingTransfers.forEach(t => {
                console.log(`   • ${t.id.slice(0, 8)}... | ${t.from_storage_name} → ${t.to_storage_name} | Size ${t.size_class} | Qty: ${t.quantity} | Weight: ${t.weight_kg}kg`);
            });
        }

        // 3. Get storage locations
        console.log('\n📊 3. Fetching storage locations...');
        const storageLocations = await makeSupabaseRequest('storage_locations', {
            select: '*',
            order: 'name'
        });

        console.log(`✅ Found ${storageLocations.length} storage locations`);
        const coldStorageLocations = storageLocations.filter(sl => 
            sl.name.toLowerCase().includes('cold')
        );
        
        if (coldStorageLocations.length > 0) {
            console.log('📋 Cold storage locations:');
            coldStorageLocations.forEach(sl => {
                console.log(`   • ${sl.id.slice(0, 8)}... | ${sl.name} | Status: ${sl.status}`);
            });
        } else {
            console.log('⚠️ No storage locations with "cold" in the name found');
            console.log('📋 All storage locations:');
            storageLocations.forEach(sl => {
                console.log(`   • ${sl.name}`);
            });
        }

        // 4. Get transfers involving cold storage
        console.log('\n📊 4. Fetching transfers involving cold storage...');
        let coldStorageTransfers = [];
        
        if (coldStorageLocations.length > 0) {
            for (const location of coldStorageLocations) {
                const transfers = await makeSupabaseRequest('transfers', {
                    select: '*',
                    or: `from_storage_name.ilike.%${location.name}%,to_storage_name.ilike.%${location.name}%`,
                    order: 'created_at.desc'
                });
                coldStorageTransfers = coldStorageTransfers.concat(transfers);
            }
        }

        console.log(`✅ Found ${coldStorageTransfers.length} transfers involving cold storage`);
        if (coldStorageTransfers.length > 0) {
            console.log('📋 Cold storage transfers:');
            coldStorageTransfers.forEach(t => {
                console.log(`   • ${t.id ? t.id.slice(0, 8) + '...' : 'N/A'} | ${t.status} | ${t.from_storage_name} → ${t.to_storage_name} | Size ${t.size_class}`);
            });
        }

        // 5. Analyze the disconnect
        console.log('\n🔍 5. Analysis Results:');
        console.log('='.repeat(60));
        
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
        console.log(`   • Cold storage transfers: ${coldStorageTransfers.length}`);
        console.log(`   • Cold storage locations found: ${coldStorageLocations.length}`);

        // 6. Identify the disconnect
        console.log(`\n🔍 6. Disconnect Analysis:`);
        
        if (pendingTransfers.length === 0) {
            console.log(`   ✅ No pending transfers found in database`);
            if (coldStorageTransfers.length > 0) {
                const coldPending = coldStorageTransfers.filter(t => t.status === 'pending');
                console.log(`   📊 Cold storage pending transfers: ${coldPending.length}`);
                if (coldPending.length === 0) {
                    console.log(`   💡 All cold storage transfers have been processed`);
                }
            }
        } else {
            console.log(`   ⚠️ Found ${pendingTransfers.length} pending transfers`);
        }

        if (coldStorageLocations.length === 0) {
            console.log(`   ⚠️ No storage locations with "cold" in the name`);
            console.log(`   💡 Check if storage location names are different`);
        }

        // 7. Recent activity
        console.log(`\n📊 7. Recent Activity (Last 24 hours):`);
        const now = new Date();
        const recentTransfers = allTransfers.filter(t => {
            const created = new Date(t.created_at);
            const hoursDiff = (now - created) / (1000 * 60 * 60);
            return hoursDiff <= 24;
        });

        console.log(`   • Transfers in last 24 hours: ${recentTransfers.length}`);
        if (recentTransfers.length > 0) {
            const recentPending = recentTransfers.filter(t => t.status === 'pending');
            console.log(`   • Pending in last 24 hours: ${recentPending.length}`);
        }

        // 8. Recommendations
        console.log(`\n💡 8. Recommendations:`);
        if (pendingTransfers.length === 0 && coldStorageTransfers.length > 0) {
            console.log(`   • All transfers have been processed - no action needed`);
            console.log(`   • Check if transfers were auto-approved or manually processed`);
        } else if (pendingTransfers.length > 0) {
            console.log(`   • Found pending transfers that need approval`);
            console.log(`   • Check the Transfer Reports section in your app`);
        } else {
            console.log(`   • No transfers found - system is clean`);
        }

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

// Run the analysis
console.log('🚀 Starting Pending Transfers Analysis...\n');
analyzePendingTransfers().then(() => {
    console.log('\n✅ Analysis completed successfully!');
}).catch(error => {
    console.error('❌ Analysis failed:', error);
});
