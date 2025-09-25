// Debug script to identify duplicate record issues
// Run this in your browser console or as a Node.js script

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkForDuplicates() {
  console.log('🔍 Checking for duplicate records...\n');

  try {
    // 1. Check for duplicate processing records
    console.log('1. Checking processing_records for duplicates...');
    const { data: processingDuplicates, error: processingError } = await supabase
      .from('processing_records')
      .select('warehouse_entry_id, COUNT(*) as count')
      .group('warehouse_entry_id')
      .having('COUNT(*) > 1');

    if (processingError) {
      console.error('Error checking processing records:', processingError);
    } else if (processingDuplicates && processingDuplicates.length > 0) {
      console.log('❌ Found duplicate processing records:', processingDuplicates);
    } else {
      console.log('✅ No duplicate processing records found');
    }

    // 2. Check for duplicate sorting batches
    console.log('\n2. Checking sorting_batches for duplicates...');
    const { data: sortingDuplicates, error: sortingError } = await supabase
      .from('sorting_batches')
      .select('processing_record_id, COUNT(*) as count')
      .group('processing_record_id')
      .having('COUNT(*) > 1');

    if (sortingError) {
      console.error('Error checking sorting batches:', sortingError);
    } else if (sortingDuplicates && sortingDuplicates.length > 0) {
      console.log('❌ Found duplicate sorting batches:', sortingDuplicates);
    } else {
      console.log('✅ No duplicate sorting batches found');
    }

    // 3. Check for duplicate transfers
    console.log('\n3. Checking transfers for potential duplicates...');
    const { data: transfers, error: transfersError } = await supabase
      .from('transfers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (transfersError) {
      console.error('Error checking transfers:', transfersError);
    } else {
      console.log('✅ Recent transfers:', transfers?.length || 0);
      if (transfers && transfers.length > 0) {
        console.log('Latest transfer:', transfers[0]);
      }
    }

    // 4. Check for duplicate users (profiles)
    console.log('\n4. Checking profiles for duplicate phone numbers...');
    const { data: phoneDuplicates, error: phoneError } = await supabase
      .from('profiles')
      .select('phone, COUNT(*) as count')
      .not('phone', 'is', null)
      .group('phone')
      .having('COUNT(*) > 1');

    if (phoneError) {
      console.error('Error checking phone duplicates:', phoneError);
    } else if (phoneDuplicates && phoneDuplicates.length > 0) {
      console.log('❌ Found duplicate phone numbers:', phoneDuplicates);
    } else {
      console.log('✅ No duplicate phone numbers found');
    }

    // 5. Check for duplicate disposal records
    console.log('\n5. Checking disposal_records for duplicate numbers...');
    const { data: disposalDuplicates, error: disposalError } = await supabase
      .from('disposal_records')
      .select('disposal_number, COUNT(*) as count')
      .group('disposal_number')
      .having('COUNT(*) > 1');

    if (disposalError) {
      console.error('Error checking disposal duplicates:', disposalError);
    } else if (disposalDuplicates && disposalDuplicates.length > 0) {
      console.log('❌ Found duplicate disposal numbers:', disposalDuplicates);
    } else {
      console.log('✅ No duplicate disposal numbers found');
    }

  } catch (error) {
    console.error('❌ Error during duplicate check:', error);
  }
}

// Function to clean up duplicates (use with caution!)
async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate records...\n');

  try {
    // Clean up duplicate processing records (keep the most recent)
    console.log('Cleaning up duplicate processing records...');
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_duplicate_processing_records');

    if (cleanupError) {
      console.error('Error cleaning up processing records:', cleanupError);
    } else {
      console.log('✅ Processing records cleanup result:', cleanupResult);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the check
checkForDuplicates();

// Uncomment the line below to run cleanup (BE CAREFUL!)
// cleanupDuplicates();
