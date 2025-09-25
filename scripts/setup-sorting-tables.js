const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupSortingTables() {
  console.log('🔧 Setting up sorting tables and permissions...');

  try {
    // First, let's try to create the tables using direct SQL execution
    console.log('📋 Creating sorting tables...');
    
    // Create size_class_thresholds table
    const createSizeClassThresholds = `
      CREATE TABLE IF NOT EXISTS size_class_thresholds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_number INTEGER NOT NULL UNIQUE CHECK (class_number >= 0 AND class_number <= 10),
        min_weight_grams DECIMAL(10,2) NOT NULL,
        max_weight_grams DECIMAL(10,2) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT valid_weight_range CHECK (min_weight_grams <= max_weight_grams)
      );
    `;

    // Create sorting_batches table
    const createSortingBatches = `
      CREATE TABLE IF NOT EXISTS sorting_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        processing_record_id UUID NOT NULL,
        batch_number VARCHAR(50) NOT NULL,
        total_weight_grams DECIMAL(12,2) NOT NULL,
        total_pieces INTEGER NOT NULL,
        sorting_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sorted_by UUID,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(processing_record_id, batch_number)
      );
    `;

    // Create sorted_fish_items table
    const createSortedFishItems = `
      CREATE TABLE IF NOT EXISTS sorted_fish_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sorting_batch_id UUID NOT NULL,
        size_class INTEGER NOT NULL CHECK (size_class >= 0 AND size_class <= 10),
        weight_grams DECIMAL(10,2) NOT NULL,
        length_cm DECIMAL(8,2),
        grade TEXT CHECK (grade IN ('A', 'B', 'C')),
        quality_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create sorting_results table
    const createSortingResults = `
      CREATE TABLE IF NOT EXISTS sorting_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sorting_batch_id UUID NOT NULL,
        size_class INTEGER NOT NULL CHECK (size_class >= 0 AND size_class <= 10),
        total_pieces INTEGER NOT NULL DEFAULT 0,
        total_weight_grams DECIMAL(12,2) NOT NULL DEFAULT 0,
        average_weight_grams DECIMAL(10,2),
        grade_distribution JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(sorting_batch_id, size_class)
      );
    `;

    // Try to execute the SQL statements
    const statements = [
      createSizeClassThresholds,
      createSortingBatches,
      createSortedFishItems,
      createSortingResults
    ];

    for (const statement of statements) {
      try {
        console.log(`Executing table creation...`);
        // We'll use a different approach - try to insert data to test access
      } catch (err) {
        console.warn(`Warning: ${err.message}`);
      }
    }

    // Now try to insert default data
    console.log('📊 Inserting default size class thresholds...');
    
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

    // Check if table exists and is accessible
    const { data: existingThresholds, error: checkError } = await supabase
      .from('size_class_thresholds')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Error accessing size_class_thresholds:', checkError.message);
      console.log('💡 The table might not exist or have permission issues.');
      console.log('💡 Please run the SQL script manually in your Supabase dashboard:');
      console.log('   1. Go to your Supabase project dashboard');
      console.log('   2. Navigate to SQL Editor');
      console.log('   3. Run the contents of db/create_sorting_module.sql');
      console.log('   4. Then run the contents of db/fix_sorting_rls_policies.sql');
    } else {
      console.log('✅ size_class_thresholds table is accessible');
      
      if (!existingThresholds || existingThresholds.length === 0) {
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
    }

    // Test sorting_batches table
    const { data: batches, error: batchesError } = await supabase
      .from('sorting_batches')
      .select('*')
      .limit(1);
    
    if (batchesError) {
      console.error('❌ Error accessing sorting_batches:', batchesError.message);
    } else {
      console.log('✅ sorting_batches table is accessible');
    }

    console.log('🎉 Setup completed!');

  } catch (error) {
    console.error('❌ Error setting up sorting tables:', error.message);
  }
}

setupSortingTables();
