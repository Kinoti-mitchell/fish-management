const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'server', 'server.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server.env');
  process.exit(1);
}

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: sql })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createDeclineBatchTransferFunction() {
  try {
    console.log('🔧 Creating decline_batch_transfer function...');
    
    const sql = `
CREATE OR REPLACE FUNCTION decline_batch_transfer(
    p_transfer_id UUID,
    p_approved_by UUID
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transfer RECORD;
    v_batch_key TEXT;
    v_total_count INTEGER;
    v_declined_count INTEGER := 0;
    v_current_transfer RECORD;
BEGIN
    -- Get the transfer record
    SELECT * INTO v_transfer
    FROM transfers
    WHERE id = p_transfer_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Transfer not found or already processed'::TEXT;
        RETURN;
    END IF;
    
    -- Create batch key to find all related transfers
    v_batch_key := v_transfer.from_storage_location_id || '-' || 
                   v_transfer.to_storage_location_id || '-' || 
                   v_transfer.created_at || '-' || 
                   COALESCE(v_transfer.notes, '');
    
    -- Count total transfers in this batch
    SELECT COUNT(*) INTO v_total_count
    FROM transfers t
    WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
    AND t.to_storage_location_id = v_transfer.to_storage_location_id
    AND t.created_at = v_transfer.created_at
    AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
    AND t.status = 'pending';
    
    -- Decline all transfers in the batch using a cursor
    FOR v_current_transfer IN 
        SELECT * FROM transfers t
        WHERE t.from_storage_location_id = v_transfer.from_storage_location_id
        AND t.to_storage_location_id = v_transfer.to_storage_location_id
        AND t.created_at = v_transfer.created_at
        AND COALESCE(t.notes, '') = COALESCE(v_transfer.notes, '')
        AND t.status = 'pending'
    LOOP
        UPDATE transfers
        SET 
            status = 'declined',
            approved_by = p_approved_by,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = v_current_transfer.id;
        
        v_declined_count := v_declined_count + 1;
    END LOOP;
    
    IF v_declined_count > 0 THEN
        RETURN QUERY SELECT TRUE, format('Batch transfer declined successfully. %s transfers declined.', v_declined_count)::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, 'No transfers were declined'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;
    `;
    
    console.log('📄 Executing SQL...');
    const result = await executeSQL(sql);
    
    if (!result.success) {
      console.error('❌ Error creating function:', result.error);
      return false;
    }
    
    console.log('✅ Function created successfully!');
    
    // Grant permissions
    console.log('🔐 Granting permissions...');
    const grantSQL = `
GRANT EXECUTE ON FUNCTION decline_batch_transfer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_batch_transfer(UUID, UUID) TO anon;
    `;
    
    const grantResult = await executeSQL(grantSQL);
    
    if (!grantResult.success) {
      console.error('❌ Error granting permissions:', grantResult.error);
      return false;
    }
    
    console.log('✅ Permissions granted successfully!');
    
    console.log('🎉 decline_batch_transfer function created successfully!');
    return true;
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    return false;
  }
}

// Run the function
createDeclineBatchTransferFunction().then(success => {
  if (success) {
    console.log('\n✅ All done! The decline_batch_transfer function is now available.');
  } else {
    console.log('\n❌ Failed to create the function. Please check the errors above.');
  }
  process.exit(success ? 0 : 1);
});
