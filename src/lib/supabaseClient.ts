import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use environment variables with fallback values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pgpazwlejhysxabtkifz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncGF6d2xlamh5c3hhYnRraWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NjE0ODksImV4cCI6MjA2OTQzNzQ4OX0.VZjBmh5647fzGgfW8ttNMUirKRXIg1hj0X8pG0dhjD0';

// Check if environment variables are properly loaded
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Using fallback Supabase configuration');
  console.log('VITE_SUPABASE_URL from env:', import.meta.env.VITE_SUPABASE_URL);
  console.log('VITE_SUPABASE_ANON_KEY from env:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
} else {
  console.log('✅ Supabase environment variables loaded successfully');
}

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key present:', !!supabaseKey);

// Create the base Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false, // Disable auto refresh since we're using custom auth
    persistSession: false,   // Disable session persistence
    detectSessionInUrl: false // Disable URL session detection
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Create an authenticated client for database operations
export const createAuthenticatedClient = (userId: string): SupabaseClient => {
  // For custom authentication, we'll use the anon key but set custom headers
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-User-ID': userId, // Custom header to identify the user
        'X-Auth-Type': 'custom' // Custom header to indicate custom auth
      }
    }
  });
  
  return client;
};

// Get authenticated Supabase client for the current user
export const getAuthenticatedSupabase = (userId?: string): SupabaseClient => {
  if (userId) {
    return createAuthenticatedClient(userId);
  }
  return supabase;
};

// Enhanced error handling wrapper
export const handleSupabaseError = (error: any, operation: string): string => {
  console.error(`Supabase ${operation} error:`, error);
  
  // Handle different error types safely
  if (error && typeof error === 'object') {
    if (error.code === 'PGRST116') {
      return 'No data found';
    }
    
    if (error.code === '23505') {
      return 'This record already exists';
    }
    
    if (error.code === '23503') {
      return 'Referenced record not found';
    }
    
    if (error.message && typeof error.message === 'string' && error.message.includes('JWT')) {
      return 'Authentication error. Please log in again.';
    }
    
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
  }
  
  // Fallback for any other error type
  return 'An unexpected error occurred';
};

// Retry wrapper for network operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Only retry on network errors or 5xx status codes
      if (error?.message?.includes('fetch') || 
          error?.status >= 500 || 
          error?.code === 'NETWORK_ERROR') {
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Don't retry on client errors
      }
    }
  }
  
  throw lastError;
};
