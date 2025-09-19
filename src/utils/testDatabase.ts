import { supabase } from '../lib/supabaseClient';

export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Database connection test successful');
    return { success: true, data };
  } catch (error: any) {
    console.error('Database connection test error:', error);
    return { success: false, error: error.message };
  }
}

export async function testProfileTable() {
  try {
    console.log('Testing profiles table...');
    
    // Try to get a count of profiles
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Profiles table test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Profiles table test successful, count:', count);
    return { success: true, count };
  } catch (error: any) {
    console.error('Profiles table test error:', error);
    return { success: false, error: error.message };
  }
}
