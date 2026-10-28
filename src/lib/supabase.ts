import { createClient } from '@supabase/supabase-js';

const url = 'https://wrpwxejdrchilqynubqb.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndycHd4ZWpkcmNoaWxxeW51YnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NjI5MzUsImV4cCI6MjEwODQzODkzNX0.4KwJfqvCB-e-pizJdclGql8WNwFy3WV_C13oIkEPMoI';

export const supabaseConfigured = true;
export const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
});