// Test script to check transfer data flow
// Run this in your browser console to see what's happening

console.log('=== Testing Transfer Data Flow ===');

// Check what happens when we try to create a transfer
async function testTransferCreation() {
    try {
        console.log('1. Testing createTransfer function...');
        
        // This is what the frontend calls
        const result = await inventoryService.createTransfer(
            '5cc7c667-8959-4dde-abe8-bd41d2b26d4e', // Cold Storage A
            'f0f53658-830a-45c2-8dd3-4d0639e408d0', // Cold Storage B
            5, // size
            100, // quantity
            75.5, // weight
            'Test transfer from console'
        );
        
        console.log('✅ Transfer created successfully:', result);
        return result;
    } catch (error) {
        console.error('❌ Error creating transfer:', error);
        return null;
    }
}

// Check what tables exist and have data
async function checkTransferTables() {
    try {
        console.log('2. Checking transfer tables...');
        
        // Check transfers table
        const { data: transfersData, error: transfersError } = await supabase
            .from('transfers')
            .select('*')
            .limit(5);
            
        if (transfersError) {
            console.log('❌ transfers table error:', transfersError.message);
        } else {
            console.log('✅ transfers table data:', transfersData);
        }
        
        // Check transfer_requests table
        const { data: requestsData, error: requestsError } = await supabase
            .from('transfer_requests')
            .select('*')
            .limit(5);
            
        if (requestsError) {
            console.log('❌ transfer_requests table error:', requestsError.message);
        } else {
            console.log('✅ transfer_requests table data:', requestsData);
        }
        
        // Check transfer_log table
        const { data: logData, error: logError } = await supabase
            .from('transfer_log')
            .select('*')
            .limit(5);
            
        if (logError) {
            console.log('❌ transfer_log table error:', logError.message);
        } else {
            console.log('✅ transfer_log table data:', logData);
        }
        
    } catch (error) {
        console.error('❌ Error checking tables:', error);
    }
}

// Check what the frontend is actually calling
async function checkFrontendCalls() {
    try {
        console.log('3. Testing frontend service calls...');
        
        // Test getPendingTransferRequests
        const pending = await inventoryService.getPendingTransferRequests();
        console.log('✅ Pending transfers:', pending);
        
        // Test getTransferHistory
        const history = await inventoryService.getTransferHistory();
        console.log('✅ Transfer history:', history);
        
    } catch (error) {
        console.error('❌ Error testing frontend calls:', error);
    }
}

// Run all tests
async function runAllTests() {
    await checkTransferTables();
    await checkFrontendCalls();
    await testTransferCreation();
}

// Run the tests
runAllTests();
