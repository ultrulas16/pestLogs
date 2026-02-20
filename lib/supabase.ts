import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://evomncmndwsoeezubhmf.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2b21uY21uZHdzb2VlenViaG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0ODk3MTMsImV4cCI6MjA3NTA2NTcxM30.ErMvP3H5OlA-fRSqdeeiy2Brh3PE7iWUmAR3q2MDK34';

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Test Supabase connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('[SUPABASE] Testing connection...');
    console.log('[SUPABASE] URL:', supabaseUrl);
    console.log('[SUPABASE] Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');

    const { data, error } = await client
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('[SUPABASE] Connection test failed:', error);
      return false;
    }

    console.log('[SUPABASE] Connection successful');
    return true;
  } catch (error) {
    console.error('[SUPABASE] Connection test error:', error);
    return false;
  }
}

export const getGoogleOAuthUrl = () => {
  return `${supabaseUrl}/auth/v1/authorize?provider=google`;
};

export const supabase = Object.assign(client, {
  supabaseUrl,
  supabaseAnonKey,
});
