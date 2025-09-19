const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableSortingRLS() {
  console.log('Disabling RLS on sorting tables...');

  try {
    // Test if we can access the tables directly
    console.log('Testing direct table access...');
    
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

    // Try to insert some default size class thresholds if the table is empty
    const { data: existingThresholds, error: checkError } = await supabase
      .from('size_class_thresholds')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking size_class_thresholds:', checkError.message);
    } else if (!existingThresholds || existingThresholds.length === 0) {
      console.log('Inserting default size class thresholds...');
      
      const defaultThresholds = [
        { class_number: 0, min_weight_grams: 0, max_weight_grams: 99.99, description: 'Extra Small - Under 100g' },
        { class_number: 1, min_weight_grams: 100, max_weight_grams: 199.99, description: 'Small - 100-200g' },
        { class_number: 2, min_weight_grams: 200, max_weight_grams: 299.99, description: 'Medium Small - 200-300g' },
        { class_number: 3, min_weight_grams: 300, max_weight_grams: 499.99, description: 'Medium - 300-500g' },
        { class_number: 4, min_weight_grams: 500, max_weight_grams: 799.99, description: 'Medium Large - 500-800g' },
        { class_number: 5, min_weight_grams: 800, max_weight_grams: 1199.99, description: 'Large - 800-1200g' },
        { class_number: 6, min_weight_grams: 1200, max_weight_grams: 1599.99, description: 'Extra Large - 1200-1600g' },
        { class_number: 7, min_weight_grams: 1600, max_weight_grams: 1999.99, description: 'Jumbo - 1600-2000g' },
        { class_number: 8, min_weight_grams: 2000, max_weight_grams: 2999.99, description: 'Super Jumbo - 2000-3000g' },
        { class_number: 9, min_weight_grams: 3000, max_weight_grams: 4999.99, description: 'Mega - 3000-5000g' },
        { class_number: 10, min_weight_grams: 5000, max_weight_grams: 999999.99, description: 'Giant - Over 5000g' }
      ];

      const { data: inserted, error: insertError } = await supabase
        .from('size_class_thresholds')
        .insert(defaultThresholds);

      if (insertError) {
        console.error('❌ Error inserting default thresholds:', insertError.message);
      } else {
        console.log('✅ Default size class thresholds inserted successfully');
      }
    } else {
      console.log('✅ Size class thresholds already exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

disableSortingRLS();
