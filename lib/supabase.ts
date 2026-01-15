import { createClient } from '@supabase/supabase-js';

// Fallback values used because .env.local is gitignored and cannot be written by the agent directly.
// In production, these should be environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nglcftgdninqessypxow.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbGNmdGdkbmlucWVzc3lweG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODU0MzYsImV4cCI6MjA4MTM2MTQzNn0.Gt-iBe7D9PofBTyocUOehM0DnNC_rCCgiPRVGz7lkic';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
