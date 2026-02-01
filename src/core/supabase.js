// src/core/supabase.js
export function getSupabase() {
  if (!window.supabaseClient) {
    const SUPABASE_URL = window.CONFIG?.SUPABASE_URL;
    const SUPABASE_KEY = window.CONFIG?.SUPABASE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing CONFIG supabase keys");
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return window.supabaseClient;
}
