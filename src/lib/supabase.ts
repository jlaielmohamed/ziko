import { createClient } from '@supabase/supabase-js';

const url = 'https://lnotxnrqxapcnzofdphd.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub3R4bnJxeGFwY256b2ZkcGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNDAxNjcsImV4cCI6MjEwODcxNjE2N30.euGQsYKKm4qbw9N70Fie8c1As11Fzi37Z_-xfh2CUVI';

export const supabaseConfigured = true;
export const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
});