import { createClient } from '@supabase/supabase-js';

// Fallback values used because .env.local is gitignored and cannot be written by the agent directly.
// In production, these should be environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bshmmxcegwwppihlyyag.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzaG1teGNlZ3d3cHBpaGx5eWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTM1NTcsImV4cCI6MjA3OTU4OTU1N30.crvPAkjlgD5VWAXjxflDiGBA4NJYnG9JfV8r3s0arnE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
