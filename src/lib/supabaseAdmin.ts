import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Admin client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// For client-side admin operations, we'll use a different approach
// since we can't expose the service role key in the browser
export const createAdminClient = () => {
  // This should only be used in server-side contexts
  // For client-side, we'll need to use RPC functions or edge functions
  if (typeof window !== 'undefined') {
    throw new Error('Admin client should not be used in browser context');
  }
  return supabaseAdmin;
};
