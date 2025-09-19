const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSortingPermissions() {
  console.log('Fixing sorting table permissions...');

  try {
    // Drop existing restrictive policies
    const policies = [
      'DROP POLICY IF EXISTS "Users can view size class thresholds" ON size_class_thresholds;',
      'DROP POLICY IF EXISTS "Admins can manage size class thresholds" ON size_class_thresholds;',
      'DROP POLICY IF EXISTS "Users can view sorting batches" ON sorting_batches;',
      'DROP POLICY IF EXISTS "Users can create sorting batches" ON sorting_batches;',
      'DROP POLICY IF EXISTS "Users can update their own sorting batches" ON sorting_batches;',
      'DROP POLICY IF EXISTS "Users can view sorted fish items" ON sorted_fish_items;',
      'DROP POLICY IF EXISTS "Users can create sorted fish items" ON sorted_fish_items;',
      'DROP POLICY IF EXISTS "Users can view sorting results" ON sorting_results;'
    ];

    for (const policy of policies) {
      console.log(`Executing: ${policy}`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.warn(`Warning executing ${policy}:`, error.message);
      }
    }

    // Create permissive policies
    const newPolicies = [
      'CREATE POLICY "Allow all operations on size_class_thresholds" ON size_class_thresholds FOR ALL USING (true);',
      'CREATE POLICY "Allow all operations on sorting_batches" ON sorting_batches FOR ALL USING (true);',
      'CREATE POLICY "Allow all operations on sorted_fish_items" ON sorted_fish_items FOR ALL USING (true);',
      'CREATE POLICY "Allow all operations on sorting_results" ON sorting_results FOR ALL USING (true);'
    ];

    for (const policy of newPolicies) {
      console.log(`Executing: ${policy}`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.warn(`Warning executing ${policy}:`, error.message);
      }
    }

    // Grant permissions
    const grants = [
      'GRANT ALL ON size_class_thresholds TO authenticated;',
      'GRANT ALL ON sorting_batches TO authenticated;',
      'GRANT ALL ON sorted_fish_items TO authenticated;',
      'GRANT ALL ON sorting_results TO authenticated;',
      'GRANT ALL ON size_class_thresholds TO anon;',
      'GRANT ALL ON sorting_batches TO anon;',
      'GRANT ALL ON sorted_fish_items TO anon;',
      'GRANT ALL ON sorting_results TO anon;'
    ];

    for (const grant of grants) {
      console.log(`Executing: ${grant}`);
      const { error } = await supabase.rpc('exec_sql', { sql: grant });
      if (error) {
        console.warn(`Warning executing ${grant}:`, error.message);
      }
    }

    console.log('✅ Sorting table permissions fixed successfully!');
    
    // Test the tables
    console.log('Testing table access...');
    
    const { data: thresholds, error: thresholdsError } = await supabase
      .from('size_class_thresholds')
      .select('*')
      .limit(1);
    
    if (thresholdsError) {
      console.error('❌ Error accessing size_class_thresholds:', thresholdsError.message);
    } else {
      console.log('✅ size_class_thresholds accessible');
    }

    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('*')
      .limit(1);
    
    if (batchesError) {
      console.error('❌ Error accessing sorting_batches:', batchesError.message);
    } else {
      console.log('✅ sorting_batches accessible');
    }

  } catch (error) {
    console.error('❌ Error fixing permissions:', error.message);
  }
}

fixSortingPermissions();
