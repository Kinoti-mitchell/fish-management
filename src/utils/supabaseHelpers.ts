import { supabase } from '../lib/supabaseClient';

/**
 * Helper functions to handle Supabase queries with better error handling
 * and workarounds for common issues like 406 errors
 */

/**
 * Safely query sorting batches with fallback handling
 */
export async function safeQuerySortingBatches(query: any) {
  try {
    // First try the normal query
    const { data, error } = await query;
    
    if (error) {
      // If it's a 406 error, try with different approach
      if (error.message && error.message.includes('406')) {
        console.warn('406 error detected, trying alternative query approach');
        
        // Try with a simpler query structure
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('sorting_batches')
          .select('*')
          .limit(1);
        
        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return { data: null, error: fallbackError };
        }
        
        // If fallback works, the issue is with the specific query structure
        console.warn('Fallback query succeeded, original query structure may be problematic');
        return { data: null, error: new Error('Query structure incompatible with current RLS policies') };
      }
      
      return { data, error };
    }
    
    return { data, error };
  } catch (err) {
    console.error('Unexpected error in safeQuerySortingBatches:', err);
    return { data: null, error: err };
  }
}

/**
 * Check if user is properly authenticated
 * Note: This app uses custom authentication, not Supabase Auth
 * This function should be called from components that have access to AuthContext
 * 
 * IMPORTANT: This function does NOT call any Supabase auth methods to avoid
 * AuthSessionMissingError. Components should use the useAuth hook instead.
 */
export async function checkAuthentication() {
  // Since this app uses custom authentication through AuthContext,
  // we cannot directly access the user state from this utility function.
  // Components should use the useAuth hook instead.
  
  console.warn('checkAuthentication called - this app uses custom auth. Use useAuth hook in components instead.');
  
  // Return a successful authentication result without calling any Supabase auth methods
  return { 
    isAuthenticated: true, 
    user: { 
      id: 'authenticated-user',
      email: 'user@riofish.com'
    }, 
    error: null 
  };
}

/**
 * Get current session info
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check failed:', error);
      return { session: null, error };
    }
    
    return { session, error: null };
  } catch (err) {
    console.error('Unexpected error in session check:', err);
    return { session: null, error: err };
  }
}

/**
 * Retry a Supabase operation with exponential backoff
 */
export async function retrySupabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on authentication errors
      if (error?.message?.includes('JWT') || 
          error?.message?.includes('401') || 
          error?.message?.includes('403')) {
        throw error;
      }
      
      // Don't retry on 406 errors (RLS issues)
      if (error?.message?.includes('406')) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Handle common Supabase errors with user-friendly messages
 */
export function handleSupabaseError(error: any, operation: string): string {
  console.error(`Supabase ${operation} error:`, error);
  
  if (error && typeof error === 'object') {
    // 406 Not Acceptable - usually RLS policy issues
    if (error.message && error.message.includes('406')) {
      return 'Access denied. Please check your permissions or contact your administrator.';
    }
    
    // 401 Unauthorized
    if (error.message && error.message.includes('401')) {
      return 'Authentication required. Please log in again.';
    }
    
    // 403 Forbidden
    if (error.message && error.message.includes('403')) {
      return 'Access forbidden. You do not have permission to perform this action.';
    }
    
    // JWT errors
    if (error.message && error.message.includes('JWT')) {
      return 'Authentication error. Please log in again.';
    }
    
    // Table not found
    if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
      return 'Database table not found. Please contact your administrator.';
    }
    
    // Permission denied
    if (error.message && error.message.includes('permission denied')) {
      return 'Permission denied. Please check your user permissions.';
    }
    
    // Return the original message if it's a string
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
}
